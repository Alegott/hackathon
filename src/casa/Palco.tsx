import { useEffect, useRef, useState, type ReactNode } from "react"
import { punteggioCasa } from "../engine"
import { META_CLASSI } from "../ui/DashboardCasa"
import type { Dotazioni } from "../types"
import { Casa3D } from "./Casa3D"
import { èOggetto, type Oggetto } from "./oggetti"
import { TIPO_DRAG } from "./Palette"

// Numero che scorre fino al nuovo valore invece di saltare.
function useNumeroAnimato(valore: number) {
  const [mostrato, setMostrato] = useState(valore)
  const corrente = useRef(valore)
  useEffect(() => {
    let id = 0
    const passo = () => {
      const differenza = valore - corrente.current
      if (Math.abs(differenza) < 0.4) { corrente.current = valore; setMostrato(valore); return }
      corrente.current += differenza * 0.18
      setMostrato(Math.round(corrente.current))
      id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [valore])
  return mostrato
}

export function Palco({
  dotazioni, trascinando, onDrop, children,
}: {
  dotazioni: Dotazioni
  trascinando: boolean
  onDrop: (o: Oggetto) => void
  children?: ReactNode
}) {
  const { punteggio, classe } = punteggioCasa(dotazioni)
  const numero = useNumeroAnimato(punteggio)
  const meta = META_CLASSI[classe]
  const [sopra, setSopra] = useState(false)
  const precedente = useRef(punteggio)
  const [delta, setDelta] = useState<{ n: number; chiave: number } | null>(null)

  useEffect(() => {
    const d = punteggio - precedente.current
    precedente.current = punteggio
    if (d === 0) return
    const chiave = Date.now()
    setDelta({ n: d, chiave })
    const t = setTimeout(() => setDelta((x) => (x?.chiave === chiave ? null : x)), 1600)
    return () => clearTimeout(t)
  }, [punteggio])

  return (
    <div
      className={`palco${trascinando ? " palco--drag" : ""}${sopra ? " palco--sopra" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setSopra(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSopra(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setSopra(false)
        const o = e.dataTransfer.getData(TIPO_DRAG) || e.dataTransfer.getData("text/plain")
        if (èOggetto(o)) onDrop(o)
      }}
    >
      <Casa3D dotazioni={dotazioni} />

      <div className="palco-punteggio" aria-live="polite">
        <div className="palco-numero" style={{ color: meta.colore }}>
          {numero}<small>/100</small>
        </div>
        <div className="palco-classe" style={{ background: meta.colore }}>Classe {classe}</div>
        {delta && (
          <span key={delta.chiave} className={`palco-delta ${delta.n > 0 ? "palco-delta--su" : "palco-delta--giu"}`}>
            {delta.n > 0 ? "+" : "−"}{Math.abs(delta.n)}
          </span>
        )}
      </div>

      <div className="palco-suggerimento">{trascinando ? "Rilascia sulla casa" : "Trascina o tocca le tessere · ruota la casa col mouse"}</div>
      {children}
    </div>
  )
}
