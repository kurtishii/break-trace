import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { WitronColumnMapping } from '../../core/models/witron.model';

interface ImportLog {
  id: number;
  dateiname: string;
  zeitpunkt: string;
  zeilen_gesamt: number;
  zeilen_zugeordnet: number;
  zeilen_fehler: number;
  status: string;
  quelle: string;
  email_absender: string | null;
}

interface EmailConfig {
  id: number;
  gmail_email: string | null;
  sender_filter: string | null;
  subject_filter: string | null;
  aktiv: boolean;
  letzter_check: string | null;
  letzte_emails_verarbeitet: number;
  gmail_refresh_token: string | null;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Witron-Import</h2>
          <p class="text-sm text-gray-500 mt-1">Automatischer E-Mail-Import + manueller Upload</p>
        </div>
      </div>

      <!-- ===== E-MAIL AUTOMATIK ===== -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-700">Automatischer E-Mail-Import</h3>
            <p class="text-xs text-gray-400 mt-0.5">Witron schickt CSV per Mail → App verarbeitet automatisch 2× täglich (07:00 + 17:00)</p>
          </div>
          <span class="px-2 py-1 rounded-full text-xs font-medium"
            [class]="emailConfig()?.gmail_refresh_token ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
            {{ emailConfig()?.gmail_refresh_token ? 'Verbunden' : 'Nicht verbunden' }}
          </span>
        </div>

        <div class="p-5 space-y-5">

          <!-- Status wenn verbunden -->
          @if (emailConfig()?.gmail_refresh_token) {
            <div class="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
              <div class="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-lg flex-shrink-0">✓</div>
              <div class="flex-1">
                <p class="text-sm font-medium text-green-800">Gmail verbunden: {{ emailConfig()!.gmail_email }}</p>
                <p class="text-xs text-green-600 mt-0.5">
                  @if (emailConfig()!.letzter_check) {
                    Letzter Check: {{ emailConfig()!.letzter_check | date:'dd.MM.yyyy HH:mm':'':'de' }}
                    — {{ emailConfig()!.letzte_emails_verarbeitet }} E-Mail(s) verarbeitet
                  } @else {
                    Noch kein automatischer Check durchgeführt
                  }
                </p>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button (click)="jetztPruefen()" [disabled]="pruefeGerade()"
                  class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {{ pruefeGerade() ? 'Prüft …' : 'Jetzt prüfen' }}
                </button>
                <button (click)="verbindungTrennen()"
                  class="px-3 py-1.5 text-red-500 border border-red-200 text-xs rounded-lg hover:bg-red-50 transition-colors">
                  Trennen
                </button>
              </div>
            </div>

            @if (pruefErgebnis()) {
              <p class="text-sm px-1"
                [class]="pruefErgebnis()!.startsWith('Fehler') ? 'text-red-600' : 'text-green-600'">
                {{ pruefErgebnis() }}
              </p>
            }

            <!-- Filter bearbeiten -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Betreff-Filter</label>
                <div class="flex gap-2">
                  <input type="text" [(ngModel)]="filterBetreff"
                    class="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <button (click)="filterSpeichern()"
                    class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200">
                    OK
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Absender-Filter (leer = alle)</label>
                <input type="text" [(ngModel)]="filterAbsender"
                  class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          }

