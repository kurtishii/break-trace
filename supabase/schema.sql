-- ============================================================
-- BreakTrace – Supabase Datenbankschema
-- In Supabase: SQL Editor → New query → Alles einfügen → Run
-- ============================================================

-- Artikelstammdaten
CREATE TABLE IF NOT EXISTS artikel (
  id        BIGSERIAL PRIMARY KEY,
  ean       TEXT UNIQUE NOT NULL,
  name      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lagerorte / Lagerplätze
CREATE TABLE IF NOT EXISTS orte (
  id          TEXT PRIMARY KEY, -- entspricht dem Scan-Code des QR-Labels
  bezeichnung TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bruchmeldungen (Kerntabelle)
CREATE TABLE IF NOT EXISTS bruchmeldungen (
  meldung_id               BIGSERIAL PRIMARY KEY,
  mitarbeiter_code         TEXT NOT NULL,
  ort_id                   TEXT NOT NULL,
  artikel_ean              TEXT NOT NULL,
  artikel_name             TEXT NOT NULL,
  ebene                    TEXT NOT NULL CHECK (ebene IN ('stueck', 'palette')),
  paletten_nummer          TEXT,
  menge                    INTEGER NOT NULL CHECK (menge >= 1),
  zeitstempel_erfassung    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zeitstempel_entsorgung   TIMESTAMPTZ,
  status                   TEXT NOT NULL DEFAULT 'offen'
                             CHECK (status IN ('offen', 'entsorgt', 'synchronisiert')),
  -- Witron-Anreicherungsfelder (nullable bis Import)
  artikelpreis             DECIMAL(10, 2),
  durchsatz_referenz       INTEGER,
  aktiver_auftrag          TEXT,
  bewegungsart             TEXT,
  anlagenstoerung          BOOLEAN,
  -- Housekeeping
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Witron-Importprotokoll
CREATE TABLE IF NOT EXISTS witron_imports (
  id                BIGSERIAL PRIMARY KEY,
  dateiname         TEXT NOT NULL,
  zeitpunkt         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zeilen_gesamt     INTEGER NOT NULL DEFAULT 0,
  zeilen_zugeordnet INTEGER NOT NULL DEFAULT 0,
  zeilen_fehler     INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ausstehend'
                      CHECK (status IN ('ausstehend', 'verarbeitet', 'fehler')),
  fehlerprotokoll   JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Witron-Bewegungsdaten (geparste Rohdaten je Import)
CREATE TABLE IF NOT EXISTS witron_bewegungen (
  id             BIGSERIAL PRIMARY KEY,
  import_id      BIGINT REFERENCES witron_imports (id) ON DELETE CASCADE,
  artikel_ean    TEXT,
  artikel_name   TEXT,
  artikelpreis   DECIMAL(10, 2),
  ort_id         TEXT,
  menge          INTEGER,
  auftrag_nummer TEXT,
  bewegungsart   TEXT,
  zeitstempel    TIMESTAMPTZ,
  anlagenstoerung BOOLEAN DEFAULT FALSE,
  roh_daten      JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Alarmregeln
CREATE TABLE IF NOT EXISTS alarmregeln (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  typ                  TEXT NOT NULL,
  schwellenwert        DECIMAL(10, 2),
  zeitfenster_stunden  INTEGER,
  aktiv                BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Witron-Spalten-Mapping (konfigurierbar, kein Hard-coding im Code)
CREATE TABLE IF NOT EXISTS witron_column_mapping (
  id            BIGSERIAL PRIMARY KEY,
  feld_intern   TEXT UNIQUE NOT NULL, -- z.B. 'artikel_ean'
  spalte_excel  TEXT NOT NULL,        -- z.B. 'EAN-Nummer' (aus echtem Report)
  aktiv         BOOLEAN DEFAULT TRUE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Standardwerte Mapping (Platzhalter, müssen mit realem Report abgeglichen werden)
INSERT INTO witron_column_mapping (feld_intern, spalte_excel) VALUES
  ('artikel_ean',    'EAN'),
  ('artikel_name',   'Artikelbezeichnung'),
  ('artikelpreis',   'Preis'),
  ('ort_id',         'Lagerplatz'),
  ('menge',          'Menge'),
  ('auftrag_nummer', 'Auftragsnummer'),
  ('bewegungsart',   'Bewegungsart'),
  ('zeitstempel',    'Zeitstempel'),
  ('anlagenstoerung','Störung')
ON CONFLICT (feld_intern) DO NOTHING;

-- ============================================================
-- Indizes für Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bruchmeldungen_ean      ON bruchmeldungen (artikel_ean);
CREATE INDEX IF NOT EXISTS idx_bruchmeldungen_ort      ON bruchmeldungen (ort_id);
CREATE INDEX IF NOT EXISTS idx_bruchmeldungen_ts       ON bruchmeldungen (zeitstempel_erfassung);
CREATE INDEX IF NOT EXISTS idx_bruchmeldungen_status   ON bruchmeldungen (status);
CREATE INDEX IF NOT EXISTS idx_witron_bew_ean          ON witron_bewegungen (artikel_ean);
CREATE INDEX IF NOT EXISTS idx_witron_bew_ort          ON witron_bewegungen (ort_id);
CREATE INDEX IF NOT EXISTS idx_witron_bew_ts           ON witron_bewegungen (zeitstempel);

-- ============================================================
-- updated_at automatisch setzen
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bruchmeldungen_updated_at
  BEFORE UPDATE ON bruchmeldungen
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE bruchmeldungen    ENABLE ROW LEVEL SECURITY;
ALTER TABLE artikel           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orte              ENABLE ROW LEVEL SECURITY;
ALTER TABLE witron_imports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE witron_bewegungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarmregeln       ENABLE ROW LEVEL SECURITY;

-- Lagerleitung / Admin: voller Zugriff auf alles (über Supabase-Rolle)
CREATE POLICY "authenticated_full_access" ON bruchmeldungen
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON artikel
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON orte
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON witron_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON witron_bewegungen
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON alarmregeln
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
