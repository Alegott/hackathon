import React, { useState, useId, useMemo } from "react"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { punteggioCasa, statoTerritorio, scenarioVuoto } from "../engine"
import { DELTA_INFRA } from "../engine/costanti"
import { META_CLASSI } from "./DashboardCasa"
import { CASA_DEMO_DEFAULT } from "./SezioneCasa"
import { formatSegno } from "./PannelloComune"
import { etichettaFascia } from "../map/fasce"
import type { Dotazioni, TipoInfra } from "../types"

const PALETTE: {
  id: TipoInfra | "rimuovi"
  etichetta: string
  icona: string
  delta: string
}[] = [
  { id: "parco", etichetta: "Parco", icona: "🌳", delta: "+5" },
  { id: "ciclabile", etichetta: "Pista ciclabile", icona: "🚲", delta: "+3" },
  { id: "colonnine", etichetta: "Colonnine", icona: "🔌", delta: "+2" },
  { id: "industria", etichetta: "Industria", icona: "🏭", delta: "−12" },
  { id: "strada", etichetta: "Strada principale", icona: "🛣️", delta: "−8" },
  { id: "rimuovi", etichetta: "Rimuovi", icona: "🧹", delta: "annulla" },
]

export const SezioneSimulazione: React.FC = () => {
  const modalita = useApp((s) => s.modalita)
  const strumento = useApp((s) => s.strumento)
  const scenario = useApp((s) => s.scenario)
  const comuneSelezionato = useApp((s) => s.comuneSelezionato)
  const casaUtente = useApp((s) => s.casaUtente)
  const indiciScenario = useIndici()

  const switchModId = useId()
  const simFvId = useId()
  const simSolareId = useId()
  const simInfissiId = useId()
  const simEvId = useId()

  const st = store.getState()

  // Elenco comuni del dataset + tutti i 114 comuni di Vicenza
  const elenco114 = useMemo(() => {
    const mappa = new Map<string, string>()
    for (const c of dataset.comuni) mappa.set(c.istat, c.nome)
    for (const c of COMUNI_VICENZA_114) {
      if (!mappa.has(c.istat)) mappa.set(c.istat, c.nome)
    }
    return Array.from(mappa.entries()).map(([istat, nome]) => ({ istat, nome }))
  }, [])

  const istatTarget = comuneSelezionato ?? dataset.comuni[0]?.istat ?? "024001"
  const comuneTarget =
    dataset.comuni.find((c) => c.istat === istatTarget) ?? dataset.comuni[0]

  // Indici reali di riferimento (senza scenario) per mostrare il prima -> dopo territoriale
  const indiciReali = useMemo(
    () => statoTerritorio(dataset, scenarioVuoto(), casaUtente ?? undefined),
    [casaUtente],
  )

  // Simulatore Casa Singola (stato locale separato, NON tocca la casa reale)
  const dotazioniReali: Dotazioni = (casaUtente ?? CASA_DEMO_DEFAULT).dotazioni
  const [dotazioniIpotesi, setDotazioniIpotesi] = useState<Dotazioni>(() => ({
    ...dotazioniReali,
    fotovoltaico: true,
    riscaldamento: "pompa_calore",
  }))

  const primaCasa = punteggioCasa(dotazioniReali)
  const dopoCasa = punteggioCasa(dotazioniIpotesi)
  const deltaCasa = dopoCasa.punteggio - primaCasa.punteggio

  // Macro-scenari (3 slider + ambito provincia/comune)
  const macro = scenario.macro ?? {
    ambito: "provincia",
    pctFV: 0,
    pctSenzaGas: 0,
    pctIsolamentoBuono: 0,
  }

  const aggiornaMacro = (patch: Partial<typeof macro>) => {
    const prossimo = { ...macro, ...patch }
    if (st.modalita !== "scenario") st.setModalita("scenario")
    if (
      prossimo.pctFV === 0 &&
      prossimo.pctSenzaGas === 0 &&
      prossimo.pctIsolamentoBuono === 0
    ) {
      st.setMacro(null)
    } else {
      st.setMacro(prossimo)
    }
  }

  const infraRealiComune = dataset.infrastrutture.filter((i) => i.comune === istatTarget)
  const infraAggiunteComune = scenario.aggiunte.filter((a) => a.comune === istatTarget)
  const rimosseSet = new Set(scenario.rimozioni)

  const statoRealeTarget = indiciReali[istatTarget]
  const statoScenarioTarget = indiciScenario[istatTarget]

  return (
    <div className="pagina-sezione">
      {/* Barra superiore: Interruttore Realtà/Scenario e Pulsante Reset */}
      <div className="intestazione-sezione">
        <div>
          <span className="eyebrow-tag">Modulo 4 · Laboratorio di Simulazione</span>
          <h2>Scenario Territoriale, Simulatore Casa &amp; Slider Macro</h2>
          <p className="sottotitolo-sezione">
            Attiva la modalità Scenario, scegli uno strumento dalla palette o muovi gli slider
            macro per osservare in tempo reale l&apos;impatto su aria, infrastrutture e comuni
            confinanti.
          </p>
        </div>

        <div className="controlli-testata-sim">
          <label htmlFor={switchModId} className="switch-modalita-pill">
            <span>
              Modalità: <strong>{modalita === "scenario" ? "🧪 Scenario" : "📍 Realtà"}</strong>
            </span>
            <input
              id={switchModId}
              type="checkbox"
              {...({ switch: "" } as any)}
              checked={modalita === "scenario"}
              onChange={(e) => st.setModalita(e.target.checked ? "scenario" : "realta")}
            />
          </label>

          <div className="gruppo-bottoni-mod" role="group" aria-label="Modalità Realtà o Scenario">
            <button
              type="button"
              className={modalita === "realta" ? "attivo" : ""}
              onClick={() => st.setModalita("realta")}
            >
              Realtà
            </button>
            <button
              type="button"
              className={modalita === "scenario" ? "attivo" : ""}
              onClick={() => st.setModalita("scenario")}
            >
              Scenario
            </button>
          </div>

          <button
            type="button"
            className="btn-reset"
            onClick={() => st.resetScenario()}
          >
            ↺ Reset Scenario
          </button>
        </div>
      </div>

      {/* Nota obbligatoria: "modello semplificato e indicativo" */}
      <div className="banner-nota-modello" role="note">
        ℹ️ <strong>Modello semplificato e indicativo:</strong> i contributi sono calcolati con
        delta fissi (Parco +5, Pista ciclabile +3, Colonnine +2, Strada −8, Industria −12; tetto
        ±20 sulle infrastrutture esistenti; spillover a metà sui comuni confinanti per lo
        scenario; tetto +10 per i macro-scenari).
      </div>

      <div className="griglia-simulazione">
        {/* 1. Palette strumenti (con "rimuovi") e azioni sul comune */}
        <section className="card-pannello" aria-label="Palette strumenti scenario">
          <div className="card-pannello__top">
            <div>
              <span className="eyebrow-tag">1 · Build Mode &amp; Palette Strumenti</span>
              <h3>Aggiungi o rimuovi infrastrutture</h3>
            </div>

            <select
              aria-label="Comune selezionato per lo scenario"
              className="input-select"
              value={istatTarget}
              onChange={(e) => st.selezionaComune(e.target.value)}
            >
              {dataset.comuni.map((c) => (
                <option key={c.istat} value={c.istat}>
                  {c.nome} ({Math.round(indiciScenario[c.istat]?.totale ?? c.ariaNorm)}/100)
                </option>
              ))}
            </select>
          </div>

          <p className="nota-campo">
            Scegli uno strumento per cliccare sul terreno 3D del diorama (nella sezione Mappa),
            oppure applica subito la modifica a <strong>{comuneTarget?.nome}</strong>:
          </p>

          <div className="griglia-palette">
            {PALETTE.map((item) => {
              const attivo = modalita === "scenario" && strumento === item.id
              return (
                <div
                  key={item.id}
                  className={`cella-palette ${attivo ? "cella-palette--attiva" : ""}`}
                >
                  <button
                    type="button"
                    className="btn-selezione-strumento"
                    onClick={() => {
                      if (modalita !== "scenario") st.setModalita("scenario")
                      st.setStrumento(attivo ? null : item.id)
                    }}
                  >
                    <span>
                      {item.icona} <strong>{item.etichetta}</strong>
                    </span>
                    <span className="badge-delta">{item.delta}</span>
                  </button>

                  {item.id !== "rimuovi" && comuneTarget && (
                    <button
                      type="button"
                      className="btn-sec btn-xs"
                      onClick={() => {
                        if (modalita !== "scenario") st.setModalita("scenario")
                        st.aggiungiInfrastruttura(
                          comuneTarget.istat,
                          item.id as TipoInfra,
                          comuneTarget.centroide,
                        )
                      }}
                    >
                      + Aggiungi a {comuneTarget.nome}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Infrastrutture attuali del comune per rimozione rapida */}
          {comuneTarget && statoRealeTarget && statoScenarioTarget && (
            <div className="box-riepilogo-comune-sim">
              <div className="riga-prima-dopo-comune">
                <span>
                  <strong>{comuneTarget.nome}:</strong> Realtà{" "}
                  <strong>{Math.round(statoRealeTarget.totale)}</strong> (
                  {etichettaFascia(statoRealeTarget.fascia)}) → Scenario{" "}
                  <strong>{Math.round(statoScenarioTarget.totale)}</strong> (
                  {etichettaFascia(statoScenarioTarget.fascia)})
                </span>
                <strong className={statoScenarioTarget.scenario >= 0 ? "val-pos" : "val-neg"}>
                  Scenario {formatSegno(statoScenarioTarget.scenario)}
                </strong>
              </div>

              <div className="lista-infra-rimovibili">
                {infraRealiComune.map((inf) => {
                  const rimossa = rimosseSet.has(inf.id)
                  return (
                    <button
                      key={inf.id}
                      type="button"
                      className={`chip-interattiva ${rimossa ? "chip-interattiva--rimossa" : ""}`}
                      disabled={rimossa}
                      onClick={() => {
                        if (modalita !== "scenario") st.setModalita("scenario")
                        st.rimuoviInfrastruttura(inf.id)
                      }}
                    >
                      {inf.tipo} ({formatSegno(DELTA_INFRA[inf.tipo])}){" "}
                      {rimossa ? "✓ Rimossa" : "✕ Rimuovi"}
                    </button>
                  )
                })}
                {infraAggiunteComune.map((agg) => (
                  <button
                    key={agg.id}
                    type="button"
                    className="chip-interattiva chip-interattiva--aggiunta"
                    onClick={() => {
                      if (modalita !== "scenario") st.setModalita("scenario")
                      st.rimuoviInfrastruttura(agg.id)
                    }}
                  >
                    ✨ {agg.tipo} ({formatSegno(DELTA_INFRA[agg.tipo])}) ✕ Rimuovi
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 2. Simulatore Casa (dotazioni ipotetiche, punteggio prima -> dopo, senza toccare la casa reale) */}
        <section className="card-pannello" aria-label="Simulatore casa singola">
          <div className="card-pannello__top">
            <div>
              <span className="eyebrow-tag">2 · Simulatore Casa Singola</span>
              <h3>Confronto Prima → Dopo (senza toccare la casa reale)</h3>
            </div>
            <div className="gruppo-preset">
              <button
                type="button"
                className="btn-primario btn-xs"
                onClick={() =>
                  setDotazioniIpotesi({
                    ...dotazioniReali,
                    fotovoltaico: true,
                    riscaldamento: "pompa_calore",
                  })
                }
              >
                ⚡ Demo: Pompa di calore + FV
              </button>
              <button
                type="button"
                className="btn-sec btn-xs"
                onClick={() => setDotazioniIpotesi({ ...dotazioniReali })}
              >
                ↺ Allinea a casa reale
              </button>
            </div>
          </div>

          <div className="confronto-casa-box">
            <div className="lato-confronto">
              <small>PRIMA (Casa reale)</small>
              <div>
                <strong>{primaCasa.punteggio} pt</strong>{" "}
                <span
                  className="pill-classe"
                  style={{
                    backgroundColor: META_CLASSI[primaCasa.classe].bg,
                    color: META_CLASSI[primaCasa.classe].colore,
                  }}
                >
                  Classe {primaCasa.classe}
                </span>
              </div>
            </div>

            <div className="freccia-confronto">
              <span>→</span>
              <strong className={deltaCasa >= 0 ? "val-pos" : "val-neg"}>
                {formatSegno(deltaCasa)} pt
              </strong>
            </div>

            <div className="lato-confronto lato-confronto--dopo">
              <small>DOPO (Ipotesi simulata)</small>
              <div>
                <strong>{dopoCasa.punteggio} pt</strong>{" "}
                <span
                  className="pill-classe"
                  style={{
                    backgroundColor: META_CLASSI[dopoCasa.classe].bg,
                    color: META_CLASSI[dopoCasa.classe].colore,
                  }}
                >
                  Classe {dopoCasa.classe}
                </span>
              </div>
            </div>
          </div>

          <div className="griglia-switches">
            <label htmlFor={simFvId} className="card-switch">
              <span>☀️ Fotovoltaico</span>
              <input
                id={simFvId}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={dotazioniIpotesi.fotovoltaico}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({ ...d, fotovoltaico: e.target.checked }))
                }
              />
            </label>

            <label htmlFor={simSolareId} className="card-switch">
              <span>🌡️ Solare termico</span>
              <input
                id={simSolareId}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={dotazioniIpotesi.solareTermico}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({ ...d, solareTermico: e.target.checked }))
                }
              />
            </label>

            <label htmlFor={simInfissiId} className="card-switch">
              <span>🪟 Infissi doppio/triplo vetro</span>
              <input
                id={simInfissiId}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={dotazioniIpotesi.infissi}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({ ...d, infissi: e.target.checked }))
                }
              />
            </label>

            <label htmlFor={simEvId} className="card-switch">
              <span>🔌 Colonnina EV</span>
              <input
                id={simEvId}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={dotazioniIpotesi.colonninaEV}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({ ...d, colonninaEV: e.target.checked }))
                }
              />
            </label>
          </div>

          <div className="riga-tre-select">
            <label>
              <span>Riscaldamento</span>
              <select
                className="input-select"
                value={dotazioniIpotesi.riscaldamento}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({
                    ...d,
                    riscaldamento: e.target.value as Dotazioni["riscaldamento"],
                  }))
                }
              >
                <option value="pompa_calore">Pompa di calore</option>
                <option value="condensazione">Condensazione</option>
                <option value="tradizionale">Tradizionale</option>
              </select>
            </label>

            <label>
              <span>Cottura</span>
              <select
                className="input-select"
                value={dotazioniIpotesi.cottura}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({
                    ...d,
                    cottura: e.target.value as Dotazioni["cottura"],
                  }))
                }
              >
                <option value="induzione">Induzione</option>
                <option value="gas">Gas</option>
              </select>
            </label>

            <label>
              <span>Isolamento</span>
              <select
                className="input-select"
                value={dotazioniIpotesi.isolamento}
                onChange={(e) =>
                  setDotazioniIpotesi((d) => ({
                    ...d,
                    isolamento: e.target.value as Dotazioni["isolamento"],
                  }))
                }
              >
                <option value="buono">Buono</option>
                <option value="medio">Medio</option>
                <option value="scarso">Scarso</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      {/* 3. Tre slider macro con scelta dell'ambito provincia/comune */}
      <section className="card-pannello" aria-label="Slider macro-scenari">
        <div className="card-pannello__top">
          <div>
            <span className="eyebrow-tag">3 · Macro-Scenari su Scala Territoriale (Tetto aria +10)</span>
            <h3>Slider percentuali sulle abitazioni (Provincia o Comune)</h3>
          </div>

          <div className="gruppo-preset">
            <button
              type="button"
              className="btn-primario btn-xs"
              onClick={() => {
                st.setModalita("scenario")
                st.setMacro({
                  ambito: "provincia",
                  pctFV: 100,
                  pctSenzaGas: macro.pctSenzaGas,
                  pctIsolamentoBuono: macro.pctIsolamentoBuono,
                })
              }}
            >
              ☀️ Demo: 100% FV sulla Provincia
            </button>
            <button
              type="button"
              className="btn-sec btn-xs"
              onClick={() => st.setMacro(null)}
            >
              Azzera macro
            </button>
          </div>
        </div>

        <div className="griglia-macro">
          <div className="colonna-slider">
            <div className="campo-form">
              <label htmlFor="select-ambito-macro">Ambito di applicazione:</label>
              <select
                id="select-ambito-macro"
                className="input-select"
                value={macro.ambito}
                onChange={(e) => aggiornaMacro({ ambito: e.target.value })}
              >
                <option value="provincia">🌍 Intera Provincia di Vicenza</option>
                <optgroup label="Singolo Comune (114 comuni)">
                  {elenco114.map((c) => (
                    <option key={c.istat} value={c.istat}>
                      🏘️ {c.nome} ({c.istat})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="blocco-slider">
              <div className="blocco-slider__testata">
                <label htmlFor="slider-fv">☀️ % Case con fotovoltaico</label>
                <strong>{macro.pctFV}%</strong>
              </div>
              <input
                id="slider-fv"
                type="range"
                min={0}
                max={100}
                step={5}
                value={macro.pctFV}
                onChange={(e) => aggiornaMacro({ pctFV: Number(e.target.value) })}
              />
            </div>

            <div className="blocco-slider">
              <div className="blocco-slider__testata">
                <label htmlFor="slider-nogas">♨️ % Case senza gas (pompa di calore + induzione)</label>
                <strong>{macro.pctSenzaGas}%</strong>
              </div>
              <input
                id="slider-nogas"
                type="range"
                min={0}
                max={100}
                step={5}
                value={macro.pctSenzaGas}
                onChange={(e) => aggiornaMacro({ pctSenzaGas: Number(e.target.value) })}
              />
            </div>

            <div className="blocco-slider">
              <div className="blocco-slider__testata">
                <label htmlFor="slider-isolamento">🧱 % Case con isolamento buono</label>
                <strong>{macro.pctIsolamentoBuono}%</strong>
              </div>
              <input
                id="slider-isolamento"
                type="range"
                min={0}
                max={100}
                step={5}
                value={macro.pctIsolamentoBuono}
                onChange={(e) =>
                  aggiornaMacro({ pctIsolamentoBuono: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="colonna-impatto-macro">
            <h4>Impatto sul territorio selezionato ({comuneTarget?.nome})</h4>
            <div className="metriche-macro">
              <div className="metrica-macro-card">
                <span>Indice case medio</span>
                <strong>
                  {Math.round(statoRealeTarget?.indiceCaseMedio ?? 0)} →{" "}
                  {Math.round(statoScenarioTarget?.indiceCaseMedio ?? 0)} / 100
                </strong>
                <small>dati dimostrativi</small>
              </div>
              <div className="metrica-macro-card">
                <span>Indice ambientale comune</span>
                <strong>
                  {Math.round(statoRealeTarget?.totale ?? 0)} →{" "}
                  {Math.round(statoScenarioTarget?.totale ?? 0)} / 100
                </strong>
                <small>Bonus aria macro con tetto max +10 pt</small>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
