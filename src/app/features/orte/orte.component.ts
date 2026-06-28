import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BruchmeldungService, OrtRanking } from '../../core/services/bruchmeldung.service';

@Component({
  selector: 'app-orte',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">Ortsauswertung</h2>
        <input type="text" [(ngModel)]="suche" placeholder="Ort suchen …"
          class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <!-- Heatmap -->
      @if (!svc.loading() && svc.ortRanking().length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">Bruchintensität (Top 20 Orte)</h3>
          <div class="grid grid-cols-5 md:grid-cols-10 gap-2">
            @for (o of top20(); track o.ort_id) {
              <div
                class="aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105"
                [style.background]="heatmapFarbe(o.menge)"
                [title]="o.ort_id + ': ' + o.menge + ' Stk.'"
                (click)="ausgewaehlt.set(o)"
              >
                <span class="text-[9px] font-bold text-white text-center px-1 leading-tight">{{ o.ort_id }}</span>
              </div>
            }
          </div>
          @if (ausgewaehlt()) {
            <div class="mt-4 p-4 bg-blue-50 rounded-lg text-sm">
              <strong>{{ ausgewaehlt()!.ort_id }}</strong> —
              {{ ausgewaehlt()!.menge }} Stk. Bruch,
              {{ ausgewaehlt()!.anzahlMeldungen }} Meldungen
              @if (ausgewaehlt()!.wert > 0) {
                , Wert: {{ ausgewaehlt()!.wert | currency:'EUR':'symbol':'1.2-2':'de' }}
              }
            </div>
          }
        </div>
      }

      <!-- Rangliste -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">Rangliste nach Bruchmenge</h3>
          <span class="text-xs text-gray-400">{{ gefilterteOrte().length }} Orte</span>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th class="px-4 py-3 text-left">#</th>
              <th class="px-4 py-3 text-left cursor-pointer" (click)="sortBy('ort_id')">
                Ort {{ sortFeld() === 'ort_id' ? '▼' : '' }}
              </th>
              <th class="px-4 py-3 text-right cursor-pointer" (click)="sortBy('menge')">
                Menge {{ sortFeld() === 'menge' ? '▼' : '' }}
              </th>
              <th class="px-4 py-3 text-right cursor-pointer" (click)="sortBy('wert')">
                Bruchwert {{ sortFeld() === 'wert' ? '▼' : '' }}
              </th>
              <th class="px-4 py-3 text-right">Meldungen</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            @if (svc.loading()) {
              <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Lade …</td></tr>
            } @else if (gefilterteOrte().length === 0) {
              <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Keine Orte gefunden</td></tr>
            }
            @for (o of gefilterteOrte(); track o.ort_id; let i = $index) {
              <tr class="hover:bg-gray-50 transition-colors cursor-pointer" (click)="ausgewaehlt.set(o)">
                <td class="px-4 py-3 text-gray-400 text-xs">{{ i + 1 }}</td>
                <td class="px-4 py-3 font-medium text-gray-900">{{ o.ort_id }}</td>
                <td class="px-4 py-3 text-right font-semibold text-blue-600">{{ o.menge | number }}</td>
                <td class="px-4 py-3 text-right text-gray-700">
                  @if (o.wert > 0) { {{ o.wert | currency:'EUR':'symbol':'1.2-2':'de' }} }
                  @else { <span class="text-gray-300">–</span> }
                </td>
                <td class="px-4 py-3 text-right text-gray-500">{{ o.anzahlMeldungen }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class OrteComponent {
  readonly svc = inject(BruchmeldungService);
  suche = '';
  sortFeld = signal<'menge' | 'wert' | 'ort_id'>('menge');
  ausgewaehlt = signal<OrtRanking | null>(null);

  readonly top20 = computed(() => this.svc.ortRanking().slice(0, 20));
  readonly maxMenge = computed(() => Math.max(1, ...this.svc.ortRanking().slice(0, 20).map(o => o.menge)));

  readonly gefilterteOrte = computed<OrtRanking[]>(() => {
    const s = this.suche.toLowerCase();
    const list = this.svc.ortRanking().filter(o => !s || o.ort_id.toLowerCase().includes(s));
    const feld = this.sortFeld();
    if (feld === 'ort_id') return [...list].sort((a, b) => a.ort_id.localeCompare(b.ort_id));
    return [...list].sort((a, b) => b[feld] - a[feld]);
  });

  heatmapFarbe(menge: number): string {
    const ratio = menge / this.maxMenge();
    const r = Math.round(59 + (220 - 59) * ratio);
    const g = Math.round(130 + (38 - 130) * ratio);
    const b = Math.round(246 + (38 - 246) * ratio);
    return `rgb(${r},${g},${b})`;
  }

  sortBy(feld: 'menge' | 'wert' | 'ort_id') { this.sortFeld.set(feld); }
}
