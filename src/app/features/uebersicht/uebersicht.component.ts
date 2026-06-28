import { Component, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BruchmeldungService } from '../../core/services/bruchmeldung.service';

@Component({
  selector: 'app-uebersicht',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="p-6 space-y-6">

      <!-- Header + Zeitraumfilter -->
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">Übersicht</h2>
        <div class="flex items-center gap-2 text-sm">
          <input type="date" [(ngModel)]="vonInput" (change)="onZeitraumChange()"
            class="border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          <span class="text-gray-400">–</span>
          <input type="date" [(ngModel)]="bisInput" (change)="onZeitraumChange()"
            class="border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          @for (preset of zeitraumPresets; track preset.label) {
            <button (click)="setPreset(preset.tage)"
              class="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-600">
              {{ preset.label }}
            </button>
          }
        </div>
      </div>

      <!-- Fehler -->
      @if (svc.fehler()) {
        <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          Datenbankfehler: {{ svc.fehler() }}
        </div>
      }

      <!-- KPI-Kacheln -->
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Bruchmeldungen</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">
            @if (svc.loading()) { <span class="text-gray-300">…</span> }
            @else { {{ svc.anzahlMeldungen() | number }} }
          </p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Gesamtbruch (Stück)</p>
          <p class="mt-2 text-3xl font-bold text-blue-600">
            @if (svc.loading()) { <span class="text-gray-300">…</span> }
            @else { {{ svc.gesamtMenge() | number }} }
          </p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Bruchwert (€)</p>
          <p class="mt-2 text-3xl font-bold text-red-500">
            @if (svc.loading()) { <span class="text-gray-300">…</span> }
            @else { {{ svc.gesamtWert() | currency:'EUR':'symbol':'1.2-2':'de' }} }
          </p>
          @if (wertUnvollstaendig()) {
            <p class="text-xs text-amber-500 mt-1">⚠ Nicht alle Artikel haben einen Preis</p>
          }
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Ø Menge/Meldung</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">
            @if (svc.loading()) { <span class="text-gray-300">…</span> }
            @else { {{ durchschnittMenge() | number:'1.1-1':'de' }} }
          </p>
        </div>
      </div>

      <!-- Tagestrend -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Täglicher Bruch (Stück)</h3>
        @if (svc.loading()) {
          <div class="h-32 flex items-center justify-center text-gray-400 text-sm">Lade Daten …</div>
        } @else if (svc.tagesTrend().length === 0) {
          <div class="h-32 flex items-center justify-center text-gray-400 text-sm">Keine Daten im gewählten Zeitraum</div>
        } @else {
          <div class="flex items-end gap-1 h-32">
            @for (tag of svc.tagesTrend(); track tag.datum) {
              <div class="flex flex-col items-center flex-1 gap-1">
                <div
                  class="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600 cursor-pointer"
                  [style.height.%]="balkenHoehe(tag.menge)"
                  [title]="tag.datum + ': ' + tag.menge + ' Stk.'"
                ></div>
                <span class="text-[10px] text-gray-400 rotate-45 origin-top-left w-4">
                  {{ tag.datum.slice(5) }}
                </span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Live-Tabelle -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">Letzte Meldungen</h3>
          <span class="text-xs text-green-500 font-medium">● Live</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th class="px-4 py-3 text-left">Zeit</th>
                <th class="px-4 py-3 text-left">Mitarbeiter</th>
                <th class="px-4 py-3 text-left">Ort</th>
                <th class="px-4 py-3 text-left">Artikel</th>
                <th class="px-4 py-3 text-right">Menge</th>
                <th class="px-4 py-3 text-left">Ebene</th>
                <th class="px-4 py-3 text-right">Wert</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @if (svc.loading()) {
                <tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Lade …</td></tr>
              } @else if (svc.meldungen().length === 0) {
                <tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Keine Meldungen im gewählten Zeitraum</td></tr>
              }
              @for (m of svc.meldungen().slice(0, 50); track m.meldung_id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {{ m.zeitstempel_erfassung | date:'dd.MM. HH:mm':'':'de' }}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs">{{ m.mitarbeiter_code }}</td>
                  <td class="px-4 py-3">{{ m.ort_id }}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">{{ m.artikel_name }}</div>
                    <div class="text-xs text-gray-400">{{ m.artikel_ean }}</div>
                  </td>
                  <td class="px-4 py-3 text-right font-semibold">{{ m.menge }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      [class]="m.ebene === 'palette' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'">
                      {{ m.ebene === 'palette' ? 'Palette' : 'Stück' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right text-gray-500">
                    @if (m.artikelpreis != null) {
                      {{ m.artikelpreis * m.menge | currency:'EUR':'symbol':'1.2-2':'de' }}
                    } @else {
                      <span class="text-gray-300">–</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class UebersichtComponent {
  readonly svc = inject(BruchmeldungService);

  vonInput = this.toInputDate(this.svc.zeitraum().von);
  bisInput = this.toInputDate(this.svc.zeitraum().bis);

  readonly zeitraumPresets = [
    { label: '7 Tage', tage: 6 },
    { label: '30 Tage', tage: 29 },
    { label: '90 Tage', tage: 89 },
  ];

  readonly durchschnittMenge = computed(() => {
    const n = this.svc.anzahlMeldungen();
    return n > 0 ? this.svc.gesamtMenge() / n : 0;
  });

  readonly wertUnvollstaendig = computed(() =>
    this.svc.meldungen().some(m => m.artikelpreis == null)
  );

  readonly maxTagesmenge = computed(() =>
    Math.max(1, ...this.svc.tagesTrend().map(t => t.menge))
  );

  balkenHoehe(menge: number): number {
    return Math.round((menge / this.maxTagesmenge()) * 100);
  }

  async onZeitraumChange() {
    if (!this.vonInput || !this.bisInput) return;
    await this.svc.setZeitraum(new Date(this.vonInput), new Date(this.bisInput));
  }

  async setPreset(tage: number) {
    const bis = new Date();
    const von = new Date();
    von.setDate(von.getDate() - tage);
    this.vonInput = this.toInputDate(von);
    this.bisInput = this.toInputDate(bis);
    await this.svc.setZeitraum(von, bis);
  }

  private toInputDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
