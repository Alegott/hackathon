import { useEffect, useMemo } from "react"
import { store, useApp } from "../app/useApp"
import { dataset } from "../data/dataset"
import { impattoStrada, lunghezzaKm, STRADE } from "../engine/costanti"
import { creaTrovaComune } from "../map/vitaTerritorio"
import { terminaStrada } from "../map/tracciato"
import type { TipoInfra, TipoStrada } from "../types"

const OGGETTI: { id: TipoInfra; etichetta: string; icona: string; nota: string }[] = [
  { id: "parco", etichetta: "Parco", icona: "🌳", nota: "+5" },
  { id: "ciclabile", etichetta: "Pista ciclabile", icona: "🚲", nota: "+3" },
  { id: "colonnine", etichetta: "Colonnine", icona: "🔌", nota: "+2" },
  { id: "nucleare", etichetta: "Centrale nucleare", icona: "⚛️", nota: "+10 · energia pulita" },
  { id: "industria", etichetta: "Industria", icona: "🏭", nota: "−12" },
  { id: "strada", etichetta: "Strada", icona: "🛣️", nota: "per tipo e km" },
]

const segno = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 10) / 10).toString().replace(".", ",")}`

// Palette dello scenario: gli oggetti si trascinano sulla mappa (o si scelgono e si clicca);
// le strade si tracciano punto per punto, e l'impatto dipende da tipo e lunghezza.
export function BarraStrumenti() {
  const modalita = useApp((s) => s.modalita)
  const strumento = useApp((s) => s.strumento)
  const tipoStrada = useApp((s) => s.tipoStrada)
  const bozza = useApp((s) => s.bozzaStrada)
  const st = store.getState()
  const trovaComune = useMemo(() => creaTrovaComune(dataset.comuni), [])

  useEffect(() => {
    if (modalita !== "scenario" || strumento !== "strada") return
    const tasto = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return
      const s = store.getState()
      if (e.key === "Enter") terminaStrada(s, trovaComune)
      else if (e.key === "Escape") s.annullaBozzaStrada()
      else if (e.key === "Backspace") s.annullaUltimoPuntoStrada()
    }
    window.addEventListener("keydown", tasto)
    return () => window.removeEventListener("keydown", tasto)
  }, [modalita, strumento, trovaComune])

  const km = lunghezzaKm(bozza)
  return (
    <div className="barra-strumenti">
      <div className="gruppo">
        <button className={modalita === "realta" ? "attivo" : ""} onClick={() => st.setModalita("realta")}>Realtà</button>
        <button className={modalita === "scenario" ? "attivo" : ""} onClick={() => st.setModalita("scenario")}>Scenario</button>
      </div>
      {modalita === "scenario" && (
        <>
          <div className="gruppo palette-scenario" role="group" aria-label="Oggetti da piazzare">
            {OGGETTI.map((x) => (
              <button
                key={x.id}
                draggable
                className={strumento === x.id ? "attivo" : ""}
                title={`Trascina sulla mappa · ${x.nota}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-infra", x.id)
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => st.setStrumento(strumento === x.id ? null : x.id)}
              >
                <span aria-hidden="true">{x.icona}</span> {x.etichetta}
                <small>{x.nota}</small>
              </button>
            ))}
            <button className={strumento === "rimuovi" ? "attivo" : ""} onClick={() => st.setStrumento(strumento === "rimuovi" ? null : "rimuovi")}>
              ✕ Rimuovi
            </button>
            <button onClick={() => st.resetScenario()}>↺ Reset</button>
          </div>
          {strumento === null && (
            <p className="palette-aiuto">Trascina un oggetto sulla mappa, dove vuoi. Puoi spostarlo ancora dopo averlo piazzato.</p>
          )}
          {strumento && strumento !== "strada" && strumento !== "rimuovi" && (
            <p className="palette-aiuto">Clicca sulla mappa per piazzare, oppure trascina la voce dove preferisci.</p>
          )}
          {strumento === "strada" && (
            <div className="palette-strada">
              <div className="gruppo" role="group" aria-label="Tipo di strada">
                {(Object.keys(STRADE) as TipoStrada[]).map((t) => (
                  <button key={t} className={tipoStrada === t ? "attivo" : ""} onClick={() => st.setTipoStrada(t)}
                    title={STRADE[t].descrizione}>
                    {STRADE[t].etichetta}<small>{segno(STRADE[t].perKm)}/km</small>
                  </button>
                ))}
              </div>
              <p className="palette-aiuto">
                {bozza.length === 0
                  ? "Tieni premuto il tasto sinistro e disegna la strada: le curve vengono addolcite. Oppure clicca punto per punto."
                  : bozza.length === 1
                    ? "Continua a cliccare: servono almeno due punti."
                    : `Lunghezza ${km.toFixed(2).replace(".", ",")} km · impatto ${segno(impattoStrada(tipoStrada, bozza))}. Doppio clic o Invio per concludere.`}
              </p>
              {bozza.length > 0 && (
                <div className="gruppo">
                  <button disabled={bozza.length < 2} onClick={() => terminaStrada(store.getState(), trovaComune)}>✓ Concludi</button>
                  <button onClick={() => st.annullaUltimoPuntoStrada()}>↶ Ultimo punto</button>
                  <button onClick={() => st.annullaBozzaStrada()}>Annulla</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