          <!-- Gmail verbinden -->
          @if (!emailConfig()?.gmail_refresh_token) {
            <div class="space-y-4">
              <div class="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800 space-y-2">
                <p class="font-semibold">Einrichtung in 3 Schritten:</p>
                <ol class="list-decimal list-inside space-y-1 text-blue-700 text-xs">
                  <li>Erstelle ein dediziertes Gmail-Konto (z.B. <code>breaktrace-import&#64;gmail.com</code>)</li>
                  <li>Konfiguriere Witron so, dass er den CSV-Export an diese Adresse schickt</li>
                  <li>Gib die Gmail-Zugangsdaten unten ein — die App prüft das Postfach täglich 07:00 + 17:00 Uhr</li>
                </ol>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Gmail-Adresse (wird überwacht)</label>
                  <input type="email" [(ngModel)]="neueKonfig.gmail_email" placeholder="breaktrace-import&#64;gmail.com"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Betreff-Filter</label>
                  <input type="text" [(ngModel)]="neueKonfig.subject_filter" placeholder="Witron"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Absender-Filter (optional, z.B. witron&#64;firma.de)</label>
                  <input type="text" [(ngModel)]="neueKonfig.sender_filter" placeholder="Alle Absender akzeptieren"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div class="border-t border-gray-100 pt-4 space-y-3">
                <p class="text-xs text-gray-500">
                  Google OAuth2 Zugangsdaten — einmalig über die
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-blue-600 underline">
                    Google Cloud Console
                  </a> anlegen (Gmail API aktivieren, OAuth2 Client erstellen, Refresh Token generieren).
                </p>
                <input type="text" [(ngModel)]="neueKonfig.client_id"
                  placeholder="Google Client ID"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="password" [(ngModel)]="neueKonfig.client_secret"
                  placeholder="Google Client Secret"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" [(ngModel)]="neueKonfig.refresh_token"
                  placeholder="OAuth2 Refresh Token"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                <button (click)="gmailVerbinden()"
                  [disabled]="!neueKonfig.gmail_email || !neueKonfig.refresh_token || verbindeGerade()"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  {{ verbindeGerade() ? 'Verbinde …' : 'Gmail verbinden' }}
                </button>
                @if (verbindeFehler()) {
                  <p class="text-sm text-red-600">{{ verbindeFehler() }}</p>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- ===== MANUELLER UPLOAD ===== -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Manueller Upload</h3>
        <div class="border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer"
          [class]="dragOver() ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'"
          (dragover)="$event.preventDefault(); dragOver.set(true)"
          (dragleave)="dragOver.set(false)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()">
          <input #fileInput type="file" accept=".csv" class="hidden" (change)="onFileSelected($event)" />
          @if (importLaeuft()) {
            <div class="space-y-3">
              <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p class="text-sm text-gray-600">{{ importStatus() }}</p>
            </div>
          } @else {
            <div class="space-y-2">
              <p class="text-2xl">📥</p>
              <p class="text-sm font-medium text-gray-700">CSV-Datei ablegen oder klicken</p>
              <p class="text-xs text-gray-400">Witron-Report als CSV (Semikolon- oder Komma-getrennt)</p>
            </div>
          }
        </div>
        @if (importErgebnis()) {
          <div class="mt-4 p-4 rounded-lg"
            [class]="importErgebnis()!.fehler > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'">
            <p class="text-sm font-semibold" [class]="importErgebnis()!.fehler > 0 ? 'text-yellow-700' : 'text-green-700'">
              Import abgeschlossen
            </p>
            <p class="text-xs mt-1" [class]="importErgebnis()!.fehler > 0 ? 'text-yellow-600' : 'text-green-600'">
              {{ importErgebnis()!.gesamt }} Zeilen · {{ importErgebnis()!.zugeordnet }} zugeordnet · {{ importErgebnis()!.fehler }} Fehler
            </p>
          </div>
        }
      </div>

      <!-- ===== SPALTEN-MAPPING ===== -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-700">Spalten-Mapping</h3>
            <p class="text-xs text-gray-400 mt-0.5">Wie heißen die Spalten im Witron-CSV?</p>
          </div>
          <button (click)="mappingSpeichern()" [disabled]="!mappingGeaendert()"
            class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Speichern
          </button>
        </div>
        <div class="divide-y divide-gray-50">
          @for (m of mapping(); track m.feld_intern) {
            <div class="px-5 py-3 flex items-center gap-4">
              <span class="text-xs font-mono text-gray-500 w-36 flex-shrink-0">{{ m.feld_intern }}</span>
              <span class="text-gray-300">→</span>
              <input type="text" [value]="m.spalte_excel"
                (input)="onMappingChange(m.feld_intern, $any($event.target).value)"
                class="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
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

      <!-- ===== IMPORTPROTOKOLL ===== -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700">Importprotokoll</h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th class="px-4 py-3 text-left">Datei / Quelle</th>
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
                <td class="px-4 py-3 max-w-xs">
                  <p class="font-medium text-gray-800 truncate">{{ log.dateiname }}</p>
                  @if (log.quelle === 'email' && log.email_absender) {
                    <p class="text-xs text-blue-500">E-Mail von {{ log.email_absender }}</p>
                  } @else {
                    <p class="text-xs text-gray-400">Manuell hochgeladen</p>
                  }
                </td>
                <td class="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {{ log.zeitpunkt | date:'dd.MM.yy HH:mm':'':'de' }}
                </td>
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
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-400">Noch keine Imports</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ImportComponent implements OnInit {
  private supabase = inject(SupabaseService);

  emailConfig = signal<EmailConfig | null>(null);
  importLogs = signal<ImportLog[]>([]);
  mapping = signal<WitronColumnMapping[]>([]);
  dragOver = signal(false);
  importLaeuft = signal(false);
  importStatus = signal('');
  importErgebnis = signal<{ gesamt: number; zugeordnet: number; fehler: number } | null>(null);
  mappingGeaendert = signal(false);
  pruefeGerade = signal(false);
  verbindeGerade = signal(false);
  verbindeFehler = signal('');
  pruefErgebnis = signal('');

  filterBetreff = '';
  filterAbsender = '';
  private mappingUpdates = new Map<string, string>();

  neueKonfig = {
    gmail_email: '',
    subject_filter: 'Witron',
    sender_filter: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
  };

  ngOnInit() {
    this.ladeEmailConfig();
    this.ladeImportLogs();
    this.ladeMapping();
  }

  private async ladeEmailConfig() {
    const { data } = await this.supabase.client
      .from('email_import_config')
      .select('*')
      .order('id')
      .limit(1)
      .single();
    this.emailConfig.set(data);
    if (data) {
      this.filterBetreff = data.subject_filter ?? '';
      this.filterAbsender = data.sender_filter ?? '';
    }
  }

  private async ladeImportLogs() {
    const { data } = await this.supabase.client
      .from('witron_imports')
      .select('*')
      .order('id', { ascending: false })
      .limit(30);
    this.importLogs.set(data ?? []);
  }

  private async ladeMapping() {
    const { data } = await this.supabase.client
      .from('witron_column_mapping')
      .select('*')
      .order('feld_intern');
    this.mapping.set((data as WitronColumnMapping[]) ?? []);
  }

  async gmailVerbinden() {
    if (!this.neueKonfig.gmail_email || !this.neueKonfig.refresh_token) return;
    this.verbindeGerade.set(true);
    this.verbindeFehler.set('');
    try {
      const konfig = this.emailConfig();
      if (!konfig) return;
      const { error } = await this.supabase.client.from('email_import_config').update({
        gmail_email: this.neueKonfig.gmail_email,
        gmail_refresh_token: this.neueKonfig.refresh_token,
        subject_filter: this.neueKonfig.subject_filter || 'Witron',
        sender_filter: this.neueKonfig.sender_filter || null,
        aktiv: true,
      }).eq('id', konfig.id);
      if (error) throw new Error(error.message);
      await this.ladeEmailConfig();
    } catch (err: unknown) {
      this.verbindeFehler.set('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.verbindeGerade.set(false);
    }
  }

  async verbindungTrennen() {
    const konfig = this.emailConfig();
    if (!konfig) return;
    await this.supabase.client.from('email_import_config')
      .update({ gmail_refresh_token: null, gmail_email: null })
      .eq('id', konfig.id);
    await this.ladeEmailConfig();
  }

  async filterSpeichern() {
    const konfig = this.emailConfig();
    if (!konfig) return;
    await this.supabase.client.from('email_import_config').update({
      subject_filter: this.filterBetreff || 'Witron',
      sender_filter: this.filterAbsender || null,
    }).eq('id', konfig.id);
    await this.ladeEmailConfig();
  }

  async jetztPruefen() {
    this.pruefeGerade.set(true);
    this.pruefErgebnis.set('');
    try {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      const supabaseUrl = (this.supabase.client as unknown as { supabaseUrl: string }).supabaseUrl;
      const resp = await fetch(`${supabaseUrl}/functions/v1/check-witron-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: '{}',
      });
      const ergebnis = await resp.json();
      if (resp.ok) {
        this.pruefErgebnis.set(
          `${ergebnis.gefundene_emails} E-Mail(s) gefunden, ${ergebnis.verarbeitet} CSV(s) verarbeitet.`
        );
        await this.ladeImportLogs();
        await this.ladeEmailConfig();
      } else {
        this.pruefErgebnis.set('Fehler: ' + (ergebnis.error ?? 'Unbekannter Fehler'));
      }
    } catch (err: unknown) {
      this.pruefErgebnis.set('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.pruefeGerade.set(false);
    }
  }

  onMappingChange(feld: string, wert: string) {
    this.mappingUpdates.set(feld, wert);
    this.mappingGeaendert.set(true);
  }

  async mappingSpeichern() {
    for (const [feld, spalte] of this.mappingUpdates) {
      await this.supabase.client.from('witron_column_mapping').update({ spalte_excel: spalte }).eq('feld_intern', feld);
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
      const text = await file.text();
      this.importStatus.set('Daten werden verarbeitet …');
      const mapping: Record<string, string> = {};
      for (const m of this.mapping()) mapping[m.feld_intern] = m.spalte_excel;

      const { data: logEintrag } = await this.supabase.client
        .from('witron_imports')
        .insert({ dateiname: file.name, status: 'verarbeitung', zeilen_gesamt: 0, zeilen_zugeordnet: 0, zeilen_fehler: 0, quelle: 'manuell' })
        .select().single();

      const ergebnis = await this.parseUndSpeichere(text, mapping, logEintrag?.id);
      this.importErgebnis.set(ergebnis);
      await this.supabase.client.from('witron_imports').update({
        status: ergebnis.fehler > 0 && ergebnis.zugeordnet === 0 ? 'fehler' : 'verarbeitet',
        zeilen_gesamt: ergebnis.gesamt,
        zeilen_zugeordnet: ergebnis.zugeordnet,
        zeilen_fehler: ergebnis.fehler,
      }).eq('id', logEintrag?.id);
      await this.ladeImportLogs();
    } catch (err: unknown) {
      this.importStatus.set('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.importLaeuft.set(false);
    }
  }

  private async parseUndSpeichere(text: string, mapping: Record<string, string>, importId?: number) {
    const zeilen = text.split(/\r?\n/).filter(z => z.trim());
    if (zeilen.length < 2) return { gesamt: 0, zugeordnet: 0, fehler: 0 };

    const trennzeichen = zeilen[0].includes(';') ? ';' : ',';
    const header = zeilen[0].split(trennzeichen).map(h => h.trim().replace(/^"|"$/g, ''));

    const idxFuer = (feld: string) => {
      const spalte = mapping[feld] ?? feld;
      return header.findIndex(h => h.toLowerCase() === spalte.toLowerCase());
    };

    const felder = ['artikel_ean','artikel_name','artikelpreis','ort_id','menge',
                    'auftrag_nummer','bewegungsart','zeitstempel','anlagenstoerung','aktiver_auftrag'];
    const idx: Record<string, number> = {};
    felder.forEach(f => { idx[f] = idxFuer(f); });

    const bewegungen: Record<string, unknown>[] = [];
    let fehler = 0;

    for (let i = 1; i < zeilen.length; i++) {
      const cols = zeilen[i].split(trennzeichen).map(c => c.trim().replace(/^"|"$/g, ''));
      const ean = idx['artikel_ean'] >= 0 ? cols[idx['artikel_ean']] : null;
      if (!ean) { fehler++; continue; }

      const rohDaten: Record<string, string> = {};
      header.forEach((h, j) => { rohDaten[h] = cols[j] ?? ''; });

      bewegungen.push({
        import_id: importId,
        artikel_ean: ean,
        artikel_name: idx['artikel_name'] >= 0 ? cols[idx['artikel_name']] || null : null,
        artikelpreis: idx['artikelpreis'] >= 0 ? parseFloat(cols[idx['artikelpreis']]?.replace(',', '.')) || null : null,
        ort_id: idx['ort_id'] >= 0 ? cols[idx['ort_id']] || null : null,
        menge: idx['menge'] >= 0 ? parseInt(cols[idx['menge']]) || null : null,
        auftrag_nummer: idx['auftrag_nummer'] >= 0 ? cols[idx['auftrag_nummer']] || null : null,
        bewegungsart: idx['bewegungsart'] >= 0 ? cols[idx['bewegungsart']] || null : null,
        zeitstempel: idx['zeitstempel'] >= 0 ? cols[idx['zeitstempel']] || null : null,
        anlagenstoerung: idx['anlagenstoerung'] >= 0
          ? ['1','ja','true','yes'].includes((cols[idx['anlagenstoerung']] ?? '').toLowerCase()) : false,
        aktiver_auftrag: idx['aktiver_auftrag'] >= 0 ? cols[idx['aktiver_auftrag']] || null : null,
        roh_daten: rohDaten,
      });
    }

    if (bewegungen.length > 0) {
      await this.supabase.client.from('witron_bewegungen').insert(bewegungen);
      const preisMap = new Map<string, number>();
      for (const b of bewegungen) {
        if (b['artikel_ean'] && b['artikelpreis'] != null)
          preisMap.set(b['artikel_ean'] as string, b['artikelpreis'] as number);
      }
      for (const [ean, preis] of preisMap) {
        await this.supabase.client.from('bruchmeldungen')
          .update({ artikelpreis: preis }).eq('artikel_ean', ean).is('artikelpreis', null);
      }
    }

    return { gesamt: zeilen.length - 1, zugeordnet: bewegungen.length, fehler };
  }
}
