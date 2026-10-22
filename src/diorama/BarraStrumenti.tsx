import { store, useApp } from "../app/useApp"
import type { TipoInfra } from "../types"

const STRUMENTI: { id: TipoInfra | "rimuovi"; etichetta: string }[] = [
  { id: "parco", etichetta: "Parco" },
  { id: "ciclabile", etichetta: "Pista ciclabile" },
  { id: "colonnine", etichetta: "Colonnine" },
  { id: "industria", etichetta: "Industria" },
  { id: "strada", etichetta: "Strada" },
  { id: "rimuovi", etichetta: "Rimuovi" },
]

// Barra provvisoria per provare la build mode sul diorama. La palette definitiva,
// il pulsante Reset e l'interruttore Realtà/Scenario appartengono a Dev 6 (sezione Simulazione).
export function BarraStrumenti() {
  const modalita = useApp((s) => s.modalita)
  const strumento = useApp((s) => s.strumento)
  const st = store.getState()
  return (
    <div className="barra-strumenti">
      <div className="gruppo">
        <button className={modalita === "realta" ? "attivo" : ""} onClick={() => st.setModalita("realta")}>Realtà</button>
        <button className={modalita === "scenario" ? "attivo" : ""} onClick={() => st.setModalita("scenario")}>Scenario</button>
      </div>
      {modalita === "scenario" && (
        <div className="gruppo">
          {STRUMENTI.map((x) => (
            <button
              key={x.id}
              className={strumento === x.id ? "attivo" : ""}
              onClick={() => st.setStrumento(strumento === x.id ? null : x.id)}
            >
              {x.etichetta}
            </button>
          ))}
          <button onClick={() => st.resetScenario()}>Reset</button>
        </div>
      )}
    </div>
  )
}
