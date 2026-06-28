import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BruchmeldungService } from '../../core/services/bruchmeldung.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Alarmregel } from '../../core/models/witron.model';

@Component({
  selector: 'app-berichte',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="p-6 space-y-6">
      <h2 class="text-2xl font-bold text-gray-900">Berichte & Export</h2>

      <!-- Export -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Datenexport</h3>
        <p class="text-sm text-gray-500 mb-4">
          Exportiert alle Meldungen des aktuell gewählten Zeitraums
          ({{ svc.anzahlMeldungen() }} Meldungen, {{ svc.gesamtMenge() | number }} Stk.).
        </p>
        <div class="flex gap-3">
          <button (click)="exportCsv()"
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
            CSV exportieren
          </button>
          <button (click)="exportJson()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            JSON exportieren
          </button>
        </div>
        @if (exportFeedback()) {
          <p class="mt-3 text-sm text-green-600">{{ exportFeedback() }}</p>
        }
      </div>

      <!-- Alarmregeln -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">Alarmregeln</h3>
          <button (click)="neueRegelAnzeigen.set(!neueRegelAnzeigen())"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium">
            + Neue Regel
          </button>
        </div>

        <!-- Neue Regel Formular -->
        @if (neueRegelAnzeigen()) {
          <div class="p-5 bg-blue-50 border-b border-blue-100">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input [(ngModel)]="neueRegel.name" type="text" placeholder="z.B. Tagesbruch-Alarm"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Typ</label>
                <select [(ngModel)]="neueRegel.typ"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="tagesbruch_menge">Tagesbruch Menge überschritten</option>
                  <option value="tagesbruch_wert">Tagesbruch Wert überschritten</option>
                  <option value="kein_witron_import">Kein Witron-Import seit X Stunden</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Schwellenwert</label>
                <input [(ngModel)]="neueRegel.schwellenwert" type="number" placeholder="z.B. 200"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              @if (neueRegel.typ === 'kein_witron_import') {
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Zeitfenster (Stunden)</label>
                  <input [(ngModel)]="neueRegel.zeitfenster_stunden" type="number" placeholder="z.B. 12"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              }
            </div>
            <div class="flex gap-3 mt-4">
              <button (click)="regelSpeichern()" [disabled]="!neueRegel.name"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                Speichern
              </button>
              <button (click)="neueRegelAnzeigen.set(false)"
                class="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">
                Abbrechen
              </button>
            </div>
          </div>
        }

        <!-- Regelliste -->
        <div class="divide-y divide-gray-50">
          @if (ladeRegeln()) {
            <div class="px-5 py-8 text-center text-gray-400 text-sm">Lade Alarmregeln …</div>
          } @else if (alarmregeln().length === 0) {
            <div class="px-5 py-8 text-center text-gray-400 text-sm">Noch keine Alarmregeln angelegt.</div>
          }
          @for (regel of alarmregeln(); track regel.id) {
            <div class="px-5 py-4 flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-800 text-sm">{{ regel.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ typLabel(regel.typ) }}
                  @if (regel.schwellenwert != null) { — Schwellenwert: {{ regel.schwellenwert }} }
                  @if (regel.zeitfenster_stunden != null) { — {{ regel.zeitfenster_stunden }} Stunden }
                </p>
              </div>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [checked]="regel.aktiv" (change)="regelToggle(regel)"
                    class="w-4 h-4 accent-blue-600" />
                  <span class="text-xs text-gray-500">Aktiv</span>
                </label>
                <button (click)="regelLoeschen(regel.id)"
                  class="text-xs text-red-400 hover:text-red-600">Löschen</button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Aktive Alarme -->
      @if (aktiveAlarme().length > 0) {
        <div class="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 class="text-sm font-semibold text-red-700 mb-3">Aktive Alarme</h3>
          @for (alarm of aktiveAlarme(); track alarm) {
            <div class="flex items-center gap-2 text-sm text-red-600 mb-1">
              <span>⚠</span> {{ alarm }}
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class BerichteComponent {
  readonly svc = inject(BruchmeldungService);
  private supabase = inject(SupabaseService);

  alarmregeln = signal<Alarmregel[]>([]);
  ladeRegeln = signal(true);
  neueRegelAnzeigen = signal(false);
  exportFeedback = signal('');
  neueRegel: Partial<Alarmregel> = { typ: 'tagesbruch_menge', aktiv: true };

  constructor() { this.ladeAlarmregeln(); }

  private async ladeAlarmregeln() {
    this.ladeRegeln.set(true);
    const { data } = await this.supabase.client.from('alarmregeln').select('*').order('id');
    this.alarmregeln.set(data ?? []);
    this.ladeRegeln.set(false);
  }

  async regelSpeichern() {
    if (!this.neueRegel.name) return;
    const { data } = await this.supabase.client
      .from('alarmregeln')
      .insert({ ...this.neueRegel, aktiv: true })
      .select()
      .single();
    if (data) {
      this.alarmregeln.update(list => [...list, data]);
      this.neueRegel = { typ: 'tagesbruch_menge', aktiv: true };
      this.neueRegelAnzeigen.set(false);
    }
  }

  async regelToggle(regel: Alarmregel) {
    await this.supabase.client.from('alarmregeln').update({ aktiv: !regel.aktiv }).eq('id', regel.id);
    this.alarmregeln.update(list => list.map(r => r.id === regel.id ? { ...r, aktiv: !r.aktiv } : r));
  }

  async regelLoeschen(id: number) {
    await this.supabase.client.from('alarmregeln').delete().eq('id', id);
    this.alarmregeln.update(list => list.filter(r => r.id !== id));
  }

  readonly aktiveAlarme = computed<string[]>(() => {
    const alarme: string[] = [];
    const heute = this.svc.tagesTrend().find(t => t.datum === new Date().toISOString().slice(0, 10));
    for (const regel of this.alarmregeln().filter(r => r.aktiv)) {
      if (regel.typ === 'tagesbruch_menge' && regel.schwellenwert != null && heute) {
        if (heute.menge > regel.schwellenwert) {
          alarme.push(`"${regel.name}": Tagesbruch ${heute.menge} Stk. überschreitet Schwellenwert ${regel.schwellenwert}`);
        }
      }
      if (regel.typ === 'tagesbruch_wert' && regel.schwellenwert != null && heute) {
        if (heute.wert > regel.schwellenwert) {
          alarme.push(`"${regel.name}": Tagesbruchwert ${heute.wert.toFixed(2)} € überschreitet Schwellenwert ${regel.schwellenwert} €`);
        }
      }
    }
    return alarme;
  });

  exportCsv() {
    const meldungen = this.svc.meldungen();
    if (meldungen.length === 0) return;
    const header = 'ID;Zeitstempel;Mitarbeiter;Ort;EAN;Artikel;Ebene;Menge;Preis;Wert;Status';
    const rows = meldungen.map(m =>
      [m.meldung_id, m.zeitstempel_erfassung, m.mitarbeiter_code, m.ort_id,
       m.artikel_ean, `"${m.artikel_name}"`, m.ebene, m.menge,
       m.artikelpreis ?? '', m.artikelpreis ? m.artikelpreis * m.menge : '', m.status].join(';')
    );
    this.download([header, ...rows].join('\n'), 'breaktrace-export.csv', 'text/csv;charset=utf-8;');
    this.exportFeedback.set(`${meldungen.length} Meldungen exportiert.`);
    setTimeout(() => this.exportFeedback.set(''), 3000);
  }

  exportJson() {
    const json = JSON.stringify(this.svc.meldungen(), null, 2);
    this.download(json, 'breaktrace-export.json', 'application/json');
    this.exportFeedback.set(`${this.svc.meldungen().length} Meldungen exportiert.`);
    setTimeout(() => this.exportFeedback.set(''), 3000);
  }

  private download(content: string, filename: string, type: string) {
    const blob = new Blob(['﻿' + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  typLabel(typ: string): string {
    const labels: Record<string, string> = {
      tagesbruch_menge: 'Tagesbruch Menge',
      tagesbruch_wert: 'Tagesbruch Wert',
      kein_witron_import: 'Kein Witron-Import',
    };
    return labels[typ] ?? typ;
  }
}
