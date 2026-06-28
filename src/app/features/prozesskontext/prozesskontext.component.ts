import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BruchmeldungService } from '../../core/services/bruchmeldung.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Bruchmeldung } from '../../core/models/bruchmeldung.model';
import { WitronBewegung } from '../../core/models/witron.model';

interface ZeitleistenEintrag {
  typ: 'bruch' | 'witron';
  zeitstempel: string;
  meldung?: Bruchmeldung;
  bewegung?: WitronBewegung;
  abstandMinuten?: number;
}

@Component({
  selector: 'app-prozesskontext',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Witron-Prozesskontext</h2>
          <p class="text-sm text-gray-500 mt-1">Bruchmeldungen mit zeitlich nächsten Witron-Bewegungen</p>
        </div>
        <div class="flex gap-2">
          <select [(ngModel)]="filterOrt" (ngModelChange)="ladeKontext()"
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Alle Orte</option>
            @for (ort of verfuegbareOrte(); track ort) {
              <option [value]="ort">{{ ort }}</option>
            }
          </select>
          <select [(ngModel)]="filterBewegungsart" (ngModelChange)="ladeKontext()"
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Alle Bewegungsarten</option>
            @for (art of verfuegbareBewegungsarten(); track art) {
              <option [value]="art">{{ art }}</option>
            }
          </select>
        </div>
      </div>

      @if (laden()) {
        <div class="bg-white rounded-xl p-12 text-center text-gray-400">Lade Prozessdaten …</div>
      } @else if (zeitleiste().length === 0) {
        <div class="bg-white rounded-xl p-12 text-center text-gray-400">
          Keine Daten vorhanden. Bitte zuerst einen Witron-Report importieren.
        </div>
      } @else {
        <div class="space-y-3">
          @for (eintrag of zeitleiste(); track eintrag.zeitstempel + eintrag.typ) {
            @if (eintrag.typ === 'bruch') {
              <!-- Bruchmeldung -->
              <div class="bg-white rounded-xl shadow-sm border-l-4 border-red-400 p-4 flex items-start gap-4">
                <div class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-bold text-sm">B</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-red-600 uppercase tracking-wide">Bruchmeldung</span>
                    <span class="text-xs text-gray-400">{{ eintrag.zeitstempel | date:'dd.MM.yyyy HH:mm':'':'de' }}</span>
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Ort: {{ eintrag.meldung!.ort_id }}
                    </span>
                    @if (!eintrag.meldung!.aktiver_auftrag) {
                      <span class="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                        Kein Witron-Match
                      </span>
                    }
                  </div>
                  <p class="text-sm font-medium text-gray-800 mt-1">{{ eintrag.meldung!.artikel_name }}</p>
                  <p class="text-xs text-gray-500">
                    {{ eintrag.meldung!.menge }} Stk. · {{ eintrag.meldung!.ebene === 'palette' ? 'Palette' : 'Einzelartikel' }}
                    @if (eintrag.meldung!.aktiver_auftrag) {
                      · Auftrag: {{ eintrag.meldung!.aktiver_auftrag }}
                      · {{ eintrag.meldung!.bewegungsart }}
                    }
                    @if (eintrag.meldung!.anlagenstoerung) {
                      <span class="ml-2 text-red-500 font-medium">⚠ Anlagenstörung</span>
                    }
                  </p>
                </div>
              </div>
            } @else {
              <!-- Witron-Bewegung -->
              <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 flex items-start gap-4 ml-6">
                <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 font-bold text-sm">W</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-blue-600 uppercase tracking-wide">Witron</span>
                    <span class="text-xs text-gray-400">{{ eintrag.zeitstempel | date:'dd.MM.yyyy HH:mm':'':'de' }}</span>
                    @if (eintrag.abstandMinuten != null) {
                      <span class="text-xs text-gray-400">({{ eintrag.abstandMinuten }} Min. vor/nach Bruch)</span>
                    }
                    @if (eintrag.bewegung!.anlagenstoerung) {
                      <span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Störung</span>
                    }
                  </div>
                  <p class="text-sm text-gray-700 mt-1">
                    {{ eintrag.bewegung!.bewegungsart ?? 'Bewegung' }}
                    @if (eintrag.bewegung!.auftrag_nummer) { · Auftrag {{ eintrag.bewegung!.auftrag_nummer }}  }
                    @if (eintrag.bewegung!.menge) { · {{ eintrag.bewegung!.menge }} Stk. }
                  </p>
                  @if (eintrag.bewegung!.artikel_name) {
                    <p class="text-xs text-gray-400">{{ eintrag.bewegung!.artikel_name }}</p>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class ProzesskontextComponent {
  readonly svc = inject(BruchmeldungService);
  private supabase = inject(SupabaseService);

  filterOrt = '';
  filterBewegungsart = '';
  laden = signal(false);
  witronBewegungen = signal<WitronBewegung[]>([]);

  readonly verfuegbareOrte = computed(() => [...new Set(this.svc.meldungen().map(m => m.ort_id))].sort());
  readonly verfuegbareBewegungsarten = computed(() =>
    [...new Set(this.witronBewegungen().map(b => b.bewegungsart).filter(Boolean) as string[])].sort()
  );

  constructor() { this.ladeKontext(); }

  async ladeKontext() {
    this.laden.set(true);
    let query = this.supabase.client.from('witron_bewegungen').select('*').order('zeitstempel', { ascending: false }).limit(500);
    if (this.filterOrt) query = query.eq('ort_id', this.filterOrt);
    if (this.filterBewegungsart) query = query.eq('bewegungsart', this.filterBewegungsart);
    const { data } = await query;
    this.witronBewegungen.set(data ?? []);
    this.laden.set(false);
  }

  readonly zeitleiste = computed<ZeitleistenEintrag[]>(() => {
    const meldungen = this.filterOrt
      ? this.svc.meldungen().filter(m => m.ort_id === this.filterOrt)
      : this.svc.meldungen();

    const eintraege: ZeitleistenEintrag[] = [];

    for (const m of meldungen.slice(0, 100)) {
      eintraege.push({ typ: 'bruch', zeitstempel: m.zeitstempel_erfassung!, meldung: m });

      // Nächste Witron-Bewegungen am selben Ort
      const nahe = this.witronBewegungen()
        .filter(b => b.ort_id === m.ort_id && b.zeitstempel)
        .map(b => ({
          b,
          abstand: Math.abs(new Date(b.zeitstempel!).getTime() - new Date(m.zeitstempel_erfassung!).getTime()),
        }))
        .filter(x => x.abstand < 60 * 60 * 1000) // innerhalb 1 Stunde
        .sort((a, b) => a.abstand - b.abstand)
        .slice(0, 3);

      for (const { b, abstand } of nahe) {
        eintraege.push({
          typ: 'witron',
          zeitstempel: b.zeitstempel!,
          bewegung: b,
          abstandMinuten: Math.round(abstand / 60000),
        });
      }
    }

    return eintraege.sort((a, b) => new Date(b.zeitstempel).getTime() - new Date(a.zeitstempel).getTime());
  });
}
