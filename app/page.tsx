"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const OPTIONS = [
  "Non lo so ancora",
  "Università",
  "ITS / IFTS",
  "Esperienza all’estero per imparare",
  "Lavoro",
  "Avviare una propria attività",
  "Altro",
];

type Summary = {
  session: { code: string; status: "open" | "closed"; stage: number; count: number };
  answeredSecond: number;
  choices: { label: string; count: number; percent: number }[];
  words: { word: string; count: number }[];
  responses?: { phrase: string; choices: string[] }[];
};

async function api(path: string, body?: unknown, extraHeaders?: Record<string, string>) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Qualcosa è andato storto.");
  return data;
}

function getParticipantId() {
  let id = localStorage.getItem("diploma-participant");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("diploma-participant", id);
  }
  return id;
}

export default function Home() {
  const [view, setView] = useState<"home" | "gate" | "host" | "join" | "student">("home");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [projectionMode, setProjectionMode] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [phrase, setPhrase] = useState("");
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [submittedPhase, setSubmittedPhase] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const savedCode = sessionStorage.getItem("diploma-host-room");
    const savedKey = sessionStorage.getItem("diploma-host-key");
    if (savedCode && savedKey) { setRoom(savedCode); setAdminKey(savedKey); setView("gate"); }
  }, []);

  const refresh = useCallback(async (roomCode: string, conductorKey?: string) => {
    try {
      const data = await api(`/api/session?code=${encodeURIComponent(roomCode)}`, undefined, conductorKey ? { "x-conductor-key": conductorKey } : undefined);
      setSummary(data as Summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connessione non disponibile.");
    }
  }, []);

  useEffect(() => {
    if (!room || (view !== "host" && view !== "student")) return;
    void refresh(room, view === "host" ? adminKey : undefined);
    const timer = window.setInterval(() => void refresh(room, view === "host" ? adminKey : undefined), 2500);
    return () => window.clearInterval(timer);
  }, [room, refresh, view, adminKey]);

  async function enterConductor() {
    setBusy(true); setError("");
    try {
      if (room && adminKey) {
        await api("/api/session", { action: "authorize", password: hostPassword });
        setHostPassword(""); setView("host");
        await refresh(room, adminKey);
      } else {
        const data = await api("/api/session", { action: "create", password: hostPassword });
        sessionStorage.setItem("diploma-host-room", data.code);
        sessionStorage.setItem("diploma-host-key", data.adminKey);
        setHostPassword(""); setRoom(data.code); setAdminKey(data.adminKey); setView("host");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Password non corretta o accesso non disponibile."); }
    finally { setBusy(false); }
  }

  async function joinRoom() {
    setBusy(true); setError("");
    try {
      const data = await api(`/api/session?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      setRoom(data.session.code); setSummary(data); setView("student");
    } catch (e) { setError(e instanceof Error ? e.message : "Codice non valido."); }
    finally { setBusy(false); }
  }

  async function submitAnswer(phase: 1 | 2) {
    if (phase === 1 && !phrase.trim()) { setError("Scrivi una risposta breve prima di inviare."); return; }
    if (phase === 2 && !selectedChoices.length) { setError("Seleziona almeno una possibilità."); return; }
    setBusy(true); setError("");
    try {
      await api("/api/answer", { code: room, participantId: getParticipantId(), phase, phrase: phase === 1 ? phrase.trim() : undefined, choices: phase === 2 ? selectedChoices : undefined });
      setSubmittedPhase(phase);
    } catch (e) { setError(e instanceof Error ? e.message : "Risposta non inviata."); }
    finally { setBusy(false); }
  }

  async function hostAction(action: "close" | "reopen" | "reset" | "advance") {
    setBusy(true); setError("");
    try {
      await api("/api/session", { action, code: room, adminKey });
      if (action === "reset") { sessionStorage.removeItem("diploma-host-room"); sessionStorage.removeItem("diploma-host-key"); setRoom(""); setAdminKey(""); setSummary(null); setView("home"); return; }
      await refresh(room);
    } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); }
    finally { setBusy(false); }
  }

  const wordSizes = useMemo(() => summary?.words.slice(0, 18) ?? [], [summary]);

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#202a2a]">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <header className="mb-10 flex items-center justify-between">
          <a href="#" onClick={(e) => { e.preventDefault(); setView("home"); setRoom(""); }} className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#154d45] text-xl text-white">↗</span>
            <span><span className="block text-sm font-bold tracking-wide">ORIENTA / FUTURO</span><span className="text-xs text-[#66716c]">Una domanda alla volta</span></span>
          </a>
          <span className="hidden rounded-full border border-[#d6dbd1] px-4 py-2 text-xs font-semibold text-[#66716c] sm:inline">ATTIVITÀ ANONIMA</span>
        </header>

        {view === "home" && <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-.045em] sm:text-7xl">Dopo il diploma,<br/><em className="font-serif font-normal text-[#a96036]">che strada?</em></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#5e6964]">Fermati un momento e prova a dare forma a quello che immagini. Non serve avere già tutte le risposte: serve iniziare a farle emergere.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setView("join")} className="rounded-xl bg-[#154d45] px-6 py-4 font-semibold text-white shadow-lg shadow-[#154d45]/15 transition hover:bg-[#0e3d36]">Partecipa con un codice <span aria-hidden>→</span></button>
              <button onClick={() => setView("gate")} className="rounded-xl border border-[#bfc9c0] bg-white/60 px-6 py-4 font-semibold transition hover:bg-white">Conduco l’attività</button>
            </div>
            <p className="mt-4 text-xs text-[#78827d]">Nessun nome, nessuna registrazione. Le risposte sono mostrate in forma aggregata.</p>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#dfebe3] p-8 sm:min-h-[470px] sm:p-12">
            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full border-[1px] border-[#92b5a6]/50"/><div className="absolute -right-2 top-0 h-52 w-52 rounded-full border border-[#92b5a6]/50"/>
            <div className="relative flex h-full min-h-[300px] flex-col justify-between">
              <div className="flex justify-between text-xs font-bold uppercase tracking-[.16em] text-[#537365]"><span>IL TUO PROSSIMO PASSO</span><span>01 — 02</span></div>
              <div className="max-w-sm"><span className="mb-5 inline-flex rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#537365]">Uno spazio per orientarsi</span><p className="font-serif text-4xl leading-tight text-[#154d45] sm:text-5xl">“Non devo sapere tutto oggi. Posso cominciare da ciò che mi interessa.”</p></div>
              <div className="flex items-end justify-between"><span className="text-sm text-[#537365]">Pensa. Scegli. Condividi.</span><span className="grid h-14 w-14 place-items-center rounded-full bg-[#d18756] text-2xl text-white">✳</span></div>
            </div>
          </div>
        </section>}

        {view === "gate" && <section className="mx-auto max-w-xl rounded-3xl border border-[#e0e3db] bg-white p-7 shadow-sm sm:p-10">
          <button onClick={() => { setView("home"); setHostPassword(""); }} className="mb-8 text-sm font-semibold text-[#64716a]">← Indietro</button>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a96036]">AREA CONDUTTORE</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Accesso riservato</h1>
          <p className="mt-3 text-[#66716c]">Inserisci la password per creare o riprendere la stanza e proiettare le risposte.</p>
          <form onSubmit={e => { e.preventDefault(); void enterConductor(); }}>
            <label className="mt-8 block text-sm font-semibold">Password di sistema<input type="password" value={hostPassword} onChange={e => setHostPassword(e.target.value)} autoComplete="current-password" autoFocus className="mt-2 w-full rounded-xl border border-[#cfd7ce] bg-[#fbfcf9] px-5 py-4 text-xl tracking-[.16em] outline-none focus:border-[#154d45]" /></label>
            <button type="submit" disabled={busy || !hostPassword} className="mt-5 w-full rounded-xl bg-[#154d45] px-5 py-4 font-semibold text-white disabled:opacity-40">Accedi all’area conduttore →</button>
          </form>
        </section>}

        {view === "join" && <section className="mx-auto max-w-xl rounded-3xl border border-[#e0e3db] bg-white p-7 shadow-sm sm:p-10">
          <button onClick={() => setView("home")} className="mb-8 text-sm font-semibold text-[#64716a]">← Indietro</button><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a96036]">ENTRA NELLA STANZA</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Hai il codice?</h1><p className="mt-3 text-[#66716c]">Lo trovi proiettato o condiviso da chi conduce.</p>
          <label className="mt-8 block text-sm font-semibold">Codice della stanza<input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0,6))} onKeyDown={e => e.key === "Enter" && void joinRoom()} placeholder="ES. FIUME7" autoFocus className="mt-2 w-full rounded-xl border border-[#cfd7ce] bg-[#fbfcf9] px-5 py-4 text-2xl font-bold tracking-[.2em] outline-none focus:border-[#154d45]" /></label>
          <button onClick={() => void joinRoom()} disabled={busy || code.trim().length < 4} className="mt-5 w-full rounded-xl bg-[#154d45] px-5 py-4 font-semibold text-white disabled:opacity-40">Entra nella stanza →</button>
        </section>}

        {view === "student" && summary && <section className="mx-auto max-w-2xl">
          <div className="mb-7 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a96036]">STANZA {room}</p><h1 className="mt-2 text-3xl font-semibold">Il tuo prossimo passo</h1></div><span className="rounded-full bg-[#dfebe3] px-3 py-2 text-xs font-bold text-[#154d45]">ANONIMO</span></div>
          {submittedPhase === 2 ? <div className="rounded-3xl bg-[#154d45] p-8 text-white sm:p-12"><span className="text-4xl">✳</span><h2 className="mt-5 text-3xl font-semibold">Le tue risposte sono arrivate.</h2><p className="mt-3 max-w-md leading-7 text-white/75">Grazie. Ogni scelta è un punto di partenza, non una promessa da mantenere per sempre.</p><button onClick={() => setSubmittedPhase(null)} className="mt-7 rounded-xl bg-white px-5 py-3 font-semibold text-[#154d45]">Modifica le scelte</button></div> : summary.session.stage === 1 && submittedPhase === 1 ? <div className="rounded-3xl border border-[#d7e2d8] bg-[#e7f0e9] p-8 sm:p-10"><span className="text-3xl">✓</span><h2 className="mt-4 text-2xl font-semibold text-[#154d45]">Prima risposta inviata.</h2><p className="mt-2 leading-7 text-[#5e6964]">Aspetta: chi conduce mostrerà la seconda domanda quando sarà il momento.</p><p className="mt-5 text-sm font-semibold text-[#537365]">La schermata passerà alla domanda successiva in automatico.</p></div> : summary.session.stage === 1 ? <div className="space-y-5">
            <div className="rounded-3xl border border-[#e0e3db] bg-white p-6 sm:p-8"><p className="text-sm font-bold text-[#a96036]">01 / IMMAGINA</p><label className="mt-2 block text-xl font-semibold">Come vedi il tuo futuro dopo il diploma?</label><p className="mt-2 text-sm text-[#78827d]">Scrivi una frase, un’immagine o anche solo qualche parola. Cosa ti piacerebbe trovare nel tuo futuro?</p><textarea value={phrase} onChange={e => setPhrase(e.target.value.slice(0,220))} maxLength={220} rows={3} placeholder="Mi piacerebbe…" className="mt-5 w-full resize-none rounded-xl border border-[#cfd7ce] bg-[#fbfcf9] p-4 outline-none focus:border-[#154d45]"/><div className="mt-1 text-right text-xs text-[#87918b]">{phrase.length}/220</div></div>
            <button onClick={() => void submitAnswer(1)} disabled={busy || summary.session.status === "closed"} className="w-full rounded-xl bg-[#154d45] px-5 py-4 font-semibold text-white disabled:opacity-40">{summary.session.status === "closed" ? "La raccolta è chiusa" : "Invia la prima risposta →"}</button>
          </div> : <div className="space-y-5">
            <div className="rounded-3xl border border-[#e0e3db] bg-white p-6 sm:p-8"><p className="text-sm font-bold text-[#a96036]">02 / SCEGLI</p><p className="mt-2 text-xl font-semibold">Cosa vuoi fare dopo?</p><p className="mt-2 text-sm text-[#78827d]">Puoi selezionare tutte le possibilità che ti interessano.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{OPTIONS.map((opt,i)=><button key={opt} aria-pressed={selectedChoices.includes(opt)} onClick={()=>setSelectedChoices(current=>current.includes(opt)?current.filter(item=>item!==opt):[...current,opt])} className={`rounded-xl border p-4 text-left text-sm font-semibold transition ${selectedChoices.includes(opt)?"border-[#154d45] bg-[#e7f0e9] text-[#154d45]":"border-[#e0e3db] hover:border-[#a8b7ab]"}`}><span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full bg-[#f3f2ed] text-xs">{selectedChoices.includes(opt)?"✓":String(i+1).padStart(2,"0")}</span>{opt}</button>)}</div></div>
            <button onClick={() => void submitAnswer(2)} disabled={busy || summary.session.status === "closed"} className="w-full rounded-xl bg-[#154d45] px-5 py-4 font-semibold text-white disabled:opacity-40">{summary.session.status === "closed" ? "La raccolta è chiusa" : "Invia le mie scelte →"}</button>
          </div>}
        </section>}

        {view === "host" && summary && projectionMode && <section className="fixed inset-0 z-40 overflow-y-auto bg-[#f5f3ed] p-5 sm:p-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a96036]">LE VOSTRE IDEE · STANZA {room}</p><h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">Che futuro immaginiamo?</h1><p className="mt-3 text-[#66716c]">Risposte anonime, aggiornate in diretta.</p></div><button onClick={()=>{setProjectionMode(false); if(document.fullscreenElement) void document.exitFullscreen();}} className="rounded-xl border border-[#cfd7ce] bg-white px-4 py-3 text-sm font-semibold">Esci dalla proiezione</button></div>
            <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
              <article className="rounded-3xl border border-[#e0e3db] bg-white p-6 sm:p-9"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a96036]">DOMANDA 1</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Come vedi il tuo futuro dopo il diploma?</h2></div><span className="rounded-full bg-[#e7f0e9] px-4 py-2 text-sm font-bold text-[#154d45]">{summary.responses?.length ?? 0} risposte</span></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{summary.responses?.length ? summary.responses.map((item,i)=><div key={`${i}-${item.phrase}`} className="rounded-2xl bg-[#f5f7f2] p-5"><p className="text-lg leading-7 text-[#34423b]">“{item.phrase}”</p>{item.choices.length>0&&<p className="mt-3 text-xs font-semibold text-[#7a877f]">{item.choices.join(" · ")}</p>}</div>) : <p className="rounded-2xl bg-[#f5f7f2] p-6 text-[#78827d]">Le risposte appariranno qui man mano che arrivano.</p>}</div></article>
              <article className="rounded-3xl border border-[#e0e3db] bg-white p-6 sm:p-9"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a96036]">{summary.session.stage === 2 ? "DOMANDA 2 · RISPOSTE MULTIPLE" : "PAROLE CHE EMERGONO"}</p>{summary.session.stage === 2 ? <><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Cosa volete fare dopo?</h2><p className="mt-2 text-sm text-[#78827d]">Percentuale dei partecipanti: le risposte multiple possono superare il 100%.</p><div className="mt-7 space-y-5">{summary.choices.map(item=><div key={item.label}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium">{item.label}</span><span className="font-bold text-[#154d45]">{item.percent}% <span className="font-normal text-[#87918b]">({item.count})</span></span></div><div className="h-3 overflow-hidden rounded-full bg-[#edf0eb]"><div className="h-full rounded-full bg-[#4c9077] transition-all duration-700" style={{width:`${item.percent}%`}}/></div></div>)}</div></> : <><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Le parole del gruppo</h2><div className="mt-8 flex min-h-64 flex-wrap content-center items-center justify-center gap-x-5 gap-y-3">{wordSizes.length ? wordSizes.map((item,i)=><span key={item.word} style={{fontSize:`${Math.min(3.2,1.2+item.count*.18+(i%3)*.25)}rem`}} className={`${i%4===0?"text-[#a96036]":i%4===1?"text-[#154d45]":i%4===2?"text-[#6c8271]":"text-[#303a36]"} font-semibold`}>{item.word}</span>) : <span className="text-[#87918b]">In attesa delle prime risposte…</span>}</div></>}</article>
            </div>
          </div>
        </section>}

        {view === "host" && summary && !projectionMode && <section>
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a96036]">PANNELLO DI CONDUZIONE</p><h1 className="mt-2 text-4xl font-semibold">La stanza è pronta.</h1><p className="mt-2 text-[#66716c]">Proietta il codice: ogni partecipante entra dal proprio cellulare.</p></div><div className="rounded-2xl bg-[#154d45] px-7 py-4 text-center text-white"><span className="block text-[10px] font-bold tracking-[.2em] text-white/65">CODICE DI ACCESSO</span><strong className="mt-1 block text-4xl tracking-[.2em]">{room}</strong></div></div>
          <div className="mb-6 flex flex-wrap items-center gap-3"><span className={`rounded-full px-4 py-2 text-xs font-bold ${summary.session.status==="open"?"bg-[#dfebe3] text-[#154d45]":"bg-[#f1e4d9] text-[#875332]"}`}>{summary.session.status === "open" ? "● RACCOLTA APERTA" : "RACCOLTA CHIUSA"}</span><span className="rounded-full border border-[#d8ded6] px-4 py-2 text-xs font-semibold">{summary.session.count} risposte alla domanda {summary.session.stage}</span><button onClick={()=>{setProjectionMode(true); if(document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(()=>{});}} className="rounded-xl bg-[#154d45] px-4 py-2 text-sm font-semibold text-white">Proietta le risposte ⛶</button><button onClick={()=>void hostAction(summary.session.status==="open"?"close":"reopen")} className="ml-auto rounded-xl border border-[#cfd7ce] bg-white px-4 py-2 text-sm font-semibold">{summary.session.status==="open"?"Chiudi raccolta":"Riapri raccolta"}</button></div>
          {summary.session.stage === 1 && <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-[#154d45] p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">La seconda domanda è ancora nascosta agli studenti.</p><p className="mt-1 text-sm text-white/70">Quando vuoi, clicca qui per mostrarla a tutti i dispositivi collegati.</p></div><button disabled={busy} onClick={()=>void hostAction("advance")} className="shrink-0 rounded-xl bg-white px-5 py-3 font-bold text-[#154d45] disabled:opacity-50">Mostra la seconda domanda →</button></div>}
          {summary.session.stage === 2 && <div className="mb-6 rounded-2xl bg-[#e7f0e9] px-5 py-3 text-sm font-semibold text-[#154d45]">✓ Seconda domanda condivisa: ora gli studenti possono scegliere più opzioni.</div>}
          <div className="grid gap-5 lg:grid-cols-2"><article className="rounded-3xl border border-[#e0e3db] bg-white p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a96036]">01 / LE PAROLE DEL GRUPPO</p><h2 className="mt-2 text-2xl font-semibold">Che futuro immaginano?</h2></div><span className="text-2xl">✳</span></div><p className="mt-2 text-sm text-[#78827d]">Termini chiave estratti dalle frasi, aggiornati in tempo reale.</p><div className="mt-8 flex min-h-56 flex-wrap content-center items-center justify-center gap-x-5 gap-y-3">{wordSizes.length ? wordSizes.map((item,i)=><span key={item.word} style={{fontSize:`${Math.min(2.7,1+item.count*.14+(i%3)*.2)}rem`}} className={`${i%4===0?"text-[#a96036]":i%4===1?"text-[#154d45]":i%4===2?"text-[#6c8271]":"text-[#303a36]"} font-semibold`}>{item.word}</span>) : <span className="text-sm text-[#87918b]">Le parole compariranno qui con le prime risposte.</span>}</div><div className="mt-3 border-t border-[#edf0eb] pt-4 text-xs text-[#87918b]">Le frasi complete non vengono mostrate.</div></article>
            {summary.session.stage === 2 && <article className="rounded-3xl border border-[#e0e3db] bg-white p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a96036]">02 / DOPO IL DIPLOMA</p><h2 className="mt-2 text-2xl font-semibold">Quali strade scelgono?</h2></div><span className="text-2xl">↗</span></div><p className="mt-2 text-sm text-[#78827d]">Percentuale dei partecipanti che ha selezionato ogni opzione. Le percentuali possono superare il 100% perché si possono scegliere più risposte.</p><div className="mt-7 space-y-5">{summary.choices.map((item)=><div key={item.label}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium">{item.label}</span><span className="shrink-0 font-bold text-[#154d45]">{item.percent}% <span className="font-normal text-[#87918b]">({item.count})</span></span></div><div className="h-3 overflow-hidden rounded-full bg-[#edf0eb]"><div className="h-full rounded-full bg-[#4c9077] transition-all duration-700" style={{width:`${item.percent}%`}}/></div></div>)}</div></article>}</div>
          <div className="mt-5 rounded-2xl border border-[#e0e3db] bg-white/70 p-5 text-sm leading-6 text-[#66716c]"><strong className="text-[#34423b]">Spunto per il confronto:</strong> quali parole vi sorprendono? Quali strade sono più presenti o meno visibili? Ricordate: un’intenzione è un inizio, e può evolvere.</div>
          <button onClick={()=>{if(confirm("Vuoi azzerare la stanza e creare un nuovo codice? Le risposte raccolte saranno eliminate.")) void hostAction("reset");}} className="mt-6 text-xs font-semibold text-[#87918b] underline decoration-dotted underline-offset-4">Termina e crea una nuova partita</button>
        </section>}

        {error && <div role="alert" className="fixed bottom-5 left-1/2 z-20 w-[min(92%,520px)] -translate-x-1/2 rounded-xl bg-[#803f32] px-5 py-4 text-sm font-medium text-white shadow-xl">{error}<button onClick={()=>setError("")} className="float-right ml-3">✕</button></div>}
        <footer className="mt-16 border-t border-[#dce1d8] pt-5 text-xs text-[#87918b]">
          <p>Uno spazio per immaginare possibilità. Non serve avere già una risposta definitiva.</p>
          <div className="mt-5 flex flex-col gap-3 border-t border-[#dce1d8] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold uppercase tracking-[.12em] text-[#53625a]">App sviluppata da</p>
            <nav aria-label="Contatti e profili" className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <a className="inline-flex items-center gap-2 hover:text-[#154d45]" href="mailto:info@faustosana.it" aria-label="E-mail info@faustosana.it">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
                info@faustosana.it
              </a>
              <a className="inline-flex items-center gap-2 hover:text-[#154d45]" href="https://www.faustosana.it" target="_blank" rel="noreferrer" aria-label="Sito web faustosana.it">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
                www.faustosana.it
              </a>
              <a className="inline-flex items-center gap-2 hover:text-[#154d45]" href="https://www.linkedin.com/in/fausto-sana/?isSelfProfile=true" target="_blank" rel="noreferrer" aria-label="LinkedIn di Fausto Sana">
                <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded bg-[#0a66c2] text-[11px] font-bold text-white">in</span>
                LinkedIn
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
