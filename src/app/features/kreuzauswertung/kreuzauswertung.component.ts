import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BruchmeldungService } from '../../core/services/bruchmeldung.service';

@Component({
  selector: 'app-kreuzauswertung',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Kreuzauswertung</h2>
          <p class="text-sm text-gray-500 mt-1">Artikel × Ort — Bruchmenge in der Schnittmenge</p>
        </div>
        <div class="flex gap-2">
          <input type="text" [(ngModel)]="filterArtikel" placeholder="Artikel filtern …"
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-blue-500 outline-none" />
          <input type="text" [(ngModel)]="filterOrt" placeholder="Ort filtern …"
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <!-- Hinweistext bei auffälligen Mustern -->
      @for (hinweis of hinweise(); track hinweis) {
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ {{ hinweis }}
        </div>
      }

      @if (svc.loading()) {
        <div class="bg-white rounded-xl p-12 text-center text-gray-400">Lade Daten …</div>
      } @else if (matrix().artikel.length === 0) {
        <div class="bg-white rounded-xl p-12 text-center text-gray-400">Keine Daten im gewählten Zeitraum</div>
      } @else {
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-auto">
          <table class="text-xs whitespace-nowrap">
            <thead>
              <tr class="bg-gray-50">
                <th class="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[200px]">
                  Artikel \ Ort
                </th>
                @for (ort of matrix().orte; track ort) {
                  <th class="px-3 py-3 text-center font-medium text-gray-600 border-b border-gray-200 min-w-[60px]">
                    {{ ort }}
                  </th>
                }
                <th class="px-3 py-3 text-center font-semibold text-gray-700 border-b border-l border-gray-200">∑</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @for (row of matrix().rows; track row.artikelName) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="sticky left-0 bg-white hover:bg-gray-50 px-4 py-2 font-medium text-gray-800 border-r border-gray-200">
                    <div class="truncate max-w-[200px]" [title]="row.artikelName">{{ row.artikelName }}</div>
                    <div class="text-gray-400 font-mono">{{ row.ean }}</div>
                  </td>
                  @for (ort of matrix().orte; track ort) {
                    <td class="px-3 py-2 text-center" [style.background]="zelleHintergrund(row.werte[ort] ?? 0, matrix().max)">
                      @if (row.werte[ort]) {
                        <span class="font-semibold" [class]="row.werte[ort] > 0 ? 'text-white' : ''">
                          {{ row.werte[ort] | number }}
                        </span>
                      } @else {
                        <span class="text-gray-200">–</span>
                      }
                    </td>
                  }
                  <td class="px-3 py-2 text-center font-bold text-gray-700 border-l border-gray-200">
                    {{ row.summe | number }}
                  </td>
                </tr>
              }
              <!-- Summenzeile -->
              <tr class="bg-gray-50 font-semibold">
                <td class="sticky left-0 bg-gray-50 px-4 py-2 border-r border-gray-200 text-gray-700">∑ Gesamt</td>
                @for (ort of matrix().orte; track ort) {
                  <td class="px-3 py-2 text-center text-gray-700">{{ matrix().ortSummen[ort] | number }}</td>
                }
                <td class="px-3 py-2 text-center border-l border-gray-200 text-blue-600">
                  {{ svc.gesamtMenge() | number }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class KreuzauswertungComponent {
  readonly svc = inject(BruchmeldungService);
  filterArtikel = '';
  filterOrt = '';

  readonly matrix = computed(() => {
    const fa = this.filterArtikel.toLowerCase();
    const fo = this.filterOrt.toLowerCase();

    // Alle Meldungen gruppieren
    const map = new Map<string, { ean: string; name: string; orte: Map<string, number> }>();
    const orteSet = new Set<string>();

    for (const m of this.svc.meldungen()) {
      if (fo && !m.ort_id.toLowerCase().includes(fo)) continue;
      if (fa && !m.artikel_name.toLowerCase().includes(fa) && !m.artikel_ean.includes(fa)) continue;

      orteSet.add(m.ort_id);
      if (!map.has(m.artikel_ean)) {
        map.set(m.artikel_ean, { ean: m.artikel_ean, name: m.artikel_name, orte: new Map() });
      }
      const entry = map.get(m.artikel_ean)!;
      entry.orte.set(m.ort_id, (entry.orte.get(m.ort_id) ?? 0) + m.menge);
    }

    const orte = [...orteSet].sort();
    const ortSummen: Record<string, number> = {};
    orte.forEach(o => { ortSummen[o] = 0; });

    let max = 0;
    const rows = [...map.values()]
      .map(a => {
        const werte: Record<string, number> = {};
        let summe = 0;
        a.orte.forEach((v, k) => {
          werte[k] = v;
          summe += v;
          ortSummen[k] = (ortSummen[k] ?? 0) + v;
          if (v > max) max = v;
        });
        return { ean: a.ean, artikelName: a.name, werte, summe };
      })
      .sort((a, b) => b.summe - a.summe)
      .slice(0, 50); // Max 50 Artikel für Lesbarkeit

    return { artikel: [...map.keys()], orte, rows, max, ortSummen };
  });

  readonly hinweise = computed<string[]>(() => {
    const tips: string[] = [];
    for (const row of this.matrix().rows.slice(0, 10)) {
      const orte = Object.entries(row.werte);
      if (orte.length === 0) continue;
      const [topOrt, topMenge] = orte.sort((a, b) => b[1] - a[1])[0];
      const anteil = topMenge / row.summe;
      if (anteil >= 0.9 && row.summe >= 10) {
        tips.push(`"${row.artikelName}" bricht zu ${Math.round(anteil * 100)} % am Ort ${topOrt} → mögliches Ortsproblem.`);
      }
    }
    return tips;
  });

  zelleHintergrund(wert: number, max: number): string {
    if (!wert || max === 0) return '';
    const intensity = wert / max;
    const r = Math.round(59 + (220 - 59) * intensity);
    const g = Math.round(130 + (38 - 130) * intensity);
    const b = Math.round(246 + (38 - 246) * intensity);
    return `rgb(${r},${g},${b})`;
  }
}
