export type Ebene = 'stueck' | 'palette';
export type BruchmeldungStatus = 'offen' | 'entsorgt' | 'synchronisiert';

export interface Bruchmeldung {
  meldung_id: number;
  mitarbeiter_code: string;
  ort_id: string;
  artikel_ean: string;
  artikel_name: string;
  ebene: Ebene;
  paletten_nummer?: string | null;
  menge: number;
  zeitstempel_erfassung: string;
  zeitstempel_entsorgung?: string | null;
  status: BruchmeldungStatus;
  artikelpreis?: number | null;
  durchsatz_referenz?: number | null;
  aktiver_auftrag?: string | null;
  bewegungsart?: string | null;
  anlagenstoerung?: boolean | null;
}

export interface BruchmeldungInsert
  extends Omit<Bruchmeldung, 'meldung_id' | 'zeitstempel_erfassung'> {
  zeitstempel_erfassung?: string;
}

export interface Artikel {
  id: number;
  ean: string;
  name: string;
}

export interface Ort {
  id: string;
  bezeichnung?: string | null;
}
