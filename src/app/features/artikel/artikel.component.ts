import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BruchmeldungService, ArtikelRanking } from '../../core/services/bruchmeldung.service';

@Component({
  selector: 'app-artikel',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">Artikelauswertung</h2>
        <input type="text" [(ngModel)]="suche" placeholder="Artikel oder EAN suchen …"
          class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <!-- Pareto-Balken -->
      @if (!svc.loading() && svc.artikelRanking().length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">Pareto-Verteilung (Top 20 Artikel)</h3>
          <div class="space-y-2">
            @for (a of top20(); track a.ean; let i = $index) {
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-400 w-5 text-right">{{ i + 1 }}</span>
                <div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div class="h-full bg-blue-500 rounded-full transition-all"
                    [style.width.%]="paretoBreite(a.menge)"></div>
                </div>
                <span class="text-xs font-medium text-gray-700 w-32 truncate">{{ a.name }}</span>
                <span class="text-xs text-gray-500 w-16 text-right">{{ a.menge | number }} Stk.</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Rangliste -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">Rangliste nach Bruchmenge</h3>
          <span class="text-xs text-gray-400">{{ gefilterteArtikel().length }} Artikel</span>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th class="px-4 py-3 text-left">#</th>
              <th class="px-4 py-3 text-left">Artikel</th>
              <th class="px-4 py-3 text-left">EAN</th>
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
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Lade …</td></tr>
            } @else if (gefilterteArtikel().length === 0) {
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Keine Artikel gefunden</td></tr>
            }
            @for (a of gefilterteArtikel(); track a.ean; let i = $index) {
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-gray-400 text-xs">{{ i + 1 }}</td>
                <td class="px-4 py-3 font-medium text-gray-900">{{ a.name }}</td>
                <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ a.ean }}</td>
                <td class="px-4 py-3 text-right font-semibold text-blue-600">{{ a.menge | number }}</td>
                <td class="px-4 py-3 text-right text-gray-700">
                  @if (a.wert > 0) { {{ a.wert | currency:'EUR':'symbol':'1.2-2':'de' }} }
                  @else { <span class="text-gray-300">–</span> }
                </td>
                <td class="px-4 py-3 text-right text-gray-500">{{ a.anzahlMeldungen }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ArtikelComponent {
  readonly svc = inject(BruchmeldungService);
  suche = '';
  sortFeld = signal<'menge' | 'wert'>('menge');

  readonly gefilterteArtikel = computed<ArtikelRanking[]>(() => {
    const s = this.suche.toLowerCase();
    const list = this.svc.artikelRanking().filter(a =>
      !s || a.name.toLowerCase().includes(s) || a.ean.includes(s)
    );
    const feld = this.sortFeld();
    return [...list].sort((a, b) => b[feld] - a[feld]);
  });

  readonly top20 = computed(() => this.svc.artikelRanking().slice(0, 20));

  readonly maxMenge = computed(() => Math.max(1, ...this.svc.artikelRanking().slice(0, 20).map(a => a.menge)));

  paretoBreite(menge: number): number {
    return Math.round((menge / this.maxMenge()) * 100);
  }

  sortBy(feld: 'menge' | 'wert') { this.sortFeld.set(feld); }
}
