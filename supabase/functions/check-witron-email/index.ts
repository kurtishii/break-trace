import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PROCESSED_LABEL = "BREAKTRACE_PROCESSED";

interface EmailConfig {
  id: number;
  gmail_refresh_token: string | null;
  sender_filter: string | null;
  subject_filter: string | null;
  letzter_check: string | null;
  letzte_emails_verarbeitet: number;
  aktiv: boolean;
}

async function holeAccessToken(refreshToken: string): Promise<string> {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Token-Refresh fehlgeschlagen: " + JSON.stringify(data));
  return data.access_token;
}

async function sichereLabelId(accessToken: string): Promise<string | null> {
  // Prüfe ob Label existiert, sonst anlegen
  const listResp = await fetch(`${GMAIL_API}/users/me/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listData = await listResp.json();
  const existing = listData.labels?.find((l: { name: string; id: string }) => l.name === PROCESSED_LABEL);
  if (existing) return existing.id;

  const createResp = await fetch(`${GMAIL_API}/users/me/labels`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: PROCESSED_LABEL, labelListVisibility: "labelHide", messageListVisibility: "hide" }),
  });
  const created = await createResp.json();
  return created.id ?? null;
}

function parseCSV(text: string, mapping: Record<string, string>): Record<string, unknown>[] {
  const zeilen = text.split(/\r?\n/).filter(z => z.trim());
  if (zeilen.length < 2) return [];

  const trennzeichen = zeilen[0].includes(";") ? ";" : ",";
  const header = zeilen[0].split(trennzeichen).map(h => h.trim().replace(/^"|"$/g, ""));

  const getIdx = (feld: string) => {
    const spalte = mapping[feld] ?? feld;
    const idx = header.findIndex(h => h.toLowerCase() === spalte.toLowerCase());
    return idx;
  };

  const idxMap: Record<string, number> = {
    artikel_ean: getIdx("artikel_ean"),
    artikel_name: getIdx("artikel_name"),
    artikelpreis: getIdx("artikelpreis"),
    ort_id: getIdx("ort_id"),
    menge: getIdx("menge"),
    auftrag_nummer: getIdx("auftrag_nummer"),
    bewegungsart: getIdx("bewegungsart"),
    zeitstempel: getIdx("zeitstempel"),
    anlagenstoerung: getIdx("anlagenstoerung"),
    aktiver_auftrag: getIdx("aktiver_auftrag"),
  };

  const ergebnisse: Record<string, unknown>[] = [];
  for (let i = 1; i < zeilen.length; i++) {
    const cols = zeilen[i].split(trennzeichen).map(c => c.trim().replace(/^"|"$/g, ""));
    const ean = idxMap.artikel_ean >= 0 ? cols[idxMap.artikel_ean] : null;
    if (!ean) continue;

    const rohDaten: Record<string, string> = {};
    header.forEach((h, idx) => { rohDaten[h] = cols[idx] ?? ""; });

    ergebnisse.push({
      artikel_ean: ean,
      artikel_name: idxMap.artikel_name >= 0 ? cols[idxMap.artikel_name] || null : null,
      artikelpreis: idxMap.artikelpreis >= 0
        ? parseFloat(cols[idxMap.artikelpreis]?.replace(",", ".")) || null
        : null,
      ort_id: idxMap.ort_id >= 0 ? cols[idxMap.ort_id] || null : null,
      menge: idxMap.menge >= 0 ? parseInt(cols[idxMap.menge]) || null : null,
      auftrag_nummer: idxMap.auftrag_nummer >= 0 ? cols[idxMap.auftrag_nummer] || null : null,
      bewegungsart: idxMap.bewegungsart >= 0 ? cols[idxMap.bewegungsart] || null : null,
      zeitstempel: idxMap.zeitstempel >= 0 ? cols[idxMap.zeitstempel] || null : null,
      anlagenstoerung: idxMap.anlagenstoerung >= 0
        ? ["1", "ja", "true", "yes"].includes((cols[idxMap.anlagenstoerung] ?? "").toLowerCase())
        : false,
      aktiver_auftrag: idxMap.aktiver_auftrag >= 0 ? cols[idxMap.aktiver_auftrag] || null : null,
      roh_daten: rohDaten,
    });
  }
  return ergebnisse;
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Konfiguration laden
  const { data: config } = await supabase
    .from("email_import_config")
    .select("*")
    .eq("aktiv", true)
    .single() as { data: EmailConfig | null };

  if (!config?.gmail_refresh_token) {
    return new Response(JSON.stringify({ error: "Gmail nicht verbunden" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Spalten-Mapping laden
  const { data: mappingRows } = await supabase
    .from("witron_column_mapping")
    .select("feld_intern, spalte_excel")
    .eq("aktiv", true);
  const mapping: Record<string, string> = {};
  for (const row of mappingRows ?? []) mapping[row.feld_intern] = row.spalte_excel;

  let accessToken: string;
  try {
    accessToken = await holeAccessToken(config.gmail_refresh_token);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const labelId = await sichereLabelId(accessToken);

  // E-Mails suchen: mit CSV-Anhang, noch nicht verarbeitet
  const senderFilter = config.sender_filter ? `from:${config.sender_filter}` : "";
  const subjectFilter = config.subject_filter ? `subject:${config.subject_filter}` : "";
  const labelFilter = labelId ? `-label:${PROCESSED_LABEL}` : "";
  const query = [senderFilter, subjectFilter, "has:attachment", labelFilter]
    .filter(Boolean)
    .join(" ");

  const searchResp = await fetch(
    `${GMAIL_API}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const searchData = await searchResp.json();
  const messages: { id: string }[] = searchData.messages ?? [];

  let gesamtVerarbeitet = 0;
  let gesamtFehler = 0;

  for (const msg of messages) {
    const msgResp = await fetch(
      `${GMAIL_API}/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const msgData = await msgResp.json();

    const betreff = msgData.payload?.headers?.find((h: { name: string }) => h.name === "Subject")?.value ?? "";
    const absender = msgData.payload?.headers?.find((h: { name: string }) => h.name === "From")?.value ?? "";

    // Alle Teile rekursiv nach CSV-Anhängen durchsuchen
    const teile: { filename: string; body: { attachmentId: string; size: number } }[] = [];
    const sammleTeile = (parts: unknown[]) => {
      for (const part of parts ?? []) {
        const p = part as { filename?: string; body?: { attachmentId?: string; size?: number }; parts?: unknown[] };
        if (p.filename?.toLowerCase().endsWith(".csv") && p.body?.attachmentId) {
          teile.push(p as { filename: string; body: { attachmentId: string; size: number } });
        }
        if (p.parts) sammleTeile(p.parts);
      }
    };
    sammleTeile(msgData.payload?.parts ?? []);

    for (const teil of teile) {
      // Import-Log anlegen
      const { data: importLog } = await supabase
        .from("witron_imports")
        .insert({
          dateiname: teil.filename,
          status: "verarbeitung",
          zeilen_gesamt: 0,
          zeilen_zugeordnet: 0,
          zeilen_fehler: 0,
          quelle: "email",
          email_betreff: betreff,
          email_absender: absender,
        })
        .select()
        .single();

      try {
        // Anhang herunterladen
        const attachResp = await fetch(
          `${GMAIL_API}/users/me/messages/${msg.id}/attachments/${teil.body.attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const attachData = await attachResp.json();

        // Base64url → Text
        const csvBytes = Uint8Array.from(
          atob(attachData.data.replace(/-/g, "+").replace(/_/g, "/")),
          c => c.charCodeAt(0),
        );
        const csvText = new TextDecoder("utf-8").decode(csvBytes);

        // CSV parsen
        const zeilen = parseCSV(csvText, mapping);
        const fehler = zeilen.filter(z => !z.artikel_ean).length;
        const zugeordnet = zeilen.length - fehler;

        // Bewegungen speichern
        if (zeilen.length > 0) {
          const bewegungen = zeilen.map(z => ({ ...z, import_id: importLog?.id }));
          await supabase.from("witron_bewegungen").insert(bewegungen);

          // Bruchmeldungen anreichern (Preise)
          const preisMap = new Map<string, number>();
          for (const z of zeilen) {
            if (z.artikel_ean && z.artikelpreis != null) {
              preisMap.set(z.artikel_ean as string, z.artikelpreis as number);
            }
          }
          for (const [ean, preis] of preisMap) {
            await supabase
              .from("bruchmeldungen")
              .update({ artikelpreis: preis })
              .eq("artikel_ean", ean)
              .is("artikelpreis", null);
          }
        }

        // Import-Log aktualisieren
        await supabase
          .from("witron_imports")
          .update({
            status: fehler > 0 && zugeordnet === 0 ? "fehler" : "verarbeitet",
            zeilen_gesamt: zeilen.length,
            zeilen_zugeordnet: zugeordnet,
            zeilen_fehler: fehler,
          })
          .eq("id", importLog?.id);

        gesamtVerarbeitet++;
      } catch (err) {
        await supabase
          .from("witron_imports")
          .update({ status: "fehler", zeilen_fehler: 1 })
          .eq("id", importLog?.id);
        gesamtFehler++;
        console.error("Fehler bei Anhang:", err);
      }
    }

    // E-Mail als verarbeitet markieren
    if (labelId) {
      await fetch(`${GMAIL_API}/users/me/messages/${msg.id}/modify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ addLabelIds: [labelId] }),
      });
    }
  }

  // Letzten Check aktualisieren
  await supabase
    .from("email_import_config")
    .update({
      letzter_check: new Date().toISOString(),
      letzte_emails_verarbeitet: gesamtVerarbeitet,
    })
    .eq("id", config.id);

  const ergebnis = {
    gefundene_emails: messages.length,
    verarbeitet: gesamtVerarbeitet,
    fehler: gesamtFehler,
    zeitpunkt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(ergebnis), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
