export interface WitronImport {
  id: number;
  dateiname: string;
  zeitpunkt: string;
  zeilen_gesamt: number;
  zeilen_zugeordnet: number;
  zeilen_fehler: number;
  status: 'ausstehend' | 'verarbeitet' | 'fehler';
  fehlerprotokoll?: WitronImportFehler[] | null;
}

export interface WitronImportFehler {
  zeile: number;
  fehler: string;
  rohdaten?: Record<string, unknown>;
}

export interface WitronBewegung {
  id: number;
  import_id: number;
  artikel_ean?: string | null;
  artikel_name?: string | null;
  artikelpreis?: number | null;
  ort_id?: string | null;
  menge?: number | null;
  auftrag_nummer?: string | null;
  bewegungsart?: string | null;
  zeitstempel?: string | null;
  anlagenstoerung: boolean;
  roh_daten?: Record<string, unknown> | null;
}

export interface WitronColumnMapping {
  artikel_ean: string;
  artikel_name: string;
  artikelpreis: string;
  ort_id: string;
  menge: string;
  auftrag_nummer: string;
  bewegungsart: string;
  zeitstempel: string;
  anlagenstoerung?: string;
}

export interface Alarmregel {
  id: number;
  name: string;
  typ: 'tagesbruch_menge' | 'tagesbruch_wert' | 'kein_witron_import' | string;
  schwellenwert?: number | null;
  zeitfenster_stunden?: number | null;
  aktiv: boolean;
}
