import React from "react"
import { dataset } from "../data/dataset"
import { store, useApp, useIndici } from "../app/useApp"
import { colorePunteggio, etichettaFascia } from "../map/fasce"
import { DELTA_INFRA } from "../engine/costanti"
import { calcolaSpawnSpecieRare } from "../diorama/Fauna"
import type { TipoInfra } from "../types"

const ETICHETTE_INFRA: Record<TipoInfra, { nome: string; icona: string }> = {
  parco: { nome: "Parco", icona: "🌳" },
  ciclabile: { nome: "Pista ciclabile", icona: "🚲" },
  colonnine: { nome: "Colonnine EV", icona: "🔌" },
  industria: { nome: "Industria", icona: "🏭" },
  strada: { nome: "Strada principale", icona: "🛣️" },
}

export function formatSegno(n: number): string {
  const val = Math.round(n * 10) / 10
  return `${val >= 0 ? "+" : "−"}${Math.abs(val)}`
}

export const PannelloComune: React.FC = () => {
  const istat = useApp((s) => s.comuneSelezionato)
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
  const casaUtente = useApp((s) => s.casaUtente)
  const indici = useIndici()

  const c = dataset.comuni.find((x) => x.istat === istat)
  const s = istat ? indici[istat] : undefined

  if (!c || !s) return null

  const mostraScenario = modalita === "scenario" || s.scenario !== 0
  const colore = colorePunteggio(s.totale)
  const rimozioniSet = new Set(scenario.rimozioni)
  const infraReali = dataset.infrastrutture.filter((i) => i.comune === c.istat)
  const infraAggiunte = scenario.aggiunte.filter(
    (a) => a.comune === c.istat && !rimozioniSet.has(a.id),
  )

  const { spawnRate, specieAttive } = calcolaSpawnSpecieRare(s)

  return (
    <aside className="pannello-comune" aria-label={`Pannello comune di ${c.nome}`}>
      <div className="pannello-comune__top">
        <div>
          <span className="eyebrow-tag">ISTAT {c.istat}</span>
          <h2>{c.nome}</h2>
        </div>
        <div className="pannello-comune__badge" style={{ borderColor: colore }}>
          <span className="pallino" style={{ background: colore }} />
          <span>
            {etichettaFascia(s.fascia)} · <strong>{Math.round(s.totale)}</strong>/100
          </span>
        </div>
      </div>

      {/* Scomposizione richiesta da TASKS.md:
          "Aria reale X · Infrastrutture ±Y · (Scenario ±W) · Totale Z" */}
      <p className="scomposizione" role="status">
        <span>
          Aria reale <strong>{Math.round(s.aria)}</strong>
        </span>
        {" · "}
        <span>
          Infrastrutture{" "}
          <strong className={s.infrastrutture >= 0 ? "val-pos" : "val-neg"}>
            {formatSegno(s.infrastrutture)}
          </strong>
        </span>
        {mostraScenario && (
          <>
            {" · "}
            <span className="scomposizione__scenario">
              Scenario{" "}
              <strong className={s.scenario >= 0 ? "val-pos" : "val-neg"}>
                {formatSegno(s.scenario)}
              </strong>
            </span>
          </>
        )}
        {" · "}
        <span>
          Totale <strong>{Math.round(s.totale)}</strong>
        </span>
      </p>

      <div className="pannello-comune__meta">
        <div className="pannello-comune__meta-row">
          <span>📡 Fonte aria ({dataset.meta.inquinante}):</span>
          <strong>
            stima da {c.nCentraline} centraline · {dataset.meta.periodoAria}
          </strong>
        </div>
        <div className="pannello-comune__meta-row">
          <span>PM10 medio stimato:</span>
          <strong>{c.pm10.toFixed(1)} µg/m³</strong>
        </div>
        <div className="pannello-comune__meta-row pannello-comune__meta-row--case">
          <span>
            🏠 Indice case medio{" "}
            <em className="etichetta-dimostrativa">(dati dimostrativi)</em>:
          </span>
          <strong>
            {Math.round(s.indiceCaseMedio)}/100
            {casaUtente?.comune === c.istat ? " (incl. tua casa)" : ""}
          </strong>
        </div>
        <div className="pannello-comune__meta-row pannello-comune__meta-row--case">
          <span>🦌 Spawn specie protette / a rischio:</span>
          <strong className={spawnRate > 0 ? "val-pos" : ""}>
            {Math.round(spawnRate * 100)}%
          </strong>
        </div>
        {specieAttive.length > 0 && (
          <div style={{ fontSize: "11.5px", color: "#15803d", marginTop: "2px" }}>
            ✨ Avvistabili: {specieAttive.map((sp) => sp.nome).join(", ")}
          </div>
        )}
      </div>

      {/* Sintesi infrastrutture e confinanti */}
      <div className="pannello-comune__extra">
        <div className="pannello-comune__infra-list">
          {infraReali.map((inf) => {
            const rimossa = modalita === "scenario" && rimozioniSet.has(inf.id)
            return (
              <span
                key={inf.id}
                className={`mini-chip ${rimossa ? "mini-chip--rimossa" : ""}`}
                title={`${ETICHETTE_INFRA[inf.tipo].nome} (${formatSegno(DELTA_INFRA[inf.tipo])})`}
              >
                {ETICHETTE_INFRA[inf.tipo].icona} {ETICHETTE_INFRA[inf.tipo].nome} (
                {formatSegno(DELTA_INFRA[inf.tipo])})
              </span>
            )
          })}
          {modalita === "scenario" &&
            infraAggiunte.map((agg) => (
              <span key={agg.id} className="mini-chip mini-chip--aggiunta">
                ✨ {ETICHETTE_INFRA[agg.tipo].icona} {ETICHETTE_INFRA[agg.tipo].nome} (
                {formatSegno(DELTA_INFRA[agg.tipo])})
              </span>
            ))}
        </div>

        <div className="pannello-comune__azioni">
          <button
            type="button"
            className="btn-pannello"
            onClick={() => {
              store.getState().setModalita("scenario")
              store.getState().setSezione("simulazione")
            }}
          >
            🧪 Apri in Simulazione
          </button>
          <button
            type="button"
            className="btn-pannello btn-pannello--sec"
            onClick={() => store.getState().setSezione("casa")}
          >
            🏠 Classifica comune
          </button>
        </div>
      </div>
    </aside>
  )
}
