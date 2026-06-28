import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Bruchmeldung } from '../models/bruchmeldung.model';
import { SupabaseService } from './supabase.service';

export interface Zeitraum {
  von: Date;
  bis: Date;
}

export interface ArtikelRanking {
  ean: string;
  name: string;
  menge: number;
  wert: number;
  anzahlMeldungen: number;
}

export interface OrtRanking {
  ort_id: string;
  menge: number;
  wert: number;
  anzahlMeldungen: number;
}

export interface TagesTrend {
  datum: string;
  menge: number;
  wert: number;
}

@Injectable({ providedIn: 'root' })
export class BruchmeldungService implements OnDestroy {
  private supabase = inject(SupabaseService);
  private channel: RealtimeChannel | null = null;

  readonly meldungen = signal<Bruchmeldung[]>([]);
  readonly loading = signal(false);
  readonly fehler = signal<string | null>(null);
  readonly zeitraum = signal<Zeitraum>({
    von: this.startOfDay(this.subtractDays(new Date(), 6)),
    bis: this.endOfDay(new Date()),
  });

  // Abgeleitete KPIs – aktualisieren sich automatisch wenn meldungen() sich ändert
  readonly gesamtMenge = computed(() =>
    this.meldungen().reduce((s, m) => s + m.menge, 0)
  );

  readonly gesamtWert = computed(() =>
    this.meldungen().reduce((s, m) => s + (m.artikelpreis ?? 0) * m.menge, 0)
  );

  readonly anzahlMeldungen = computed(() => this.meldungen().length);

  readonly artikelRanking = computed<ArtikelRanking[]>(() => {
    const map = new Map<string, ArtikelRanking>();
    for (const m of this.meldungen()) {
      const key = m.artikel_ean;
      const existing = map.get(key) ?? { ean: key, name: m.artikel_name, menge: 0, wert: 0, anzahlMeldungen: 0 };
      map.set(key, {
        ...existing,
        menge: existing.menge + m.menge,
        wert: existing.wert + (m.artikelpreis ?? 0) * m.menge,
        anzahlMeldungen: existing.anzahlMeldungen + 1,
      });
    }
    return [...map.values()].sort((a, b) => b.menge - a.menge);
  });

  readonly ortRanking = computed<OrtRanking[]>(() => {
    const map = new Map<string, OrtRanking>();
    for (const m of this.meldungen()) {
      const key = m.ort_id;
      const existing = map.get(key) ?? { ort_id: key, menge: 0, wert: 0, anzahlMeldungen: 0 };
      map.set(key, {
        ...existing,
        menge: existing.menge + m.menge,
        wert: existing.wert + (m.artikelpreis ?? 0) * m.menge,
        anzahlMeldungen: existing.anzahlMeldungen + 1,
      });
    }
    return [...map.values()].sort((a, b) => b.menge - a.menge);
  });

  readonly tagesTrend = computed<TagesTrend[]>(() => {
    const map = new Map<string, TagesTrend>();
    for (const m of this.meldungen()) {
      const datum = m.zeitstempel_erfassung!.slice(0, 10);
      const existing = map.get(datum) ?? { datum, menge: 0, wert: 0 };
      map.set(datum, {
        datum,
        menge: existing.menge + m.menge,
        wert: existing.wert + (m.artikelpreis ?? 0) * m.menge,
      });
    }
    return [...map.values()].sort((a, b) => a.datum.localeCompare(b.datum));
  });

  constructor() {
    this.laden();
    this.subscribeRealtime();
  }

  async setZeitraum(von: Date, bis: Date) {
    this.zeitraum.set({ von: this.startOfDay(von), bis: this.endOfDay(bis) });
    await this.laden();
  }

  private async laden() {
    this.loading.set(true);
    this.fehler.set(null);
    const { von, bis } = this.zeitraum();

    const { data, error } = await this.supabase.client
      .from('bruchmeldungen')
      .select('*')
      .gte('zeitstempel_erfassung', von.toISOString())
      .lte('zeitstempel_erfassung', bis.toISOString())
      .order('zeitstempel_erfassung', { ascending: false });

    if (error) {
      this.fehler.set(error.message);
    } else {
      this.meldungen.set(data ?? []);
    }
    this.loading.set(false);
  }

  private subscribeRealtime() {
    this.channel = this.supabase.client
      .channel('bruchmeldungen-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bruchmeldungen' },
        payload => {
          const { von, bis } = this.zeitraum();

          if (payload.eventType === 'INSERT') {
            const neu = payload.new as Bruchmeldung;
            const ts = new Date(neu.zeitstempel_erfassung!);
            if (ts >= von && ts <= bis) {
              this.meldungen.update(list => [neu, ...list]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Bruchmeldung;
            this.meldungen.update(list =>
              list.map(m => m.meldung_id === updated.meldung_id ? updated : m)
            );
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { meldung_id: number }).meldung_id;
            this.meldungen.update(list => list.filter(m => m.meldung_id !== id));
          }
        }
      )
      .subscribe();
  }

  ngOnDestroy() {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
    }
  }

  private subtractDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
