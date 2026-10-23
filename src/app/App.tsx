import { lazy, Suspense, useState } from "react"
import { dataset, èMock } from "../data/dataset"
import { BarraStrumenti } from "../diorama/BarraStrumenti"
import { Legenda } from "../map/Legenda"
import type { Sezione } from "../store/store"
import { store, useApp } from "./useApp"
import { useTema, type Tema } from "./tema"
import { PannelloComune } from "../ui/PannelloComune"
import { SezioneCasa } from "../ui/SezioneCasa"
import { SezioneSimulazione } from "../ui/SezioneSimulazione"

const Provincia = lazy(() => import("../map/Provincia").then((m) => ({ default: m.Provincia })))
const MappaTerritorio = lazy(() => import("../map/MappaTerritorio").then((m) => ({ default: m.MappaTerritorio })))

const SEZIONI: { id: Sezione; etichetta: string }[] = [
  { id: "mappa", etichetta: "Mappa" },
  { id: "casa", etichetta: "Casa" },
  { id: "simulazione", etichetta: "Simulazione" },
]

const TEMI: { id: Tema; etichetta: string; icona: string }[] = [
  { id: "chiaro", etichetta: "chiaro", icona: "☀️" },
  { id: "scuro", etichetta: "scuro", icona: "🌙" },
  { id: "sistema", etichetta: "del sistema", icona: "💻" },
]

export function App() {
  const sezione = useApp((s) => s.sezione)
  const vista = useApp((s) => s.vista)
  const modalita = useApp((s) => s.modalita)
  const [mostraRoadmap, setMostraRoadmap] = useState(false)
  const [tipoMappa, setTipoMappa] = useState<"territorio" | "diorama">("territorio")
  const modalitaDiorama = tipoMappa === "diorama"
  const [tema, setTema] = useTema()

  const eseguiPassoDemo = (passo: number) => {
    const st = store.getState()
    setMostraRoadmap(false)
    switch (passo) {
      case 1: {
        const indComune =
          dataset.infrastrutture.find((i) => i.tipo === "industria")?.comune ??
          dataset.comuni[0]?.istat ??
          "024004"
        st.selezionaComune(indComune)
        st.setSezione("mappa")
        break
      }
      case 2:
        setMostraRoadmap(true)
        break
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Vicenza Sostenibile</h1>
        <nav aria-label="Sezioni principali">
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

        <div className="barra-demo-rapida" aria-label="Percorso rapido demo">
          <span className="barra-demo-rapida__label">Demo:</span>
          <button type="button" onClick={() => eseguiPassoDemo(1)} title="1. Zoom comune industriale">
            1. Comune ind.
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(2)} title="2. Slide di roadmap">
            2. Roadmap
          </button>
        </div>

        <div className="header-destra">
          <div className="selettore-tema" role="group" aria-label="Tema">
            {TEMI.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tema === t.id}
                aria-label={`Tema ${t.etichetta}`}
                title={`Tema ${t.etichetta}`}
                onClick={() => setTema(t.id)}
              >
                <span aria-hidden="true">{t.icona}</span>
              </button>
            ))}
          </div>
          <span className={`pill-stato-mod ${modalita === "scenario" ? "pill-stato-mod--scenario" : ""}`}>
            {modalita === "scenario" ? "🧪 Scenario" : "📍 Realtà"}
          </span>
          {èMock && <span className="badge-mock">dati di prova</span>}
        </div>
      </header>
      <main>
        {/* La mappa resta montata per non ricaricare la scena cambiando sezione. */}
        <div className="mappa" style={{ display: sezione === "mappa" ? "block" : "none" }}>
          <Suspense fallback={<div className="territorio-avviso" role="status">Preparazione della mappa…</div>}>
            {modalitaDiorama ? <Provincia /> : <MappaTerritorio apriDiorama={() => setTipoMappa("diorama")} />}
          </Suspense>
          {modalitaDiorama && (
            <button className="torna-territorio" onClick={() => { store.getState().setModalita("realta"); setTipoMappa("territorio") }}>
              ↗ Mappa reale 3D
            </button>
          )}
          <Legenda />
          {vista === "comune" && (
            <button className="indietro" onClick={() => store.getState().tornaAllaProvincia()}>
              ← Torna alla provincia
            </button>
          )}
          {vista === "comune" && <BarraStrumenti />}
          <PannelloComune />
        </div>
        {sezione === "casa" && <SezioneCasa />}
        {sezione === "simulazione" && <SezioneSimulazione />}
      </main>

      {mostraRoadmap && (
        <div
          className="modale-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titolo-roadmap"
          onClick={() => setMostraRoadmap(false)}
        >
          <div className="modale-card" onClick={(e) => e.stopPropagation()}>
            <div className="modale-card__top">
              <div>
                <span className="eyebrow-tag">Step 2 Demo · Roadmap Evolutiva</span>
                <h2 id="titolo-roadmap">Social Community &amp; Gamification Cittadina</h2>
              </div>
              <button type="button" className="btn-sec btn-sm" onClick={() => setMostraRoadmap(false)}>
                ✕ Chiudi
              </button>
            </div>
            <div className="griglia-roadmap">
              <div className="card-pannello">
                <h3>🤝 Social: Follow, Amicizie e Consigli</h3>
                <ul>
                  <li>Follow dei profili pubblici e richieste di amicizia tra vicini di comune.</li>
                  <li>Scambio di consigli pratici su installatori, incentivi e pompe di calore.</li>
                  <li>Gruppi locali per Comunità Energetiche Rinnovabili (CER).</li>
                </ul>
              </div>
              <div className="card-pannello">
                <h3>🏅 Gamification: Missioni e Badge</h3>
                <ul>
                  <li>Missioni settimanali e sfide collettive tra i 114 comuni di Vicenza.</li>
                  <li>Badge verificati per chi sale di classe energetica (es. Classe A, Zero Gas).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
