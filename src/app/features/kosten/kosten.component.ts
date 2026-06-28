import { Component, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { BruchmeldungService } from '../../core/services/bruchmeldung.service';

@Component({
  selector: 'app-kosten',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DecimalPipe, PercentPipe],
  template: `
    <div class="p-6 space-y-6">
      <h2 class="text-2xl font-bold text-gray-900">Kostenauswertung</h2>

      <!-- KPI-Kacheln -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Gesamtbruchwert</p>
          <p class="mt-2 text-3xl font-bold text-red-500">
            {{ svc.gesamtWert() | currency:'EUR':'symbol':'1.2-2':'de' }}
          </p>
          @if (anteilOhnePreis() > 0) {
            <p class="text-xs text-amber-500 mt-2">
              ⚠ {{ anteilOhnePreis() | percent:'1.0-0' }} der Meldungen ohne Artikelpreis
            </p>
          }
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Ø Wert pro Meldung</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">
            {{ avgWertProMeldung() | currency:'EUR':'symbol':'1.2-2':'de' }}
          </p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Ø Wert pro Stück</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">
            {{ avgWertProStueck() | currency:'EUR':'symbol':'1.2-2':'de' }}
          </p>
        </div>
      </div>

      <!-- Vergleich Menge vs. Wert -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <!-- Top Artikel nach Wert -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <h3 class="text-sm font-semibold text-gray-700">Top Artikel nach Bruchwert</h3>
          </div>
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th class="px-4 py-3 text-left">#</th>
                <th class="px-4 py-3 text-left">Artikel</th>
                <th class="px-4 py-3 text-right">Wert</th>
                <th class="px-4 py-3 text-right">Menge</th>
                <th class="px-4 py-3 text-right">Anteil</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @if (svc.loading()) {
                <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Lade …</td></tr>
              }
              @for (a of topNachWert(); track a.ean; let i = $index) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-gray-400 text-xs">{{ i + 1 }}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-900 truncate max-w-[160px]">{{ a.name }}</div>
                    <div class="text-xs text-gray-400">{{ a.ean }}</div>
                  </td>
                  <td class="px-4 py-3 text-right font-semibold text-red-500">
                    {{ a.wert | currency:'EUR':'symbol':'1.2-2':'de' }}
                  </td>
                  <td class="px-4 py-3 text-right text-gray-600">{{ a.menge | number }}</td>
                  <td class="px-4 py-3 text-right text-gray-500">
                    {{ svc.gesamtWert() > 0 ? a.wert / svc.gesamtWert() : 0 | percent:'1.1-1' }}
                  </td>
                </tr>
              }
              @if (!svc.loading() && topNachWert().length === 0) {
                <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Keine Artikel mit Preisdaten</td></tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Vergleich: Rang nach Menge vs. Rang nach Wert -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <h3 class="text-sm font-semibold text-gray-700">Rangvergleich: Menge vs. Wert</h3>
            <p class="text-xs text-gray-400 mt-1">Pfeile zeigen Auf-/Abstieg im Wert-Ranking gegenüber Mengen-Ranking</p>
          </div>
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th class="px-4 py-3 text-left">Artikel</th>
                <th class="px-4 py-3 text-center">Rang Menge</th>
                <th class="px-4 py-3 text-center">Rang Wert</th>
                <th class="px-4 py-3 text-center">Diff</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @for (r of rangVergleich().slice(0, 15); track r.ean) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-800 truncate max-w-[160px]">{{ r.name }}</td>
                  <td class="px-4 py-3 text-center text-gray-600">{{ r.rangMenge }}</td>
                  <td class="px-4 py-3 text-center text-gray-600">{{ r.rangWert }}</td>
                  <td class="px-4 py-3 text-center font-semibold"
                    [class]="r.diff > 0 ? 'text-red-500' : r.diff < 0 ? 'text-green-600' : 'text-gray-400'">
                    {{ r.diff > 0 ? '↑ +' + r.diff : r.diff < 0 ? '↓ ' + r.diff : '–' }}
                  </td>
                </tr>
              }
              @if (!svc.loading() && rangVergleich().length === 0) {
                <tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">Keine Preisdaten vorhanden</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bruchwert nach Ort -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700">Bruchwert nach Ort</h3>
        </div>
        <div class="p-5 space-y-3">
          @for (o of orteNachWert(); track o.ort_id) {
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-700 w-24 truncate">{{ o.ort_id }}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div class="h-full bg-red-400 rounded-full transition-all flex items-center justify-end pr-2"
                  [style.width.%]="svc.gesamtWert() > 0 ? (o.wert / svc.gesamtWert()) * 100 : 0">
                </div>
              </div>
              <span class="text-sm text-gray-600 w-28 text-right">
                {{ o.wert | currency:'EUR':'symbol':'1.2-2':'de' }}
              </span>
            </div>
          }
          @if (!svc.loading() && orteNachWert().length === 0) {
            <p class="text-center text-gray-400 py-8">Keine Orte mit Preisdaten</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class KostenComponent {
  readonly svc = inject(BruchmeldungService);

  readonly topNachWert = computed(() =>
    [...this.svc.artikelRanking()].filter(a => a.wert > 0).sort((a, b) => b.wert - a.wert).slice(0, 15)
  );

  readonly anteilOhnePreis = computed(() => {
    const n = this.svc.meldungen().length;
    if (n === 0) return 0;
    return this.svc.meldungen().filter(m => m.artikelpreis == null).length / n;
  });

  readonly avgWertProMeldung = computed(() => {
    const n = this.svc.anzahlMeldungen();
    return n > 0 ? this.svc.gesamtWert() / n : 0;
  });

  readonly avgWertProStueck = computed(() => {
    const m = this.svc.gesamtMenge();
    return m > 0 ? this.svc.gesamtWert() / m : 0;
  });

  readonly orteNachWert = computed(() =>
    this.svc.ortRanking().filter(o => o.wert > 0).slice(0, 15)
  );

  readonly rangVergleich = computed(() => {
    const nachMenge = this.svc.artikelRanking();
    const nachWert = [...nachMenge].filter(a => a.wert > 0).sort((a, b) => b.wert - a.wert);
    return nachWert.map((a, wertIdx) => {
      const mengeIdx = nachMenge.findIndex(m => m.ean === a.ean);
      return { ean: a.ean, name: a.name, rangMenge: mengeIdx + 1, rangWert: wertIdx + 1, diff: mengeIdx - wertIdx };
    });
  });
}
