Instrucciones para desplegar Web Push en Netlify:

1) Añade las variables de entorno en Netlify:
   - SUPABASE_URL = https://<tu-proyecto>.supabase.co
   - SUPABASE_ANON_KEY = <tu anon key>
   - VAPID_PUBLIC = <clave pública VAPID>
   - VAPID_PRIVATE = <clave privada VAPID>
   - VAPID_MAILTO = tu@correo

2) Crea la tabla `push_subscriptions` en Supabase con al menos las columnas:
   - id TEXT PRIMARY KEY
   - user_code TEXT
   - subscription JSONB
   - created_at TIMESTAMP

3) Ejecuta `npm install` en la carpeta del repo para que Netlify incluya las dependencias.
4) El cliente (app.js) enviará la suscripción a /.netlify/functions/save-subscription
   y podrás disparar notificaciones con /.netlify/functions/send-push

Nota: iOS/Safari tiene limitaciones históricas con Web Push; en iOS 16.4+ hay soporte para Push API en Safari — asegúrate de que tus dispositivos están actualizados y que la app está añadida a pantalla de inicio o se usa desde Safari directamente.