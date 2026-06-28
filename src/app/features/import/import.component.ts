import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { WitronImport, WitronColumnMapping } from '../../core/models/witron.model';

interface ImportLog {
  id: number;
  dateiname: string;
  zeitpunkt: string;
  zeilen_gesamt: number;
  zeilen_zugeordnet: number;
  zeilen_fehler: number;
  status: string;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Witron-Import</h2>
          <p class="text-sm text-gray-500 mt-1">Excel-Reports hochladen und Bruchmeldungen anreichern</p>
        </div>
      </div>

      <!-- Status-Banner -->
      @if (letzterImport()) {
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wide font-medium">Letzter Import</p>
              <p class="text-sm font-semibold text-gray-800 mt-1">{{ letzterImport()!.dateiname }}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ letzterImport()!.zeitpunkt | date:'dd.MM.yyyy HH:mm':'':'de' }} —
                {{ letzterImport()!.zeilen_gesamt }} Zeilen verarbeitet,
                {{ letzterImport()!.zeilen_zugeordnet }} zugeordnet,
                {{ letzterImport()!.zeilen_fehler }} Fehler
              </p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium"
              [class]="letzterImport()!.status === 'verarbeitet' ? 'bg-green-100 text-green-700' :
                       letzterImport()!.status === 'fehler' ? 'bg-red-100 text-red-700' :
                       'bg-yellow-100 text-yellow-700'">
              {{ letzterImport()!.status }}
            </span>
          </div>
        </div>
      }

      <!-- Upload-Bereich -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Excel-Report hochladen</h3>

        <div
          class="border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer"
          [class]="dragOver() ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'"
          (dragover)="$event.preventDefault(); dragOver.set(true)"
          (dragleave)="dragOver.set(false)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <input #fileInput type="file" accept=".xlsx,.xls,.csv" class="hidden" (change)="onFileSelected($event)" />

          @if (importLaeuft()) {
            <div class="space-y-3">
              <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p class="text-sm text-gray-600">{{ importStatus() }}</p>
            </div>
          } @else {
            <div class="space-y-2">
              <p class="text-2xl">📥</p>
              <p class="text-sm font-medium text-gray-700">Excel-Datei hier ablegen oder klicken</p>
              <p class="text-xs text-gray-400">.xlsx, .xls, .csv — Witron-Report-Format</p>
            </div>
          }
        </div>

        @if (importErgebnis()) {
          <div class="mt-4 p-4 rounded-lg"
            [class]="importErgebnis()!.fehler > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'">
            <p class="text-sm font-semibold"
              [class]="importErgebnis()!.fehler > 0 ? 'text-yellow-700' : 'text-green-700'">
              Import abgeschlossen
            </p>
            <p class="text-xs mt-1" [class]="importErgebnis()!.fehler > 0 ? 'text-yellow-600' : 'text-green-600'">
              {{ importErgebnis()!.gesamt }} Zeilen · {{ importErgebnis()!.zugeordnet }} zugeordnet · {{ importErgebnis()!.fehler }} Fehler
            </p>
          </div>
        }
      </div>

      <!-- Spalten-Mapping -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-700">Spalten-Mapping</h3>
            <p class="text-xs text-gray-400 mt-0.5">Zuordnung der Excel-Spalten zu internen Feldern</p>
          </div>
          <button (click)="mappingSpeichern()" [disabled]="!mappingGeaendert()"
            class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Speichern
          </button>
        </div>
        <div class="divide-y divide-gray-50">
          @for (m of mapping(); track m.feld_intern) {
            <div class="px-5 py-3 flex items-center gap-4">
              <span class="text-xs font-mono text-gray-500 w-36">{{ m.feld_intern }}</span>
              <span class="text-gray-300">→</span>
              <input
                type="text"
                [value]="m.spalte_excel"
                (input)="onMappingChange(m.feld_intern, $any($event.target).value)"
                class="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span class="text-xs px-2 py-0.5 rounded-full"
                [class]="m.aktiv ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'">
                {{ m.aktiv ? 'aktiv' : 'inaktiv' }}
              </span>
            </div>
          }
          @if (mapping().length === 0) {
            <div class="px-5 py-8 text-center text-gray-400 text-sm">Lade Mapping …</div>
          }
        </div>
      </div>

      <!-- Importprotokoll -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700">Importprotokoll</h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th class="px-4 py-3 text-left">Datei</th>
              <th class="px-4 py-3 text-left">Zeitpunkt</th>
              <th class="px-4 py-3 text-right">Zeilen</th>
              <th class="px-4 py-3 text-right">Zugeordnet</th>
              <th class="px-4 py-3 text-right">Fehler</th>
              <th class="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            @for (log of importLogs(); track log.id) {
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{{ log.dateiname }}</td>
                <td class="px-4 py-3 text-gray-500">{{ log.zeitpunkt | date:'dd.MM. HH:mm':'':'de' }}</td>
                <td class="px-4 py-3 text-right">{{ log.zeilen_gesamt }}</td>
                <td class="px-4 py-3 text-right text-green-600">{{ log.zeilen_zugeordnet }}</td>
                <td class="px-4 py-3 text-right" [class]="log.zeilen_fehler > 0 ? 'text-red-500' : 'text-gray-400'">
                  {{ log.zeilen_fehler }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                    [class]="log.status === 'verarbeitet' ? 'bg-green-100 text-green-700' :
                             log.status === 'fehler' ? 'bg-red-100 text-red-700' :
                             'bg-yellow-100 text-yellow-700'">
                    {{ log.status }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Noch keine Imports durchgeführt</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ImportComponent {
  private supabase = inject(SupabaseService);

  dragOver = signal(false);
  importLaeuft = signal(false);
  importStatus = signal('');
  importErgebnis = signal<{ gesamt: number; zugeordnet: number; fehler: number } | null>(null);
  importLogs = signal<ImportLog[]>([]);
  letzterImport = signal<ImportLog | null>(null);
  mapping = signal<WitronColumnMapping[]>([]);
  mappingGeaendert = signal(false);
  private mappingUpdates = new Map<string, string>();

  constructor() {
    this.ladeImportLogs();
    this.ladeMapping();
  }

  private async ladeImportLogs() {
    const { data } = await this.supabase.client
      .from('witron_imports')
      .select('*')
      .order('zeitpunkt', { ascending: false })
      .limit(20);
    this.importLogs.set(data ?? []);
    this.letzterImport.set(data?.[0] ?? null);
  }

  private async ladeMapping() {
    const { data } = await this.supabase.client
      .from('witron_column_mapping')
      .select('*')
      .order('feld_intern');
    this.mapping.set((data as WitronColumnMapping[]) ?? []);
  }

  onMappingChange(feld: string, wert: string) {
    this.mappingUpdates.set(feld, wert);
    this.mappingGeaendert.set(true);
  }

  async mappingSpeichern() {
    for (const [feld, spalte] of this.mappingUpdates) {
      await this.supabase.client
        .from('witron_column_mapping')
        .update({ spalte_excel: spalte })
        .eq('feld_intern', feld);
    }
    this.mappingUpdates.clear();
    this.mappingGeaendert.set(false);
    await this.ladeMapping();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.verarbeiteFile(file);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.verarbeiteFile(file);
  }

  private async verarbeiteFile(file: File) {
    this.importLaeuft.set(true);
    this.importErgebnis.set(null);
    this.importStatus.set('Datei wird gelesen …');

    try {
      // Datei in Supabase Storage hochladen
      const pfad = `witron-imports/${Date.now()}-${file.name}`;
      this.importStatus.set('Datei wird hochgeladen …');
      await this.supabase.client.storage.from('witron-reports').upload(pfad, file);

      // Import-Log anlegen
      this.importStatus.set('Import wird protokolliert …');
      const { data: logEintrag } = await this.supabase.client
        .from('witron_imports')
        .insert({
          dateiname: file.name,
          status: 'ausstehend',
          zeilen_gesamt: 0,
          zeilen_zugeordnet: 0,
          zeilen_fehler: 0,
        })
        .select()
        .single();

      // CSV parsen (für .csv Dateien direkt im Browser)
      if (file.name.endsWith('.csv')) {
        await this.parseUndImportiereCsv(file, logEintrag?.id);
      } else {
        // Für .xlsx: Benutzer informieren dass serverseitige Verarbeitung nötig
        await this.supabase.client
          .from('witron_imports')
          .update({ status: 'ausstehend' })
          .eq('id', logEintrag?.id);
        this.importErgebnis.set({ gesamt: 0, zugeordnet: 0, fehler: 0 });
        this.importStatus.set('Excel-Datei hochgeladen — serverseitige Verarbeitung läuft …');
      }

      await this.ladeImportLogs();
    } catch (err: unknown) {
      this.importStatus.set('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.importLaeuft.set(false);
    }
  }

  private async parseUndImportiereCsv(file: File, importId?: number) {
    const text = await file.text();
    const zeilen = text.split('\n').filter(z => z.trim());
    if (zeilen.length < 2) return;

    const header = zeilen[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''));
    const mapping = this.mapping();

    const getIdx = (feld: string) => {
      const spalte = mapping.find(m => m.feld_intern === feld)?.spalte_excel ?? feld;
      return header.findIndex(h => h === spalte);
    };

    const idxEan = getIdx('artikel_ean');
    const idxName = getIdx('artikel_name');
    const idxPreis = getIdx('artikelpreis');
    const idxOrt = getIdx('ort_id');
    const idxMenge = getIdx('menge');
    const idxAuftrag = getIdx('auftrag_nummer');
    const idxBewegungsart = getIdx('bewegungsart');
    const idxTs = getIdx('zeitstempel');

    let zugeordnet = 0;
    let fehler = 0;
    const bewegungen = [];

    for (let i = 1; i < zeilen.length; i++) {
      try {
        const cols = zeilen[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        const ean = idxEan >= 0 ? cols[idxEan] : null;
        if (!ean) { fehler++; continue; }

        bewegungen.push({
          import_id: importId,
          artikel_ean: ean,
          artikel_name: idxName >= 0 ? cols[idxName] : null,
          artikelpreis: idxPreis >= 0 ? parseFloat(cols[idxPreis].replace(',', '.')) || null : null,
          ort_id: idxOrt >= 0 ? cols[idxOrt] : null,
          menge: idxMenge >= 0 ? parseInt(cols[idxMenge]) || null : null,
          auftrag_nummer: idxAuftrag >= 0 ? cols[idxAuftrag] : null,
          bewegungsart: idxBewegungsart >= 0 ? cols[idxBewegungsart] : null,
          zeitstempel: idxTs >= 0 ? cols[idxTs] || null : null,
          roh_daten: Object.fromEntries(header.map((h, idx) => [h, cols[idx]])),
        });
        zugeordnet++;
      } catch { fehler++; }
    }

    // Bewegungen speichern
    if (bewegungen.length > 0) {
      await this.supabase.client.from('witron_bewegungen').insert(bewegungen);
      // Bruchmeldungen anreichern (Preis per EAN)
      await this.reichereAnreicher(bewegungen);
    }

    if (importId) {
      await this.supabase.client.from('witron_imports').update({
        status: fehler > 0 && zugeordnet === 0 ? 'fehler' : 'verarbeitet',
        zeilen_gesamt: zeilen.length - 1,
        zeilen_zugeordnet: zugeordnet,
        zeilen_fehler: fehler,
      }).eq('id', importId);
    }

    this.importErgebnis.set({ gesamt: zeilen.length - 1, zugeordnet, fehler });
  }

  private async reichereAnreicher(bewegungen: Record<string, unknown>[]) {
    // Artikelpreise in Bruchmeldungen aktualisieren
    const preisMap = new Map<string, number>();
    for (const b of bewegungen) {
      if (b['artikel_ean'] && b['artikelpreis'] != null) {
        preisMap.set(b['artikel_ean'] as string, b['artikelpreis'] as number);
      }
    }
    for (const [ean, preis] of preisMap) {
      await this.supabase.client
        .from('bruchmeldungen')
        .update({ artikelpreis: preis })
        .eq('artikel_ean', ean)
        .is('artikelpreis', null);
    }
  }
}
