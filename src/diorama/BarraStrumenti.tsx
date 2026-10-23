import { useEffect, useMemo } from "react"
import { store, useApp } from "../app/useApp"
import { dataset } from "../data/dataset"
import { areaEttari, impattoCiclabile, impattoParco, impattoStrada, INDUSTRIE, lunghezzaKm, STRADE } from "../engine/costanti"
import { creaTrovaComune } from "../map/vitaTerritorio"
import { èTracciabile, terminaTracciato } from "../map/tracciato"
import type { TipoIndustria, TipoInfra, TipoStrada } from "../types"

const segno = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 10) / 10).toString().replace(".", ",")}`

const OGGETTI: { id: TipoInfra; etichetta: string; icona: string; nota: string; variante?: TipoIndustria }[] = [
  { id: "parco", etichetta: "Parco", icona: "🌳", nota: "disegna l'area" },
  { id: "ciclabile", etichetta: "Pista ciclabile", icona: "🚲", nota: "traccia · per km" },
  { id: "colonnine", etichetta: "Colonnine", icona: "🔌", nota: "+2" },
  { id: "nucleare", etichetta: "Centrale nucleare", icona: "⚛️", nota: "+10 · energia pulita" },
  ...(Object.keys(INDUSTRIE) as TipoIndustria[]).map((v) => ({ id: "industria" as const, variante: v,
    etichetta: `Industria ${INDUSTRIE[v].etichetta.toLowerCase()}`, icona: "🏭", nota: segno(INDUSTRIE[v].delta) })),
  { id: "strada", etichetta: "Strada", icona: "🛣️", nota: "per tipo e km" },
]


// Palette dello scenario: gli oggetti si trascinano sulla mappa (o si scelgono e si clicca);
// le strade si tracciano punto per punto, e l'impatto dipende da tipo e lunghezza.
export function BarraStrumenti() {
  const modalita = useApp((s) => s.modalita)
  const strumento = useApp((s) => s.strumento)
  const tipoStrada = useApp((s) => s.tipoStrada)
  const tipoIndustria = useApp((s) => s.tipoIndustria)
  const bozza = useApp((s) => s.bozzaStrada)
  const st = store.getState()
  const trovaComune = useMemo(() => creaTrovaComune(dataset.comuni), [])

  useEffect(() => {
    if (modalita !== "scenario" || !èTracciabile(strumento)) return
    const tasto = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return
      const s = store.getState()
      if (e.key === "Enter") terminaTracciato(s, trovaComune)
      else if (e.key === "Escape") s.annullaBozzaStrada()
      else if (e.key === "Backspace") s.annullaUltimoPuntoStrada()
    }
    window.addEventListener("keydown", tasto)
    return () => window.removeEventListener("keydown", tasto)
  }, [modalita, strumento, trovaComune])

  const metrica = strumento === "parco"
    ? `Area ${areaEttari(bozza).toFixed(2).replace(".", ",")} ha · impatto ${segno(bozza.length >= 3 ? impattoParco(bozza) : 0)}`
    : `Lunghezza ${lunghezzaKm(bozza).toFixed(2).replace(".", ",")} km · impatto ${segno(strumento === "strada" ? impattoStrada(tipoStrada, bozza) : impattoCiclabile(bozza))}`
  const minimo = strumento === "parco" ? 3 : 2

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
                key={x.variante ?? x.id}
                draggable
                className={strumento === x.id && (!x.variante || tipoIndustria === x.variante) ? "attivo" : ""}
                title={`Trascina sulla mappa · ${x.nota}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-infra", x.id)
                  if (x.variante) e.dataTransfer.setData("application/x-variante", x.variante)
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => {
                  if (x.variante) st.setTipoIndustria(x.variante)
                  st.setStrumento(strumento === x.id && (!x.variante || tipoIndustria === x.variante) ? null : x.id)
                }}
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
          {strumento && !èTracciabile(strumento) && strumento !== "rimuovi" && (
            <p className="palette-aiuto">Clicca sulla mappa per piazzare, oppure trascina la voce dove preferisci. Non si può sopra gli edifici.</p>
          )}
          {èTracciabile(strumento) && (
            <div className="palette-strada">
              {strumento === "strada" && (
                <div className="gruppo" role="group" aria-label="Tipo di strada">
                  {(Object.keys(STRADE) as TipoStrada[]).map((t) => (
                    <button key={t} className={tipoStrada === t ? "attivo" : ""} onClick={() => st.setTipoStrada(t)}
                      title={STRADE[t].descrizione}>
                      {STRADE[t].etichetta}<small>{segno(STRADE[t].perKm)}/km</small>
                    </button>
                  ))}
                </div>
              )}
              <p className="palette-aiuto">
                {bozza.length === 0
                  ? strumento === "parco"
                    ? "Tieni premuto il tasto sinistro e disegna il contorno del parco, oppure clicca punto per punto: più è grande, più rende."
                    : "Tieni premuto il tasto sinistro e disegna il tracciato: le curve vengono addolcite. Oppure clicca punto per punto."
                  : bozza.length < minimo
                    ? `Continua a cliccare: servono almeno ${minimo} punti.`
                    : `${metrica}. Doppio clic o Invio per concludere.`}
              </p>
              {bozza.length > 0 && (
                <div className="gruppo">
                  <button disabled={bozza.length < minimo} onClick={() => terminaTracciato(store.getState(), trovaComune)}>✓ Concludi</button>
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
