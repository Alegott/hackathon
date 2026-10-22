import { FASCE } from "./fasce"

export function Legenda() {
  return (
    <div className="legenda" aria-label="Legenda delle fasce">
      <strong>Indice ambientale</strong>
      {FASCE.map((f) => (
        <div key={f.fascia} className="legenda-riga">
          <span className="legenda-colore" style={{ background: f.colore }} />
          {f.etichetta} <small>{f.intervallo}</small>
        </div>
      ))}
    </div>
  )
}
