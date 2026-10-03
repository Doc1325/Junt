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
