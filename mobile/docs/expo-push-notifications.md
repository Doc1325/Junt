# Push Notifications con Expo + Supabase (Android)

Guía basada en experiencia real. Stack: Expo SDK 57, Supabase, Android (dev build).

## Índice

1. [Arquitectura](#1-arquitectura)
2. [Firebase Console](#2-firebase-console)
3. [Expo project ID](#3-expo-project-id)
4. [Configurar app.json](#4-configurar-appjson)
5. [Clean build](#5-clean-build)
6. [Registrar push token (app)](#6-registrar-push-token-app)
7. [Tabla en Supabase](#7-tabla-en-supabase)
8. [Edge Function para enviar pushes](#8-edge-function-para-enviar-pushes)
9. [Credencial FCM en Expo](#9-credencial-fcm-en-expo)
10. [Permiso IAM en Google Cloud](#10-permiso-iam-en-google-cloud)
11. [Probar](#11-probar)
12. [Errores comunes](#12-errores-comunes)

---

## 1. Arquitectura

```
App → getExpoPushTokenAsync() → Expo genera token
  └─ guarda token en Supabase (user_push_tokens)

Edge Function → Expo Push API → FCM (Firebase) → dispositivo Android
```

- El token es formato `ExponentPushToken[xxxx]` — NO es un FCM token directo
- Expo hace de puente entre tu backend y FCM/APNs
- Firebase solo es necesario como infraestructura (no como backend)

---

## 2. Firebase Console

1. https://console.firebase.google.com → Create project (o usa uno existente)
2. **Add app** → Android
3. **Package name**: el mismo de `app.json` (ej: `com.juntapp.mobile`)
4. Debug signing certificate → opcional, puedes omitirlo
5. **Download `google-services.json`**
6. Coloca el archivo en la raíz del proyecto mobile (junto a `app.json`)

---

## 3. Expo project ID

Crea un proyecto en https://expo.dev o desde CLI:

```bash
npx eas init
```

Esto genera un `projectId` (UUID). Lo vas a necesitar en dos lugares:
- `app.json` → `extra.eas.projectId`
- `getExpoPushTokenAsync({ projectId })` en el código

---

## 4. Configurar app.json

```json
{
  "expo": {
    "android": {
      "package": "com.juntapp.mobile",
      "googleServicesFile": "./google-services.json"
    },
    "extra": {
      "eas": {
        "projectId": "ad41da45-25ed-4fd4-aebd-1690bc61d612"
      }
    },
    "plugins": [
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "../public/icon.png",
          "color": "#28533a",
          "googleServicesFile": "./google-services.json"
        }
      ]
    ]
  }
}
```

**Las dos referencias a `googleServicesFile` son necesarias:**
- `android.googleServicesFile` → para el plugin de Google Services
- `plugins[].googleServicesFile` → para que `expo-notifications` lo copie al proyecto nativo

---

## 5. Clean build

Cuando agregas o cambias cualquier configuración nativa (google-services.json, plugins, package name, etc.), el proyecto Android existente NO se actualiza solo. Hay que regenerarlo desde cero:

```bash
rm -rf android
npx expo run:android --variant release
```

Si omites el `rm -rf`, la build anterior se reusa sin Firebase y falla con:
```
Unable to get Firebase messaging
```

---

## 6. Registrar push token (app)

```typescript
// src/lib/notifications.ts
import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// Crear canal Android (obligatorio desde API 26+)
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  })
}

export type NotificationData = {
  planId?: string
  groupId?: string
}

export function useNotificationNavigation(onNavigate: (data: NotificationData) => void) {
  useEffect(() => {
    const response = Notifications.getLastNotificationResponse()
    handleNotificationResponse(response, onNavigate)
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, onNavigate)
    })
    return () => sub.remove()
  }, [onNavigate])
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
  onNavigate: (data: NotificationData) => void,
) {
  if (!response) return
  const data = response.notification.request.content.data as NotificationData
  if (data.planId || data.groupId) onNavigate(data)
}

export async function registerForPushNotificationsAsync(userId?: string) {
  try {
    // 1. Pedir permiso
    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const result = await Notifications.requestPermissionsAsync()
      status = result.status
    }
    if (status !== 'granted') return

    // 2. Obtener Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ad41da45-25ed-4fd4-aebd-1690bc61d612',
    })
    const token = tokenData.data

    // 3. Guardar en Supabase
    const { error } = await supabase.from('user_push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      { onConflict: 'token' },
    )
    if (error) console.error('[push] Upsert failed:', error.message)
  } catch (e: any) {
    console.error('[push] Error:', e.message)
  }
}
```

**Importante:** `console.log` es eliminado por Hermes en release builds. Para debuggear en release usa `Alert.alert()` o corre en modo debug (`npx expo run:android` sin `--variant release`).

**Llamar al registro desde App.tsx:**
```typescript
useEffect(() => {
  if (session) {
    registerForPushNotificationsAsync(session.user.id)
  }
}, [session])
```

También desde el listener de auth:
```typescript
supabase.auth.onAuthStateChange((_event, nextSession) => {
  if (nextSession) {
    registerForPushNotificationsAsync(nextSession.user.id)
  }
})
```

---

## 7. Tabla en Supabase

```sql
create table public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(token)
);

alter table public.user_push_tokens enable row level security;

create policy "users manage own tokens" on public.user_push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

---

## 8. Edge Function para enviar pushes

```typescript
// supabase/functions/notify-new-plan/index.ts
import { createClient } from 'npm:@supabase/supabase-js@^2.110.8'

interface PushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const { planId, groupId, creatorId } = await req.json()
  if (!planId || !groupId || !creatorId) {
    return new Response('Missing planId, groupId, or creatorId', { status: 400, headers: corsHeaders })
  }

  // Usa SERVICE_ROLE_KEY para bypass RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Obtener datos del plan, creador, miembros y tokens...

  const messages = tokens.map((t: any) => ({
    to: t.token,
    sound: 'default',
    title: `${creatorName} creó un plan en ${groupName}`,
    body: plan.title,
    data: { planId, groupId },
    priority: 'high',
    channelId: 'default',  // Obligatorio en Android
  }))

  // Enviar a Expo Push API
  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  })

  const result = await expoResponse.json()
  const raw = result.data || result
  const tickets: PushTicket[] = Array.isArray(raw) ? raw : [raw]

  // Limpiar tokens inválidos (device no registrado)
  const invalidTokens = tickets
    .filter((t) => t.status === 'error'
      && (t.message?.includes('DeviceNotRegistered')
        || t.message?.includes('InvalidCredentials')))
    .map((_, i) => tokens[i]?.token)
    .filter(Boolean)

  if (invalidTokens.length > 0) {
    await supabase.from('user_push_tokens').delete().in('token', invalidTokens)
  }

  return new Response(JSON.stringify({ sent: messages.length }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
})
```

Desplegar:
```bash
supabase functions deploy notify-new-plan
```

---

## 9. Credencial FCM en Expo

Expo necesita una **service account** de Firebase para autenticarse contra FCM.

1. Firebase Console → ⚙ **Project Settings** → **Service accounts**
2. **Generate new private key** → descarga el JSON
3. Expo dashboard → tu proyecto → **Credentials** → **Android** → sube el JSON en **Push Notifications (FCM v1)**

O desde CLI:
```bash
npx eas credentials -p android
```
Selecciona la opción **FCM v1** y proporciona la ruta al JSON descargado.

---

## 10. Permiso IAM en Google Cloud

La service account necesita permiso explícito para enviar mensajes FCM.

1. https://console.cloud.google.com/iam-admin/iam?project=TU_PROYECTO_ID
2. **+ Add** (Grant Access)
3. **New principals**: `firebase-adminsdk-xxxxx@TU_PROYECTO.iam.gserviceaccount.com`
4. **Role**: **Firebase Cloud Messaging API Admin** (no el genérico)
5. Save

Sin este permiso, Expo responde con:
```
Permission 'cloudmessaging.messages.create' denied
```

---

## 11. Probar

### Verificar token guardado
```sql
select * from user_push_tokens;
```

### Enviar push manual desde terminal
```bash
curl -H 'Content-Type: application/json' -X POST \
  https://exp.host/--/api/v2/push/send \
  -d '{"to":"ExponentPushToken[XXXX]","title":"Test","body":"probando","priority":"high","channelId":"default"}'
```

### Verificar delivery en Edge Function
Revisa los logs en Supabase Dashboard → Edge Functions → notify-new-plan → Logs.

La respuesta `"status":"ok"` de Expo significa que **encoló** el push, no que llegó al dispositivo. Para saber si llegó a FCM, revisa los receipts.

---

## 12. Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `Unable to get Firebase messaging` | Falta google-services.json en build nativo | `rm -rf android && npx expo run:android` |
| `getExpoPushTokenAsync failed` | Falta projectId | Agregar a `app.json` + pasarlo en la función |
| `Unable to retrieve the FCM server key` | Expo no tiene credencial FCM | Subir service account JSON a Expo dashboard |
| `cloudmessaging.messages.create denied` | Service account sin permiso IAM | Agregar rol Firebase Cloud Messaging API Admin |
| `tickets.filter is not a function` | Expo devuelve objeto en vez de array | Usar `result.data || result` y normalizar |
| Push no llega en foreground | Handler mal configurado | Usar `shouldShowBanner: true` |
| Push no llega en background | Falta channelId | Agregar `channelId: 'default'` al mensaje |
| console.log no se ve | Hermes lo elimina en release | Usar Alert.alert() o debug build |

## Resumen de pasos en orden

1. Firebase Console → crear proyecto + app Android → descargar `google-services.json`
2. `expo init` o proyecto existente → agregar `expo-notifications`, crear proyecto en expo.dev
3. Configurar `app.json` con projectId, googleServicesFile, plugins
4. `rm -rf android && npx expo run:android --variant release`
5. Crear tabla `user_push_tokens` en Supabase con RLS
6. Implementar `registerForPushNotificationsAsync` en la app
7. Crear Edge Function con Expo Push API
8. Firebase → Service accounts → generar JSON → subir a Expo dashboard
9. Google Cloud IAM → agregar rol Firebase Cloud Messaging API Admin
10. Probar
