import { useEffect } from "react"
import { dataset } from "../data/dataset"
import { store, useApp } from "../app/useApp"
import { schedaImpatto, type Effetto } from "../engine/schede"

const segno = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 10) / 10).toString().replace(".", ",")}`

function Livello({ livello }: { livello: Effetto["livello"] }) {
  const buono = livello > 0
  return (
    <span className={`scheda-livello ${buono ? "scheda-livello--buono" : livello < 0 ? "scheda-livello--cattivo" : ""}`}
      role="img" aria-label={`${buono ? "positivo" : livello < 0 ? "negativo" : "neutro"}, livello ${Math.abs(livello)} su 3`}>
      {[1, 2, 3].map((i) => <i key={i} className={Math.abs(livello) >= i ? "acceso" : ""} />)}
    </span>
  )
}

// Riquadro con effetti, pro e contro di un'infrastruttura toccata sulla mappa (modello indicativo).
export function SchedaImpatto({ id, x, y, larghezza, altezza, onChiudi }: {
  id: string; x: number; y: number; larghezza: number; altezza: number; onChiudi(): void
}) {
  const scenario = useApp((s) => s.scenario)
  const oggetto = scenario.aggiunte.find((a) => a.id === id) ?? dataset.infrastrutture.find((i) => i.id === id)
  const rimossa = scenario.rimozioni.includes(id)
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi() }
    window.addEventListener("keydown", tasto)
    return () => window.removeEventListener("keydown", tasto)
  }, [onChiudi])
  if (!oggetto || rimossa) return null
  const s = schedaImpatto(oggetto)
  const left = Math.max(8, Math.min(x + 16, larghezza - 336))
  const top = Math.max(8, Math.min(y - 24, altezza - 508))
  return (
    <aside className="scheda-impatto" style={{ left, top }} aria-label={`Impatto: ${s.titolo}`}>
      <header>
        <span className="scheda-icona" aria-hidden="true">{s.icona}</span>
        <div>
          <strong>{s.titolo}</strong>
          <small>{s.dettaglio}</small>
        </div>
        <span className={`scheda-punti ${s.impatto >= 0 ? "scheda-punti--su" : "scheda-punti--giu"}`}>{segno(s.impatto)}</span>
        <button type="button" className="scheda-chiudi" aria-label="Chiudi" onClick={onChiudi}>✕</button>
      </header>
      <ul className="scheda-effetti">
        {s.effetti.map((f) => (
          <li key={f.ambito}>
            <span className="scheda-ambito">{f.ambito}</span>
            <Livello livello={f.livello} />
            <span className="scheda-testo">{f.testo}</span>
          </li>
        ))}
      </ul>
      <div className="scheda-colonne">
        <div>
          <h4>Per la comunità</h4>
          <ul>{s.pro.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div>
          <h4>Da considerare</h4>
          <ul>{s.contro.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <footer>
        <small>Stima qualitativa, modello semplificato.</small>
        <button type="button" onClick={() => { store.getState().rimuoviInfrastruttura(id); onChiudi() }}>Rimuovi</button>
      </footer>
    </aside>
  )
}
