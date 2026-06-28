-- ============================================================
-- BreakTrace – E-Mail-Import Erweiterung
-- In Supabase: SQL Editor → New query → Ausführen
-- ============================================================

-- Konfigurationstabelle für Gmail-Integration
CREATE TABLE IF NOT EXISTS email_import_config (
  id                         BIGSERIAL PRIMARY KEY,
  gmail_refresh_token        TEXT,                -- OAuth2 Refresh Token (verschlüsselt in Supabase Vault empfohlen)
  gmail_email                TEXT,                -- die überwachte Gmail-Adresse
  sender_filter              TEXT,                -- E-Mails nur von dieser Adresse verarbeiten (leer = alle)
  subject_filter             TEXT DEFAULT 'Witron', -- Betreff-Filter
  aktiv                      BOOLEAN DEFAULT true,
  letzter_check              TIMESTAMPTZ,
  letzte_emails_verarbeitet  INTEGER DEFAULT 0,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- Standardzeile anlegen (wird über Dashboard befüllt)
INSERT INTO email_import_config (aktiv, subject_filter)
VALUES (true, 'Witron')
ON CONFLICT DO NOTHING;

-- Witron-Imports: fehlende Spalten ergänzen
ALTER TABLE witron_imports ADD COLUMN IF NOT EXISTS quelle TEXT DEFAULT 'manuell';   -- 'manuell' | 'email'
ALTER TABLE witron_imports ADD COLUMN IF NOT EXISTS email_betreff TEXT;
ALTER TABLE witron_imports ADD COLUMN IF NOT EXISTS email_absender TEXT;
ALTER TABLE witron_imports ADD COLUMN IF NOT EXISTS zeitpunkt TIMESTAMPTZ DEFAULT NOW();

-- Trigger für updated_at
CREATE OR REPLACE TRIGGER set_email_config_updated_at
  BEFORE UPDATE ON email_import_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE email_import_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nur authentifizierte Nutzer" ON email_import_config
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Cron-Job: 2× täglich um 07:00 und 17:00 Uhr (UTC+2 = 05:00 und 15:00 UTC)
-- Benötigt pg_cron Extension (in Supabase Dashboard unter Database → Extensions aktivieren)
-- ============================================================
SELECT cron.schedule(
  'breaktrace-email-check-morning',
  '0 5 * * *',  -- 07:00 Uhr CEST
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/check-witron-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'breaktrace-email-check-afternoon',
  '0 15 * * *',  -- 17:00 Uhr CEST
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/check-witron-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
