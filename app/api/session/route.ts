import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { answers, sessions } from "../../../db/schema";

const CHOICES = ["Non lo so ancora", "Università", "ITS / IFTS", "Esperienza all’estero per imparare", "Lavoro", "Avviare una propria attività", "Altro"];
const STOP = new Set("alla alle allo agli all dalle dalla degli dello della del dell delle nel nello nella nelle sui sulle sul che chi con per tra fra come dopo prima sono essere avere anche solo tutto tutta tutti tutte quando quale quali questa questo quello quella degli miei tuo tua mio mia cio cosa gia molto poco senza ancora verso deve puoi loro come ma io il lo la i gli le un uno una e o di da in a su si mi ti ci vi non ed al ai ad se dei dagli".split(/\s+/));

function getDbOrError() {
  if (!env.DB) throw new Error("Archivio non disponibile: il database della stanza non è ancora pronto.");
  return getDb();
}
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
function termsFrom(phrases: string[]) {
  const counts = new Map<string, number>();
  for (const phrase of phrases) {
    const distinct = new Set(phrase.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]{3,}/g) ?? []);
    for (const token of distinct) if (!STOP.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 30).map(([word,count]) => ({ word, count }));
}

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return json({ error: "Codice non valido. Controlla le sei lettere mostrate." }, 400);
    const db = getDbOrError();
    const [session] = await db.select({ code: sessions.code, status: sessions.status, stage: sessions.stage, adminKey: sessions.adminKey }).from(sessions).where(eq(sessions.code, code)).limit(1);
    if (!session) return json({ error: "Non trovo questa stanza. Verifica il codice con chi conduce." }, 404);
    const rows = await db.select({ phrase: answers.phrase, choice: answers.choice }).from(answers).where(eq(answers.roomCode, code)).orderBy(desc(answers.updatedAt));
    const selections = rows.map(row => {
      try {
        const parsed = JSON.parse(row.choice) as unknown;
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [row.choice];
      } catch { return row.choice ? [row.choice] : []; }
    });
    const answeredSecond = selections.filter(selected => selected.length > 0).length;
    const choices = CHOICES.map(label => {
      const count = selections.filter(selected => selected.includes(label)).length;
      return { label, count, percent: answeredSecond ? Math.round(count * 100 / answeredSecond) : 0 };
    });
    const firstCount = rows.filter(row => row.phrase.trim().length > 0).length;
    const isConductor = request.headers.get("x-conductor-key") === session.adminKey;
    const response = { session: { code: session.code, status: session.status, stage: session.stage, count: session.stage === 1 ? firstCount : answeredSecond }, choices, answeredSecond, words: termsFrom(rows.map(row => row.phrase).filter(Boolean)) };
    return json(isConductor ? { ...response, responses: rows.filter(row => row.phrase.trim()).map(row => ({ phrase: row.phrase, choices: (() => { try { const parsed = JSON.parse(row.choice) as unknown; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : row.choice ? [row.choice] : []; } catch { return row.choice ? [row.choice] : []; } })() })) } : response);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Errore del server." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; code?: string; adminKey?: string; password?: string };
    const db = getDbOrError();
    const systemPassword = (env as typeof env & { CONDUCTOR_PASSWORD?: string }).CONDUCTOR_PASSWORD;
    if (body.action === "authorize") {
      if (!systemPassword) return json({ error: "Accesso conduttore non configurato." }, 503);
      if (body.password !== systemPassword) return json({ error: "Password non corretta." }, 403);
      return json({ authorized: true });
    }
    if (body.action === "create") {
      if (!systemPassword) return json({ error: "Accesso conduttore non configurato." }, 503);
      if (body.password !== systemPassword) return json({ error: "Password non corretta." }, 403);
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const values = new Uint8Array(6); crypto.getRandomValues(values);
      const code = [...values].map(value => alphabet[value % alphabet.length]).join("");
      const adminKey = crypto.randomUUID() + crypto.randomUUID();
      await db.insert(sessions).values({ code, adminKey, status: "open" });
      return json({ code, adminKey }, 201);
    }
    const code = body.code?.trim().toUpperCase() ?? "";
    const [session] = await db.select().from(sessions).where(eq(sessions.code, code)).limit(1);
    if (!session) return json({ error: "Stanza non trovata." }, 404);
    if (typeof body.adminKey !== "string" || body.adminKey !== session.adminKey) return json({ error: "Operazione non autorizzata." }, 403);
    if (body.action === "close" || body.action === "reopen") {
      const status = body.action === "close" ? "closed" : "open";
      await db.update(sessions).set({ status }).where(eq(sessions.code, code));
      return json({ ok: true, status });
    }
    if (body.action === "advance") {
      if (session.stage >= 2) return json({ ok: true, stage: 2 });
      await db.update(sessions).set({ stage: 2 }).where(eq(sessions.code, code));
      return json({ ok: true, stage: 2 });
    }
    if (body.action === "reset") {
      await db.delete(answers).where(eq(answers.roomCode, code));
      await db.delete(sessions).where(and(eq(sessions.code, code), eq(sessions.adminKey, body.adminKey)));
      return json({ ok: true });
    }
    return json({ error: "Azione non riconosciuta." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Errore del server." }, 500);
  }
}
