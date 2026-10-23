import { SCALA_COLORI } from "./fasce"
import { dataset, èMock } from "../data/dataset"

export function Legenda() {
  return (
    <div className="legenda" aria-label="Legenda delle fasce">
      <strong>Indice ambientale</strong>
      <div className="legenda-scala" aria-label="20 fasce da viola (0) ad azzurro (100)">
        {SCALA_COLORI.map((f) => <span key={f.min} style={{ background: f.colore }} title={`${f.min}–${f.max} punti`} />)}
      </div>
      <div className="legenda-estremi"><span>0 · Critico</span><span>100 · Ottimo</span></div>
      <small>20 fasce · intervalli di 5 punti</small>
      <small className="legenda-fonte">{èMock ? "Dati dimostrativi" : `PM10 ARPAV · ${dataset.meta.periodoAria}`}<br />Medie annuali · stime comunali IDW</small>
      <small className="legenda-fonte">Fauna, alberi e nuvole seguono la sostenibilità.<br />Nuvole bianche → nere · rappresentazione illustrativa.<br />Indice composito · infrastrutture e case dimostrative.</small>
    </div>
  )
}
