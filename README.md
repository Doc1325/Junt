# JuntApp

Decidan qué hacer, quién va y dónde se ven. Sin perder el hilo del grupo.

- **Web**: React + Vite + Tailwind CSS
- **Mobile**: Expo (React Native) para Android
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)

## Estructura

```
├── src/              Web (React + Vite)
├── mobile/           App Android (Expo)
├── supabase/
│   ├── migrations/   Migraciones de base de datos
│   └── functions/    Edge Functions (notificaciones push)
├── public/           Assets compartidos (icono, branding)
└── mockups/          Maquetas de diseño
```

## Desarrollo local

### Web

```bash
npm install
npm run dev
```

### Mobile

```bash
cd mobile
npx expo run:android
```

Requiere un dispositivo Android físico o emulador. La app no funciona en Expo Go; usa dev builds.

### Supabase

Las credenciales se configuran en `.env` (raíz) para web y en `mobile/.env` para la app.

1. Habilita Google en **Authentication → Providers**.
2. Agrega las URLs de redirección (local y producción) en **Authentication → URL Configuration**.
3. Ejecuta las migraciones de `supabase/migrations/` en orden.

### Edge Functions

```bash
cd supabase
supabase functions deploy notify-new-plan
```

`notify-new-plan` requiere un JWT de usuario y deriva el creador desde esa sesión.
El scraper usa `service_role`, por lo que debe configurarse con un secreto no versionado:

```bash
supabase secrets set SCRAPE_SECRET="<un-valor-aleatorio-largo>"
supabase functions deploy scrape-padonde --no-verify-jwt
```

El cron debe enviar ese mismo valor en el header `x-scrape-secret`. Nunca uses la
clave `service_role` como secreto del cron.

El proyecto remoto ejecuta el scraper automáticamente todos los días mediante
`pg_cron`, `pg_net` y Supabase Vault:

- 06:00 (Santo Domingo): descubre eventos y actualiza películas.
- 06:05–06:41: procesa el catálogo en lotes de 40.
- 07:00–07:36: revisa precios y categorías en lotes de 40.

La migración `20261010010000_schedule_padonde_scraping.sql` crea la cola,
los tres trabajos y `scrape_runs`, que conserva el resultado de cada lote.
Para revisar la salud del proceso desde SQL Editor:

```sql
select mode, batch_offset, status, started_at, finished_at, stats, error
from public.scrape_runs
order by started_at desc
limit 30;
```

## Notificaciones push

Ver `mobile/docs/expo-push-notifications.md`.

## Build de producción

```bash
# Web
npm run build

# Mobile (release)
cd mobile
rm -rf android && npx expo run:android --variant release
```

## Verificación completa

```bash
npm run check
```

Este comando compila la web, ejecuta el linter y comprueba TypeScript en mobile.
