import { useEffect, useRef, useState } from "react"
import { useApp } from "../app/useApp"
import { ProfiloAmico } from "./ProfiloAmico"
import { PROFILI_SOCIAL } from "./demo"
import { useSocial } from "./useSocial"
import "./amici.css"
import { ConfiguraProfilo } from "./ConfiguraProfilo"
import { FotoProfilo } from "./FotoProfilo"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { FotoCasa } from "../casa/FotoCasa"

export function SezioneAmici() {
  const { stato, dispatch, persistito } = useSocial()
  const [selezionato, setSelezionato] = useState<string | null>(stato.amici[0] ?? null)
  const [ricerca, setRicerca] = useState("")
  const [testo, setTesto] = useState("")
  const [avviso, setAvviso] = useState("")
  const [modificaProfilo, setModificaProfilo] = useState(false)
  const fondo = useRef<HTMLDivElement>(null)
  const casa = useApp((s) => s.casaUtente)
  const amico = PROFILI_SOCIAL.find((p) => p.id === selezionato && stato.amici.includes(p.id))
  const trovato = PROFILI_SOCIAL.find((p) => p.id.toUpperCase() === ricerca.trim().toUpperCase())
  const messaggi = amico ? stato.chat[amico.id] ?? [] : []
  useEffect(() => { fondo.current?.scrollIntoView({ block: "nearest" }) }, [selezionato, messaggi.length])

  if (!stato.nomeUtente || !casa?.nickname?.trim() || modificaProfilo) return <div className="amici-pagina"><ConfiguraProfilo stato={stato} onSave={(nomeUtente, foto) => { dispatch({ tipo: "profilo", nomeUtente, foto }); setModificaProfilo(false) }} />{!persistito && <p role="alert">Il profilo non può essere salvato nel browser.</p>}</div>

  return <div className="amici-pagina">
    <div className="amici-titolo"><div><span className="amici-eyebrow">LA TUA COMMUNITY</span><h2>Insieme, una casa alla volta.</h2><p>Aggiungi amici, scopri le loro scelte e scambia idee.</p></div><span className="amici-badge">Demo locale</span></div>
    <p className="amici-nota">Stai provando profili dimostrativi: richieste e messaggi restano in questo browser. Per comunicare tra persone e mantenere lo stesso ID su dispositivi diversi occorre collegare un account condiviso.</p>
    {!persistito && <p role="alert">Il browser non consente il salvataggio: ID e modifiche saranno disponibili solo finché questa sezione resta aperta.</p>}
    <section className="amici-identita" aria-label="Il tuo ID amico"><FotoProfilo nome={stato.nomeUtente} foto={stato.foto} /><div><strong>@{stato.nomeUtente}</strong><p>{casa.nickname}</p><p>Comune della casa: {COMUNI_VICENZA_114.find((c) => c.istat === casa.comune)?.nome ?? casa.comune}</p><p>Il tuo ID amico</p><code>{stato.id}</code><small>Resta uguale ai prossimi accessi da questo browser, finché non ne cancelli i dati.</small></div>
      <FotoCasa dotazioni={casa.dotazioni} nome={casa.nickname} />
      <button onClick={() => setModificaProfilo(true)}>Modifica profilo</button>
      <button onClick={async () => { try { await navigator.clipboard.writeText(stato.id); setAvviso("ID copiato") } catch { setAvviso("Copia manualmente l’ID visualizzato nel tuo profilo.") } }}>Copia ID</button>
    </section>
    <p role="status" className="amici-stato">{avviso}</p>
    <div className="amici-griglia"><aside className="amici-sidebar">
      <section className="amici-card"><h3>Aggiungi un amico</h3><form onSubmit={(e) => { e.preventDefault(); if (ricerca.trim().toUpperCase() === stato.id.toUpperCase()) setAvviso("Questo è il tuo ID."); else setAvviso(trovato ? "Profilo trovato." : "Nessun profilo demo con questo ID.") }}>
        <label htmlFor="ricerca-amico">Cerca per ID amico</label><div className="amici-riga"><input id="ricerca-amico" value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Es. VS-MARCO-9052" /><button type="submit">Cerca</button></div>
      </form>
      <p className="amici-suggerimento">Prova con <button className="amici-link" onClick={() => setRicerca("VS-MARCO-9052")}>VS-MARCO-9052</button></p>
      {trovato && <div className="amici-risultato"><strong>{trovato.nome}</strong><code>{trovato.id}</code>
        <button disabled={stato.amici.includes(trovato.id) || stato.inviate.includes(trovato.id) || stato.ricevute.includes(trovato.id)} onClick={() => { dispatch({ tipo: "richiedi", id: trovato.id }); setAvviso("Richiesta salvata nella demo locale.") }}>
          {stato.amici.includes(trovato.id) ? "Già amici" : stato.inviate.includes(trovato.id) ? "Richiesta inviata" : stato.ricevute.includes(trovato.id) ? "Richiesta da accettare" : "Invia richiesta"}</button></div>}
      </section>
      <section className="amici-card"><h3>Richieste ricevute <span>{stato.ricevute.length}</span></h3>
        {!stato.ricevute.length && <p>Nessuna richiesta in attesa.</p>}
        {stato.ricevute.map((id) => <div className="amici-richiesta" key={id}><strong>{PROFILI_SOCIAL.find((p) => p.id === id)?.nome}</strong><code>{id}</code><div className="amici-riga"><button onClick={() => { dispatch({ tipo: "accetta", id }); setSelezionato(id); setTesto(""); setAvviso("Amicizia accettata nella demo.") }}>Accetta</button><button className="secondario" onClick={() => dispatch({ tipo: "rifiuta", id })}>Rifiuta</button></div></div>)}
      </section>
      <section className="amici-card"><h3>Richieste inviate <span>{stato.inviate.length}</span></h3>{!stato.inviate.length && <p>Nessuna richiesta inviata.</p>}{stato.inviate.map((id) => <div key={id} className="amici-richiesta"><strong>{PROFILI_SOCIAL.find((p) => p.id === id)?.nome}</strong><small>In attesa · demo locale</small><button className="secondario" onClick={() => dispatch({ tipo: "annulla", id })}>Annulla richiesta</button></div>)}</section>
      <section className="amici-card"><h3>I tuoi amici <span>{stato.amici.length}</span></h3>{!stato.amici.length && <p>Accetta una richiesta per iniziare.</p>}{stato.amici.map((id) => <button className="amici-persona" aria-pressed={id === amico?.id} key={id} onClick={() => { setSelezionato(id); setTesto("") }}><span className="amici-avatar" aria-hidden="true">{PROFILI_SOCIAL.find((p) => p.id === id)?.nome[0]}</span><span><strong>{PROFILI_SOCIAL.find((p) => p.id === id)?.nome}</strong><small>{id}</small></span></button>)}</section>
    </aside>
    <div className="amici-dettaglio">{amico ? <><div className="amici-card"><ProfiloAmico profilo={amico} /></div>
      <section className="amici-card amici-chat" aria-label={`Chat con ${amico.nome}`}><div className="amici-chat-titolo"><h3>Chat con {amico.nome.split(" · ")[0]}</h3><small>Conversazione dimostrativa</small><button type="button" className="secondario" disabled={!messaggi.some((m) => m.mittente === stato.id && !m.visualizzatoIl)} onClick={() => dispatch({ tipo: "lettura-demo", id: amico.id })}>Simula lettura dell’amico</button><small>Pallino vuoto: non visualizzato. Pieno: visualizzato nella demo.</small></div>
        <div className="amici-messaggi" role="log" aria-label="Messaggi" aria-live="polite">{!messaggi.length && <p>Inizia la conversazione con un saluto.</p>}{messaggi.map((m) => <article key={m.id} className={`amici-messaggio ${m.mittente === stato.id ? "mio" : ""}`}><small>{m.mittente === stato.id ? "Tu" : amico.nome.split(" · ")[0]}</small><p>{m.testo}</p><time dateTime={m.creatoIl}>{new Date(m.creatoIl).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</time>{m.mittente === stato.id && <span className="amici-lettura"><span className={`amici-pallino ${m.visualizzatoIl ? "letto" : ""}`} aria-hidden="true" />{m.visualizzatoIl ? "Visualizzato" : "Non visualizzato"}</span>}</article>)}<div ref={fondo} /></div>
        <form className="amici-invio" onSubmit={(e) => { e.preventDefault(); if (!testo.trim()) return; dispatch({ tipo: "messaggio", id: amico.id, messaggio: { id: crypto.randomUUID(), mittente: stato.id, testo, creatoIl: new Date().toISOString() } }); setTesto(""); setAvviso("Messaggio salvato in locale. Nessun messaggio è stato trasmesso a persone reali.") }}><label htmlFor="messaggio-amico">Messaggio</label><textarea id="messaggio-amico" value={testo} maxLength={2000} rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!e.repeat) e.currentTarget.form?.requestSubmit() } }} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi un messaggio…" /><div className="amici-riga"><small>{testo.length}/2000</small><button disabled={!testo.trim()} type="submit">Invia messaggio demo</button></div></form>
      </section></> : <section className="amici-card"><h3>Conosci la tua community</h3><p>Seleziona un amico per vedere le sue dotazioni e aprire la chat.</p></section>}</div>
    </div>
  </div>
}
