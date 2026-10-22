import { Icona } from "./icone"
import type { Oggetto } from "./oggetti"
import { paletteOggetti } from "./paletteOggetti"
import type { Dotazioni } from "../types"

export const TIPO_DRAG = "application/x-casa-oggetto"

// Tessere minimal: clic per attivare/disattivare, oppure trascina sul palco 3D.
export function Palette({
  dotazioni, onScegli, onTrascinaInizio, onTrascinaFine,
}: {
  dotazioni: Dotazioni
  onScegli: (o: Oggetto, attiva: boolean) => void
  onTrascinaInizio: () => void
  onTrascinaFine: () => void
}) {
  return (
    <div className="palette">
      {paletteOggetti(dotazioni).map((g) => (
        <div key={g.id} className="palette-gruppo">
          <span className="palette-titolo">{g.titolo}</span>
          <div className="palette-tessere">
            {g.opzioni.map((o) => (
              <button
                key={o.oggetto}
                type="button"
                className={`tessera${o.attiva ? " tessera--attiva" : ""}`}
                draggable
                aria-pressed={o.attiva}
                title={`${o.etichetta}${o.punti !== 0 ? ` (${o.punti > 0 ? "+" : "−"}${Math.abs(o.punti)} pt)` : ""}`}
                onClick={() => onScegli(o.oggetto, o.attiva)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(TIPO_DRAG, o.oggetto)
                  e.dataTransfer.setData("text/plain", o.oggetto)
                  e.dataTransfer.effectAllowed = "copy"
                  onTrascinaInizio()
                }}
                onDragEnd={onTrascinaFine}
              >
                <Icona oggetto={o.oggetto} />
                <span className="tessera-nome">{o.etichetta}</span>
                {o.punti > 0 && <span className="tessera-punti">+{o.punti}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
