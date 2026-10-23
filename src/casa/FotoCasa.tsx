import { Component, useState, type ReactNode } from "react"
import type { Dotazioni } from "../types"
import { Casa3D } from "./Casa3D"

const fotoCase = new Map<string, string>()

class ErroreFoto extends Component<{ children: ReactNode }, { errore: boolean }> {
  state = { errore: false }
  static getDerivedStateFromError() { return { errore: true } }
  render() { return this.state.errore ? <p role="status">Anteprima 3D non disponibile su questo dispositivo.</p> : this.props.children }
}

function Scatto({ dotazioni, nome }: { dotazioni: Dotazioni; nome: string }) {
  const chiave = JSON.stringify(dotazioni)
  const [foto, setFoto] = useState(() => fotoCase.get(chiave))
  return <figure className="foto-casa">
    {foto ? <img src={foto} alt={`Vista frontale di ${nome}`} /> : <div className="foto-casa-render" aria-label={`Preparazione foto di ${nome}`}><ErroreFoto><Casa3D dotazioni={dotazioni} onFotoFrontale={(immagine) => { fotoCase.set(chiave, immagine); setFoto(immagine) }} /></ErroreFoto></div>}
    <figcaption>{nome} · Vista frontale</figcaption>
  </figure>
}

export function FotoCasa({ dotazioni, nome }: { dotazioni: Dotazioni; nome: string }) {
  // Ogni modifica alle dotazioni genera uno scatto aggiornato, anche senza aprire Casa.
  return <Scatto key={JSON.stringify(dotazioni)} dotazioni={dotazioni} nome={nome} />
}
