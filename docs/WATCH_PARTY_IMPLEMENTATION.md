# Watch Party — Implementación y Lecciones Aprendidas

## Stack

| Capa | Tecnología |
|------|-----------|
| Web | React 19 + Vite 8 + TypeScript + React Router |
| Mobile | React Native 0.86 + Expo 57 |
| Signaling | Supabase (Edge Function `generate-livekit-token`) |
| Media | LiveKit Cloud + `livekit-client` (web) + `@livekit/react-native` (mobile) |
| Auth | Supabase Google OAuth |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     LiveKit Cloud                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │  Web Client   │    │ Mobile Client │    │  Mobile Web  │  │
│   │ (Vite/React)  │    │  (React Nat.) │    │ (Chrome/Saf) │  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│          │                    │                    │          │
│          └──────────┬─────────┴─────────┬──────────┘          │
│                     │                   │                     │
│              ┌──────▼──────┐     ┌──────▼──────┐              │
│              │  Supabase   │     │  Supabase   │              │
│              │  Edge Fn    │     │  Database   │              │
│              │ (get token) │     │ (rooms, msgs)│              │
│              └─────────────┘     └─────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## Supabase

### Migraciones

#### 1. Tabla `virtual_rooms`

```sql
create table if not exists public.virtual_rooms (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade unique,
  host_id uuid not null references public.profiles(id),
  room_name text not null unique,
  provider text not null default 'livekit',
  created_at timestamptz default now()
);

alter table public.virtual_rooms enable row level security;

create policy "members read virtual rooms" on public.virtual_rooms
  for select using (
    exists (select 1 from public.plans p
      join public.group_members gm on gm.group_id = p.group_id
      where p.id = plan_id and gm.user_id = auth.uid())
  );

create policy "plan creator inserts virtual room" on public.virtual_rooms
  for insert with check (
    exists (select 1 from public.plans p
      where p.id = plan_id and p.created_by = auth.uid())
  );
```

#### 2. Tabla `virtual_room_members`

```sql
create table if not exists public.virtual_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.virtual_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  joined_at timestamptz default now(),
  unique(room_id, user_id)
);

alter table public.virtual_room_members enable row level security;

create policy "members manage room members" on public.virtual_room_members
  for all using (
    exists (select 1 from public.virtual_rooms vr
      join public.plans p on p.id = vr.plan_id
      join public.group_members gm on gm.group_id = p.group_id
      where vr.id = room_id and gm.user_id = auth.uid())
  );
```

#### 3. Tabla `watch_messages`

```sql
create table if not exists public.watch_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.virtual_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  message text not null,
  created_at timestamptz default now()
);

alter table public.watch_messages enable row level security;

create policy "group members read messages" on public.watch_messages
  for select using (
    exists (select 1 from public.virtual_rooms vr
      join public.plans p on p.id = vr.plan_id
      join public.group_members gm on gm.group_id = p.group_id
      where vr.id = room_id and gm.user_id = auth.uid())
  );

create policy "group members insert messages" on public.watch_messages
  for insert with check (
    exists (select 1 from public.virtual_rooms vr
      join public.plans p on p.id = vr.plan_id
      join public.group_members gm on gm.group_id = p.group_id
      where vr.id = room_id and gm.user_id = auth.uid())
  );
```

#### 4. Columna `plan_type` en `plans`

```sql
alter table public.plans
  add column if not exists plan_type text
  not null default 'physical'
  check (plan_type in ('physical', 'watch_party'));
```

#### 5. RPC `create_virtual_plan`

```sql
create or replace function public.create_virtual_plan(
  target_group_id uuid,
  plan_title text,
  plan_scheduled_at timestamptz
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_plan_id uuid;
  new_room_name text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.group_members
      where group_id = target_group_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this group';
  end if;
  if char_length(trim(plan_title)) = 0 then raise exception 'A plan title is required'; end if;

  new_room_name := 'room_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.plans (group_id, title, scheduled_at, status, created_by, plan_type)
  values (target_group_id, trim(plan_title), plan_scheduled_at, 'confirmed', auth.uid(), 'watch_party')
  returning id into new_plan_id;

  insert into public.virtual_rooms (plan_id, host_id, room_name)
  values (new_plan_id, auth.uid(), new_room_name);

  return new_plan_id;
end;
$$;

revoke all on function public.create_virtual_plan(uuid, text, timestamptz) from public;
grant execute on function public.create_virtual_plan(uuid, text, timestamptz) to authenticated;
```

### Edge Function: `generate-livekit-token`

