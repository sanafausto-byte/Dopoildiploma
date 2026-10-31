import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { answers, sessions } from "../../../db/schema";

const CHOICES = ["Non lo so ancora", "Università", "ITS / IFTS", "Esperienza all’estero per imparare", "Lavoro", "Avviare una propria attività", "Altro"];
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: string; participantId?: string; phrase?: string; choices?: string[]; phase?: 1 | 2 };
    const code = body.code?.trim().toUpperCase() ?? "";
    const phrase = body.phrase?.trim() ?? "";
    const participantId = body.participantId ?? "";
    const picks = Array.isArray(body.choices) ? [...new Set(body.choices)] : [];
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || !/^[\w-]{20,60}$/.test(participantId) || (body.phase !== 1 && body.phase !== 2) || (body.phase === 1 && (phrase.length < 2 || phrase.length > 220)) || (body.phase === 2 && (!picks.length || picks.some(item => !CHOICES.includes(item))))) {
      return json({ error: body.phase === 1 ? "Scrivi una risposta breve prima di inviare." : "Seleziona almeno una possibilità." }, 400);
    }
    if (!env.DB) return json({ error: "Archivio risposte non disponibile." }, 503);
    const db = getDb();
    const [session] = await db.select({ status: sessions.status, stage: sessions.stage }).from(sessions).where(eq(sessions.code, code)).limit(1);
    if (!session) return json({ error: "Stanza non trovata." }, 404);
    if (session.status !== "open") return json({ error: "La raccolta è chiusa." }, 403);
    if (session.stage !== body.phase) return json({ error: "La domanda è cambiata. Aggiorna la schermata e riprova." }, 409);
    if (body.phase === 1) {
      await db.insert(answers).values({ roomCode: code, participantId, phrase, choice: "[]" }).onConflictDoUpdate({ target: [answers.roomCode, answers.participantId], set: { phrase, choice: "[]", updatedAt: new Date().toISOString() } });
    } else {
      await db.insert(answers).values({ roomCode: code, participantId, phrase: "", choice: JSON.stringify(picks) }).onConflictDoUpdate({ target: [answers.roomCode, answers.participantId], set: { choice: JSON.stringify(picks), updatedAt: new Date().toISOString() } });
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Errore del server." }, 500);
  }
}
