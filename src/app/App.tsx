import { useState } from "react"
import { dataset, èMock } from "../data/dataset"
import { BarraStrumenti } from "../diorama/BarraStrumenti"
import { Legenda } from "../map/Legenda"
import { Provincia } from "../map/Provincia"
import type { Sezione } from "../store/store"
import { store, useApp } from "./useApp"
import { useTema, type Tema } from "./tema"
import { PannelloComune } from "../ui/PannelloComune"
import { SezioneCasa } from "../ui/SezioneCasa"
import { SezioneSimulazione } from "../ui/SezioneSimulazione"

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
  const [tema, setTema] = useTema()

  const eseguiPassoDemo = (passo: number) => {
    const st = store.getState()
    setMostraRoadmap(false)
    switch (passo) {
      case 1:
        st.resetScenario()
        st.setModalita("realta")
        st.tornaAllaProvincia()
        st.setSezione("mappa")
        break
      case 2: {
        const indComune =
          dataset.infrastrutture.find((i) => i.tipo === "industria")?.comune ??
          dataset.comuni[0]?.istat ??
          "024004"
        st.selezionaComune(indComune)
        st.setSezione("mappa")
        break
      }
      case 3: {
        const indInf = dataset.infrastrutture.find((i) => i.tipo === "industria")
        const target = indInf?.comune ?? st.comuneSelezionato ?? dataset.comuni[0]?.istat
        if (target) {
          st.selezionaComune(target)
          st.setModalita("scenario")
          if (indInf) st.rimuoviInfrastruttura(indInf.id)
          const cObj = dataset.comuni.find((c) => c.istat === target)
          st.aggiungiInfrastruttura(target, "parco", cObj?.centroide ?? [500, 500])
        }
        st.setSezione("mappa")
        break
      }
      case 4:
        st.setSezione("casa")
        break
      case 5:
        st.setSezione("simulazione")
        break
      case 6:
        st.setModalita("scenario")
        st.setMacro({
          ambito: "provincia",
          pctFV: 100,
          pctSenzaGas: 0,
          pctIsolamentoBuono: 0,
        })
        st.tornaAllaProvincia()
        st.setSezione("mappa")
        break
      case 7:
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
          <button type="button" onClick={() => eseguiPassoDemo(1)} title="1. Vista provincia">
            1. Provincia
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(2)} title="2. Zoom comune industriale">
            2. Comune ind.
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(3)} title="3. −Industria +Parco">
            3. −Ind +Parco
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(4)} title="4. Casa e cosa manca">
            4. Casa
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(5)} title="5. Simulatore casa PdC+FV">
            5. Sim. Casa
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(6)} title="6. Macro 100% FV Provincia">
            6. 100% FV
          </button>
          <button type="button" onClick={() => eseguiPassoDemo(7)} title="7. Slide di roadmap">
            7. Roadmap
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
                <span className="eyebrow-tag">Step 7 Demo · Roadmap Evolutiva</span>
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