```
supabase/functions/generate-livekit-token/index.ts
```

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${authHeader}` } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { room_id } = await req.json()
    if (!room_id) throw new Error('Missing room_id')

    const { data: room, error: roomError } = await supabase
      .from('virtual_rooms')
      .select('*, plan:plan_id!inner(group_id)')
      .eq('id', room_id)
      .single()
    if (roomError || !room) throw new Error('Room not found')

    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', room.plan.group_id)
      .eq('user_id', user.id)
      .single()
    if (!membership) throw new Error('Not a member')

    const header = { alg: 'HS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      exp: now + 3600,
      iat: now,
      iss: LIVEKIT_API_KEY,
      sub: user.id,
      name: user.user_metadata?.full_name || user.email || user.id,
      video: { room: room_id, roomJoin: true },
    }

    const b64 = (s: string) =>
      btoa(new TextEncoder().encode(s)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const headerB64 = b64(JSON.stringify(header))
    const payloadB64 = b64(JSON.stringify(payload))

    const keyBytes = new TextEncoder().encode(LIVEKIT_API_SECRET)
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerB64}.${payloadB64}`))
    const sigB64 = b64(String.fromCharCode(...new Uint8Array(sig)))

    const token = `${headerB64}.${payloadB64}.${sigB64}`

    return new Response(JSON.stringify({ token, url: LIVEKIT_URL }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
```

**Env vars en Supabase:**
- `LIVEKIT_API_KEY` — de LiveKit Cloud
- `LIVEKIT_API_SECRET` — de LiveKit Cloud
- `LIVEKIT_URL` — `wss://<proyecto>.livekit.cloud`

**Deploy:**
```bash
supabase functions deploy generate-livekit-token --no-verify-jwt
```

---

## Web (Vite + React)

### Dependencias

```bash
npm install livekit-client @tanstack/react-query
```

### WatchRoom.tsx — puntos clave

```ts
import { Room, RoomEvent, Track } from 'livekit-client'

// Conectar
const livekitRoom = new Room({ adaptiveStream: true, dynacast: true })

livekitRoom.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === 'video' && videoRef.current) {
    track.attach(videoRef.current)
  }
  if (track.kind === 'audio') {
    const audioEl = document.createElement('audio')
    audioEl.setAttribute('playsinline', '')
    audioEl.autoplay = true
    audioEl.style.display = 'none'
    containerRef.current?.appendChild(audioEl)
    track.attach(audioEl)
    // iOS: forzar altavoz via AudioContext
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const src = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]))
      src.connect(ctx.destination)
    } catch {}
  }
})

// Screen share (host)
async function startScreenShare() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  const videoTrack = stream.getVideoTracks()[0]
  const audioTrack = stream.getAudioTracks()[0]

  await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.ScreenShare })
  if (audioTrack) {
    await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.ScreenShareAudio })
  }
}
```

### Notas sobre web mobile

- **Android (Chrome)**: `getDisplayMedia({ audio: true })` captura audio de la pestaña/pantalla. El navegador maneja el ruteo automáticamente.
- **iOS (Safari)**: `AudioContext` + `ctx.destination` fuerza salida por altavoz.
- WebRTC en Chrome Android usa `MODE_IN_COMMUNICATION` automáticamente, pero el navegador maneja el ruteo al altavoz correctamente.

---

## Mobile (React Native + Expo)

### Dependencias

> **Importante**: NO instalar `react-native-webrtc`. `@livekit/react-native-webrtc` es un fork que lo reemplaza. Instalar ambos causa conflicto de clases DuplicateClass.

```bash
npx expo install @livekit/react-native @livekit/react-native-webrtc
```

### Android — Configuración nativa (CRÍTICA)

**Archivo:** `android/app/src/main/java/com/juntapp/mobile/MainApplication.kt`

```kotlin
package com.juntapp.mobile

import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType

class MainApplication : Application(), ReactApplication {

  override fun onCreate() {
    super.onCreate()
    // IMPORTANTE: antes de cualquier inicialización de React Native
    LiveKitReactNative.setup(this, AudioType.MediaAudioType())
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
```

#### Lección #1: `LiveKitReactNative.setup()` es obligatorio

El README de `@livekit/react-native` lo exige pero es fácil pasarlo por alto. Sin él:

- `WebRTCModule` crea un `AudioDeviceModule` **por defecto** con `USAGE_VOICE_COMMUNICATION` + `MODE_IN_COMMUNICATION`
- El audio se enruta al **auricular** (earpiece) en vez del altavoz
- `AudioSession.configureAudio()` **crash**ea porque necesita `LiveKitReactNative.audioDeviceModule`

#### Lección #2: `MediaAudioType` vs `CommunicationAudioType`

| Tipo | Uso | Routing |
|------|-----|---------|
| `CommunicationAudioType` | El host publica micrófono (voice chat) | Auricular por defecto |
| `MediaAudioType` | El usuario solo consume audio (viewer) | **Altavoz por defecto** |

Para Watch Party (ver/escuchar pantalla compartida): **`MediaAudioType()`**

#### Lección #3: `configureAudio()` crash

`AudioSession.configureAudio()` llama internamente:

```kotlin
val adm = LiveKitReactNative.audioDeviceModule
val oldAudioAttributes = WebRtcAudioTrackHelper.getAudioOutputAttributes(adm)
//                                            └── accede a adm.audioOutput
```

`adm.audioOutput` es `null` hasta que se recibe el primer track de audio. Llamarlo antes → `NullPointerException`.

Además, el Twilio `AudioSwitch` (iniciado por `startAudioSession()`) por defecto usa `MODE_IN_COMMUNICATION`. No usar `startAudioSession()` en Android a menos que sea necesario.

#### Lección #4: No llamar `startAudioSession()` en Android

En iOS, `registerGlobals()` llama `setupIOSAudioManagement()` automáticamente. **En Android no hay equivalente**. `startAudioSession()` inicia el Twilio AudioSwitch que pone `MODE_IN_COMMUNICATION` — exactamente lo que queremos evitar.

Con `setup(MediaAudioType())`, el `AudioDeviceModule` de WebRTC crea `AudioTrack`s con `USAGE_MEDIA` + `STREAM_MUSIC`. Android rutéa eso al altavoz automáticamente, sin AudioSwitch.

### WatchRoom.tsx (mobile)

```tsx
import {
  LiveKitRoom, VideoTrack, useRemoteParticipants,
  useTracks, useLocalParticipant, useConnectionState,
  registerGlobals,
} from '@livekit/react-native'
import { Track, ConnectionState } from 'livekit-client'

registerGlobals()  // una vez al importar

function RoomView({ roomId, isHost, onError }) {
  const { data: messages = [] } = useWatchMessages(roomId)
  const { localParticipant } = useLocalParticipant()
  const connectionState = useConnectionState(undefined)
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera])
  const [isSharing, setIsSharing] = useState(false)

  async function toggleScreenShare() {
    if (!localParticipant) return
    if (isSharing) {
      await localParticipant.setScreenShareEnabled(false)
      setIsSharing(false)
    } else {
      await localParticipant.setScreenShareEnabled(true)
      setIsSharing(true)
    }
  }

  const screenShareTrack = tracks.find(t => t.source === Track.Source.ScreenShare)

  return (
    <LiveKitRoom serverUrl={url} token={token} connect={true}>
      {screenShareTrack ? (
        <VideoTrack trackRef={screenShareTrack} style={styles.video} objectFit="contain" />
      ) : (
        <Text>Esperando al host…</Text>
      )}
    </LiveKitRoom>
  )
}
```

### Screen share audio

En React Native, `@livekit/react-native-webrtc` NO soporta captura de audio interno (solo video). `getDisplayMedia()` en el polyfill ignora opciones.

La alternativa: activar el micrófono del host junto con la pantalla:

```ts
await Promise.all([
  localParticipant.setMicrophoneEnabled(true),
  localParticipant.setScreenShareEnabled(true),
])
```

---

## Lecciones aprendidas — Resumen

### 1. `LiveKitReactNative.setup()` es el paso #1

No omitirlo. Sin él, todo el audio configurable desde JS falla o crashea.

### 2. `MediaAudioType()` para consumo, `CommunicationAudioType()` para publicación

Watch Party es solo consumo → `MediaAudioType()`. Voice chat necesitaría `CommunicationAudioType()`.

### 3. No usar `AudioSwitch` en Android si no es necesario

El Twilio AudioSwitch (iniciado por `startAudioSession()`) forza `MODE_IN_COMMUNICATION`. Si solo reproducís audio media, no lo necesitás.

### 4. `configureAudio()` requiere tracks activos

`adm.audioOutput` se crea al recibir el primer track. No llamar `configureAudio()` antes de eso.

### 5. Los navegadores manejan el ruteo solos

Web (Chrome, Safari) rutea WebRTC audio al altavoz automáticamente. Solo la app nativa React Native necesita configuración explícita — y se resuelve con `setup(MediaAudioType)`.

### 6. Flujo correcto

```
MainApplication.onCreate()
  └─ LiveKitReactNative.setup(this, AudioType.MediaAudioType())
       └─ Crea AudioDeviceModule con USAGE_MEDIA, MODE_NORMAL, STREAM_MUSIC

LiveKitRoom conecta
  └─ WebRTC usa el AudioDeviceModule de setup()
  └─ AudioTrack se reproduce con atributos media
  └─ Android rutéa al altavoz automáticamente
       ├─ Bluetooth conectado → va al BT
       ├─ Audífonos conectados → va a los audífonos
       └─ Sin accesorios → altavoz principal
```

### 7. Orden correcto en `onCreate()`

```kotlin
override fun onCreate() {
    super.onCreate()                          // 1. Inicializar Application
    LiveKitReactNative.setup(this, ...)        // 2. Configurar audio ANTES de RN
    loadReactNative(this)                      // 3. Inicializar React Native
}
```

---

## Troubleshooting

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Audio por auricular | `setup()` no llamado o `CommunicationAudioType` | Agregar `setup(this, MediaAudioType())` |
| App crashea al entrar a sala | `configureAudio()` sin `setup()` | Agregar `setup()` o remover `configureAudio()` |
| Sin audio en screen share | Audio track no publicado | Publicar con `Track.Source.ScreenShareAudio` |
| Web no comparte audio | `getDisplayMedia` sin `audio: true` | `getDisplayMedia({ video: true, audio: true })` |
| Sin audio al compartir en RN | `@livekit/react-native-webrtc` no soporta audio | Usar micrófono aparte (`setMicrophoneEnabled(true)`) |
