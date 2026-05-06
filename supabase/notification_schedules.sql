-- Tabla para notificaciones programadas (Web Push via servidor)
-- Ejecuta este SQL en tu Supabase dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS notification_schedules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code    TEXT        NOT NULL,
  planned_id   TEXT        NOT NULL,
  activity     TEXT        NOT NULL,
  notify_at    TIMESTAMPTZ NOT NULL,
  message_title TEXT       NOT NULL,
  message_body  TEXT       NOT NULL,
  sent         BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para que el cron job sea rápido
CREATE INDEX IF NOT EXISTS idx_notif_sched_pending
  ON notification_schedules (notify_at, sent)
  WHERE sent = FALSE;

-- RLS: habilitar y permitir al cliente insertar/leer/borrar sus propias filas
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user puede gestionar sus schedules"
  ON notification_schedules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Nota: la política anterior es permisiva (igual que push_subscriptions).
-- Si quieres restringirla al user_code, necesitas autenticación Supabase real.
