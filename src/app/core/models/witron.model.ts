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
  id?: number;
  feld_intern: string;
  spalte_excel: string;
  aktiv: boolean;
}

export interface Alarmregel {
  id: number;
  name: string;
  typ: 'tagesbruch_menge' | 'tagesbruch_wert' | 'kein_witron_import' | string;
  schwellenwert?: number | null;
  zeitfenster_stunden?: number | null;
  aktiv: boolean;
}
