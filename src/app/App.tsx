import { dataset, èMock } from "../data/dataset"
import { BarraStrumenti } from "../diorama/BarraStrumenti"
import { Legenda } from "../map/Legenda"
import { Provincia } from "../map/Provincia"
import type { Sezione } from "../store/store"
import { store, useApp, useIndici } from "./useApp"
import { coloreFascia, etichettaFascia } from "../map/fasce"

const SEZIONI: { id: Sezione; etichetta: string }[] = [
  { id: "mappa", etichetta: "Mappa" },
  { id: "casa", etichetta: "Casa" },
  { id: "simulazione", etichetta: "Simulazione" },
]

function PannelloComune() {
  const istat = useApp((s) => s.comuneSelezionato)
  const indici = useIndici()
  const c = dataset.comuni.find((x) => x.istat === istat)
  const s = istat ? indici[istat] : undefined
  if (!c || !s) return null
  const segno = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 10) / 10)}`
  return (
    <aside className="pannello-comune">
      <h2>{c.nome}</h2>
      <p>
        <span className="pallino" style={{ background: coloreFascia(s.fascia) }} />
        {etichettaFascia(s.fascia)} · <strong>{Math.round(s.totale)}</strong>/100
      </p>
      <p className="scomposizione">
        Aria reale {Math.round(s.aria)} · Infrastrutture {segno(s.infrastrutture)}
        {s.scenario !== 0 && <> · Scenario {segno(s.scenario)}</>}
      </p>
      <small>Stima da {c.nCentraline} centraline · {dataset.meta.periodoAria}</small>
      {/* TODO Dev 6: pannello completo (indice case medio, "dati dimostrativi", ecc.) */}
    </aside>
  )
}

export function App() {
  const sezione = useApp((s) => s.sezione)
  const vista = useApp((s) => s.vista)
  return (
    <div className="app">
      <header>
        <h1>Vicenza Sostenibile</h1>
        <nav>
          {SEZIONI.map((x) => (
            <button
              key={x.id}
              className={sezione === x.id ? "attivo" : ""}
              onClick={() => store.getState().setSezione(x.id)}
            >
              {x.etichetta}
            </button>
          ))}
        </nav>
        {èMock && <span className="badge-mock">dati di prova</span>}
      </header>
      <main>
        {/* La mappa resta montata per non ricaricare la scena cambiando sezione. */}
        <div className="mappa" style={{ display: sezione === "mappa" ? "block" : "none" }}>
          <Provincia />
          <Legenda />
          {vista === "comune" && (
            <button className="indietro" onClick={() => store.getState().tornaAllaProvincia()}>
              ← Torna alla provincia
            </button>
          )}
          {vista === "comune" && <BarraStrumenti />}
          <PannelloComune />
        </div>
        {sezione === "casa" && <section className="segnaposto">Sezione Casa (Dev 6): form, dashboard e classifica.</section>}
        {sezione === "simulazione" && <section className="segnaposto">Sezione Simulazione (Dev 5/6): scenario, simulatore casa e slider macro.</section>}
      </main>
    </div>
  )
}
