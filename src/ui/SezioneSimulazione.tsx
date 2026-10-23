import React, { useState, useId, useMemo } from "react"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { punteggioCasa, statoTerritorio, scenarioVuoto } from "../engine"
import { areaEttari, deltaAggiunta, DELTA_INFRA, INDUSTRIE, lunghezzaKm, STRADE } from "../engine/costanti"
import { META_CLASSI } from "./DashboardCasa"
import { CASA_DEMO_DEFAULT } from "./SezioneCasa"
import { formatSegno } from "./PannelloComune"
import { coloreFascia, etichettaFascia } from "../map/fasce"
import type { Aggiunta, Dotazioni, Fascia, TipoIndustria, TipoInfra } from "../types"

const INFRA: { id: TipoInfra; etichetta: string; icona: string }[] = [
  { id: "parco", etichetta: "Parco", icona: "🌳" },
  { id: "ciclabile", etichetta: "Pista ciclabile", icona: "🚲" },
  { id: "colonnine", etichetta: "Colonnine", icona: "🔌" },
  { id: "industria", etichetta: "Industria", icona: "🏭" },
  { id: "strada", etichetta: "Strada", icona: "🛣️" },
  { id: "nucleare", etichetta: "Centrale nucleare", icona: "⚛️" },
]

type Forma = Pick<Aggiunta, "strada" | "ciclabile" | "parco" | "industria">
const quadrato = (c: [number, number], lato: number): [number, number][] => [
  [c[0] - lato / 2, c[1] - lato / 2], [c[0] + lato / 2, c[1] - lato / 2], [c[0] + lato / 2, c[1] + lato / 2], [c[0] - lato / 2, c[1] + lato / 2],
]
// Dal pannello le forme si piazzano già pronte (parco da 4 ettari, ciclabile da 3 km, provinciale da 2 km);
// sulla mappa si disegnano a mano.
const TESSERE: { chiave: string; tipo: TipoInfra; etichetta: string; icona: string; forma?: (c: [number, number]) => Forma }[] = [
  { chiave: "parco", tipo: "parco", etichetta: "Parco (4 ettari)", icona: "🌳", forma: (c) => ({ parco: { contorno: quadrato(c, 200) } }) },
  { chiave: "ciclabile", tipo: "ciclabile", etichetta: "Pista ciclabile (3 km)", icona: "🚲",
    forma: (c) => ({ ciclabile: { tracciato: [[c[0] - 1500, c[1]], [c[0] + 1500, c[1]]] } }) },
  { chiave: "colonnine", tipo: "colonnine", etichetta: "Colonnine", icona: "🔌" },
  ...(Object.keys(INDUSTRIE) as TipoIndustria[]).map((v) => ({ chiave: `industria-${v}`, tipo: "industria" as const,
    etichetta: `Industria ${INDUSTRIE[v].etichetta.toLowerCase()}`, icona: "🏭", forma: () => ({ industria: v }) })),
  { chiave: "strada", tipo: "strada", etichetta: "Strada provinciale (2 km)", icona: "🛣️",
    forma: (c) => ({ strada: { tipo: "provinciale" as const, tracciato: [[c[0] - 1000, c[1]], [c[0] + 1000, c[1]]] } }) },
  { chiave: "nucleare", tipo: "nucleare", etichetta: "Centrale nucleare", icona: "⚛️" },
]
const nomeAggiunta = (agg: Aggiunta) =>
  agg.strada ? `${STRADE[agg.strada.tipo].etichetta} ${lunghezzaKm(agg.strada.tracciato).toFixed(1)} km`
    : agg.ciclabile ? `Pista ciclabile ${lunghezzaKm(agg.ciclabile.tracciato).toFixed(1)} km`
    : agg.parco ? `Parco ${areaEttari(agg.parco.contorno).toFixed(1)} ha`
    : agg.industria ? `Industria ${INDUSTRIE[agg.industria].etichetta.toLowerCase()}`
    : META_INFRA[agg.tipo].etichetta
const META_INFRA = Object.fromEntries(INFRA.map((i) => [i.id, i])) as Record<
  TipoInfra,
  (typeof INFRA)[number]
>

const STRUMENTI_MAPPA: { id: TipoInfra | "rimuovi"; etichetta: string; icona: string }[] = [
  ...INFRA,
  { id: "rimuovi", etichetta: "Rimuovi", icona: "✕" },
]

/** Confronto prima → dopo con barra 0–100: il cuore visivo di ogni blocco. */
const Confronto: React.FC<{
  prima: number
  dopo: number
  etichettaPrima: string
  etichettaDopo: string
  coloreDopo: string
  dettaglioPrima?: React.ReactNode
  dettaglioDopo?: React.ReactNode
}> = ({ prima, dopo, etichettaPrima, etichettaDopo, coloreDopo, dettaglioPrima, dettaglioDopo }) => {
  const delta = Math.round(dopo) - Math.round(prima)
  const segno = delta > 0 ? "su" : delta < 0 ? "giu" : "pari"
  return (
    <div className="sim-confronto" aria-live="polite">
      <div className="sim-confronto__valori">
        <div>
          <span className="sim-confronto__etichetta">{etichettaPrima}</span>
          <span className="sim-confronto__numero sim-confronto__numero--prima">
            {Math.round(prima)}
          </span>
          {dettaglioPrima}
        </div>
        <span className={`sim-delta sim-delta--${segno}`}>
          {segno === "pari" ? "invariato" : `${formatSegno(delta)} punti`}
        </span>
        <div className="sim-confronto__dopo">
          <span className="sim-confronto__etichetta">{etichettaDopo}</span>
          <span className="sim-confronto__numero">{Math.round(dopo)}</span>
          {dettaglioDopo}
        </div>
      </div>
      <div
        className="sim-barra"
        role="img"
        aria-label={`Da ${Math.round(prima)} a ${Math.round(dopo)} su 100`}
      >
        <span className="sim-barra__prima" style={{ width: `${prima}%` }} />
        <span
          className="sim-barra__dopo"
          style={{ width: `${dopo}%`, backgroundColor: coloreDopo }}
        />
      </div>
    </div>
  )
}

const PillFascia: React.FC<{ fascia: Fascia }> = ({ fascia }) => (
  <span className="sim-pill">
    <span className="sim-pill__punto" style={{ backgroundColor: coloreFascia(fascia) }} />
    {etichettaFascia(fascia)}
  </span>
)

const PillClasse: React.FC<{ classe: keyof typeof META_CLASSI }> = ({ classe }) => (
  <span
    className="sim-pill"
    style={{ backgroundColor: META_CLASSI[classe].bg, color: META_CLASSI[classe].colore }}
  >
    Classe {classe}
  </span>
)

/** Gruppo di scelte a pulsanti (radio nativi): più leggibile di un menu a tendina. */
function Scelta<T extends string>(props: {
  legenda: string
  valore: T
  opzioni: { valore: T; etichetta: string }[]
  onChange: (v: T) => void
}) {
  const nome = useId()
  return (
    <fieldset className="sim-scelta">
      <legend>{props.legenda}</legend>
      <div className="sim-scelta__opzioni">
        {props.opzioni.map((o) => (
          <label key={o.valore}>
            <input
              type="radio"
              name={nome}
              value={o.valore}
              checked={props.valore === o.valore}
              onChange={() => props.onChange(o.valore)}
            />
            <span>{o.etichetta}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const Interruttore: React.FC<{
  icona: string
  etichetta: string
  attivo: boolean
  onChange: (v: boolean) => void
}> = ({ icona, etichetta, attivo, onChange }) => (
  <label className="sim-interruttore">
    <span aria-hidden="true" className="sim-interruttore__icona">
      {icona}
    </span>
    <span className="sim-interruttore__testo">{etichetta}</span>
    <input
      type="checkbox"
      role="switch"
      checked={attivo}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="sim-interruttore__traccia" aria-hidden="true" />
  </label>
)

const Cursore: React.FC<{
  icona: string
  etichetta: string
  valore: number
  onChange: (v: number) => void
}> = ({ icona, etichetta, valore, onChange }) => {
  const id = useId()
  return (
    <div className="sim-cursore">
      <div className="sim-cursore__testata">
        <label htmlFor={id}>
          <span aria-hidden="true">{icona}</span> {etichetta}
        </label>
        <output htmlFor={id}>{valore}%</output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={valore}
        aria-valuetext={`${valore} per cento`}
        style={{ "--riempimento": `${valore}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export const SezioneSimulazione: React.FC = () => {
  const modalita = useApp((s) => s.modalita)
  const strumento = useApp((s) => s.strumento)
  const scenario = useApp((s) => s.scenario)
  const comuneSelezionato = useApp((s) => s.comuneSelezionato)
  const casaUtente = useApp((s) => s.casaUtente)
  const indiciScenario = useIndici()

  const comuneSelectId = useId()
  const ambitoSelectId = useId()

  const st = store.getState()
  const inScenario = () => {
    if (st.modalita !== "scenario") st.setModalita("scenario")
  }

  // Elenco comuni del dataset + tutti i 114 comuni di Vicenza
  const elenco114 = useMemo(() => {
    const mappa = new Map<string, string>()
    for (const c of dataset.comuni) mappa.set(c.istat, c.nome)
    for (const c of COMUNI_VICENZA_114) {
      if (!mappa.has(c.istat)) mappa.set(c.istat, c.nome)
    }
    return Array.from(mappa.entries())
      .map(([istat, nome]) => ({ istat, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "it"))
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
  const cambiaCasa = (patch: Partial<Dotazioni>) => setDotazioniIpotesi((d) => ({ ...d, ...patch }))

  const primaCasa = punteggioCasa(dotazioniReali)
  const dopoCasa = punteggioCasa(dotazioniIpotesi)

  // Macro-scenari (3 slider + ambito provincia/comune)
  const macro = scenario.macro ?? {
    ambito: "provincia",
    pctFV: 0,
    pctSenzaGas: 0,
    pctIsolamentoBuono: 0,
  }

  const aggiornaMacro = (patch: Partial<typeof macro>) => {
    const prossimo = { ...macro, ...patch }
    inScenario()
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
    <div className="pagina-sezione sim">
      {/* Intestazione: cosa si fa qui + interruttore Realtà/Scenario */}
      <header className="sim-testata">
        <div>
          <span className="sim-kicker">🌱 Laboratorio</span>
          <h2>
            Simula il <em>cambiamento</em>
          </h2>
          <p>
            Prova a cambiare il tuo comune, la tua casa o l&apos;intera provincia e guarda subito
            come cambia l&apos;ambiente. Niente di ciò che fai qui modifica i dati reali.
          </p>
        </div>

        <div className="sim-testata__azioni">
          <div className="sim-segmenti" role="group" aria-label="Cosa vuoi vedere sulla mappa">
            <button
              type="button"
              aria-pressed={modalita === "realta"}
              onClick={() => st.setModalita("realta")}
            >
              Realtà
            </button>
            <button
              type="button"
              aria-pressed={modalita === "scenario"}
              onClick={() => st.setModalita("scenario")}
            >
              Scenario
            </button>
          </div>
          <button type="button" className="sim-btn sim-btn--testo" onClick={() => st.resetScenario()}>
            ↺ Ricomincia
          </button>
        </div>
      </header>

      {/* Comune e casa sono racchiusi nel riquadro "Tutti insieme", in cui confluiscono */}
      <div className="sim-insieme">
        <span className="sim-insieme__etichetta">
          <span aria-hidden="true">🌱</span> Dalla tua casa a tutta la provincia
        </span>
        <div className="sim-griglia">
          {/* 1. Comune: aggiungi o togli infrastrutture */}
          <section className="sim-card" aria-labelledby="sim-titolo-comune">
            <div className="sim-card__testata">
              <span className="sim-numero" aria-hidden="true">1</span>
              <div>
                <h3 id="sim-titolo-comune">Il tuo comune</h3>
                <p>Aggiungi un parco o togli un&apos;industria: cosa succede all&apos;indice?</p>
              </div>
            </div>

            <label htmlFor={comuneSelectId} className="sim-etichetta">
              Comune
            </label>
            <select
              id={comuneSelectId}
              className="sim-select"
              value={istatTarget}
              onChange={(e) => st.selezionaComune(e.target.value)}
            >
              {dataset.comuni.map((c) => (
                <option key={c.istat} value={c.istat}>
                  {c.nome}
                </option>
              ))}
            </select>

            {statoRealeTarget && statoScenarioTarget && (
              <Confronto
                prima={statoRealeTarget.totale}
                dopo={statoScenarioTarget.totale}
                etichettaPrima="Oggi"
                etichettaDopo="Con le tue modifiche"
                coloreDopo={coloreFascia(statoScenarioTarget.fascia)}
                dettaglioPrima={<PillFascia fascia={statoRealeTarget.fascia} />}
                dettaglioDopo={<PillFascia fascia={statoScenarioTarget.fascia} />}
              />
            )}

            {comuneTarget && (
              <>
                <h4 className="sim-sottotitolo">Aggiungi a {comuneTarget.nome}</h4>
                <div className="sim-tessere">
                  {TESSERE.map((item) => {
                    const forma = item.forma?.(comuneTarget.centroide)
                    const d = deltaAggiunta({ id: "", comune: "", tipo: item.tipo, posizione: comuneTarget.centroide, ...forma })
                    return (
                      <button
                        key={item.chiave}
                        type="button"
                        className={`sim-tessera ${d >= 0 ? "sim-tessera--buona" : "sim-tessera--cattiva"}`}
                        aria-label={`Aggiungi ${item.etichetta}, ${formatSegno(d)} punti`}
                        onClick={() => {
                          inScenario()
                          st.aggiungiInfrastruttura(comuneTarget.istat, item.tipo, comuneTarget.centroide, forma)
                        }}
                      >
                        <span className="sim-tessera__icona" aria-hidden="true">
                          {item.icona}
                        </span>
                        <span className="sim-tessera__nome">{item.etichetta}</span>
                        <span className="sim-tessera__delta">{formatSegno(d)}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {(infraRealiComune.length > 0 || infraAggiunteComune.length > 0) && (
              <>
                <h4 className="sim-sottotitolo">Già presenti · tocca per togliere</h4>
                <ul className="sim-chips">
                  {infraAggiunteComune.map((agg) => (
                    <li key={agg.id}>
                      <button
                        type="button"
                        className="sim-chip sim-chip--nuova"
                        aria-label={`Togli ${META_INFRA[agg.tipo].etichetta} aggiunta`}
                        title={`${formatSegno(deltaAggiunta(agg))} punti`}
                        onClick={() => {
                          inScenario()
                          st.rimuoviInfrastruttura(agg.id)
                        }}
                      >
                        <span aria-hidden="true">{META_INFRA[agg.tipo].icona}</span>
                        {nomeAggiunta(agg)}
                        <small>nuova</small>
                        <span aria-hidden="true" className="sim-chip__x">✕</span>
                      </button>
                    </li>
                  ))}
                  {infraRealiComune.map((inf) => {
                    const rimossa = rimosseSet.has(inf.id)
                    return (
                      <li key={inf.id}>
                        <button
                          type="button"
                          className={`sim-chip ${rimossa ? "sim-chip--rimossa" : ""}`}
                          disabled={rimossa}
                          aria-label={
                            rimossa
                              ? `${META_INFRA[inf.tipo].etichetta} già tolta`
                              : `Togli ${META_INFRA[inf.tipo].etichetta}, ${formatSegno(-DELTA_INFRA[inf.tipo])} punti`
                          }
                          onClick={() => {
                            inScenario()
                            st.rimuoviInfrastruttura(inf.id)
                          }}
                        >
                          <span aria-hidden="true">{META_INFRA[inf.tipo].icona}</span>
                          {META_INFRA[inf.tipo].etichetta}
                          <span aria-hidden="true" className="sim-chip__x">
                            {rimossa ? "tolta" : "✕"}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            <details className="sim-dettagli">
              <summary>Preferisci posizionarle a mano sulla mappa 3D?</summary>
              <p>
                Scegli uno strumento, poi apri la sezione Mappa: trascina gli oggetti dove vuoi e traccia le strade punto per punto.
              </p>
              <div className="sim-chips" role="group" aria-label="Strumento per la mappa">
                {STRUMENTI_MAPPA.map((item) => {
                  const attivo = modalita === "scenario" && strumento === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="sim-chip"
                      aria-pressed={attivo}
                      onClick={() => {
                        inScenario()
                        st.setStrumento(attivo ? null : item.id)
                      }}
                    >
                      <span aria-hidden="true">{item.icona}</span>
                      {item.etichetta}
                    </button>
                  )
                })}
              </div>
            </details>
          </section>

          {/* 2. Casa: dotazioni ipotetiche, senza toccare la casa reale */}
          <section className="sim-card" aria-labelledby="sim-titolo-casa">
            <div className="sim-card__testata">
              <span className="sim-numero" aria-hidden="true">2</span>
              <div>
                <h3 id="sim-titolo-casa">La tua casa</h3>
                <p>E se cambiassi impianti? La tua casa salvata resta com&apos;è.</p>
              </div>
            </div>

            <Confronto
              prima={primaCasa.punteggio}
              dopo={dopoCasa.punteggio}
              etichettaPrima="Oggi"
              etichettaDopo="Dopo i lavori"
              coloreDopo={META_CLASSI[dopoCasa.classe].colore}
              dettaglioPrima={<PillClasse classe={primaCasa.classe} />}
              dettaglioDopo={<PillClasse classe={dopoCasa.classe} />}
            />

            <div className="sim-interruttori">
              <Interruttore
                icona="☀️"
                etichetta="Fotovoltaico"
                attivo={dotazioniIpotesi.fotovoltaico}
                onChange={(v) => cambiaCasa({ fotovoltaico: v })}
              />
              <Interruttore
                icona="🌡️"
                etichetta="Solare termico"
                attivo={dotazioniIpotesi.solareTermico}
                onChange={(v) => cambiaCasa({ solareTermico: v })}
              />
              <Interruttore
                icona="🪟"
                etichetta="Doppi vetri"
                attivo={dotazioniIpotesi.infissi}
                onChange={(v) => cambiaCasa({ infissi: v })}
              />
              <Interruttore
                icona="🔌"
                etichetta="Ricarica auto elettrica"
                attivo={dotazioniIpotesi.colonninaEV}
                onChange={(v) => cambiaCasa({ colonninaEV: v })}
              />
            </div>

            <Scelta
              legenda="Riscaldamento"
              valore={dotazioniIpotesi.riscaldamento}
              onChange={(v) => cambiaCasa({ riscaldamento: v })}
              opzioni={[
                { valore: "pompa_calore", etichetta: "Pompa di calore" },
                { valore: "condensazione", etichetta: "Condensazione" },
                { valore: "tradizionale", etichetta: "Tradizionale" },
              ]}
            />
            <Scelta
              legenda="Cucina"
              valore={dotazioniIpotesi.cottura}
              onChange={(v) => cambiaCasa({ cottura: v })}
              opzioni={[
                { valore: "induzione", etichetta: "Induzione" },
                { valore: "gas", etichetta: "Gas" },
              ]}
            />
            <Scelta
              legenda="Isolamento"
              valore={dotazioniIpotesi.isolamento}
              onChange={(v) => cambiaCasa({ isolamento: v })}
              opzioni={[
                { valore: "buono", etichetta: "Buono" },
                { valore: "medio", etichetta: "Medio" },
                { valore: "scarso", etichetta: "Scarso" },
              ]}
            />

            <div className="sim-azioni">
              <button
                type="button"
                className="sim-btn sim-btn--primario"
                onClick={() =>
                  setDotazioniIpotesi({
                    ...dotazioniReali,
                    fotovoltaico: true,
                    riscaldamento: "pompa_calore",
                  })
                }
              >
                ⚡ Prova: pompa di calore + fotovoltaico
              </button>
              <button
                type="button"
                className="sim-btn sim-btn--testo"
                onClick={() => setDotazioniIpotesi({ ...dotazioniReali })}
              >
                Torna alla mia casa
              </button>
            </div>
          </section>
        </div>

        <div className="sim-unione" aria-hidden="true">
          <svg viewBox="0 0 100 72" preserveAspectRatio="none">
            <path d="M25 0 C25 40, 50 30, 50 72" vectorEffect="non-scaling-stroke" />
            <path d="M75 0 C75 40, 50 30, 50 72" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="sim-unione__nodo">comune + casa, per tutte le famiglie</span>
        </div>

        {/* 3. Macro-scenari: percentuali di case su provincia o comune */}
        <section className="sim-card sim-card--insieme" aria-labelledby="sim-titolo-macro">
          <div className="sim-card__testata">
            <span className="sim-numero" aria-hidden="true">3</span>
            <div>
              <h3 id="sim-titolo-macro">Tutti insieme</h3>
              <p>E se tante famiglie facessero la stessa scelta? Muovi i cursori.</p>
            </div>
            <span className="sim-insieme__icone" aria-hidden="true">🏠🏠🏠</span>
          </div>

          <div className="sim-macro">
            <div>
              <label htmlFor={ambitoSelectId} className="sim-etichetta">
                Dove
              </label>
              <select
                id={ambitoSelectId}
                className="sim-select"
                value={macro.ambito}
                onChange={(e) => aggiornaMacro({ ambito: e.target.value })}
              >
                <option value="provincia">Tutta la provincia di Vicenza</option>
                <optgroup label="Un solo comune">
                  {elenco114.map((c) => (
                    <option key={c.istat} value={c.istat}>
                      {c.nome}
                    </option>
                  ))}
                </optgroup>
              </select>

              <Cursore
                icona="☀️"
                etichetta="Case con fotovoltaico"
                valore={macro.pctFV}
                onChange={(v) => aggiornaMacro({ pctFV: v })}
              />
              <Cursore
                icona="🔥"
                etichetta="Case senza gas"
                valore={macro.pctSenzaGas}
                onChange={(v) => aggiornaMacro({ pctSenzaGas: v })}
              />
              <Cursore
                icona="🧱"
                etichetta="Case ben isolate"
                valore={macro.pctIsolamentoBuono}
                onChange={(v) => aggiornaMacro({ pctIsolamentoBuono: v })}
              />

              <div className="sim-azioni">
                <button
                  type="button"
                  className="sim-btn sim-btn--primario"
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
                  ☀️ Prova: fotovoltaico su tutte le case
                </button>
                <button type="button" className="sim-btn sim-btn--testo" onClick={() => st.setMacro(null)}>
                  Azzera
                </button>
              </div>
            </div>

            <div className="sim-macro__esito">
              <h4 className="sim-sottotitolo">Effetto su {comuneTarget?.nome}</h4>
              {statoRealeTarget && statoScenarioTarget && (
                <>
                  <Confronto
                    prima={statoRealeTarget.totale}
                    dopo={statoScenarioTarget.totale}
                    etichettaPrima="Ambiente oggi"
                    etichettaDopo="Ambiente dopo"
                    coloreDopo={coloreFascia(statoScenarioTarget.fascia)}
                  />
                  <Confronto
                    prima={statoRealeTarget.indiceCaseMedio}
                    dopo={statoScenarioTarget.indiceCaseMedio}
                    etichettaPrima="Case oggi"
                    etichettaDopo="Case dopo"
                    coloreDopo="var(--sim-verde)"
                  />
                  <p className="sim-nota">Indice delle case: dati dimostrativi.</p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Nota obbligatoria: "modello semplificato e indicativo" */}
      <details className="sim-dettagli sim-dettagli--nota">
        <summary>ℹ️ Modello semplificato e indicativo · come si calcola?</summary>
        <ul>
          <li>Ogni infrastruttura vale un punteggio fisso: parco +5, pista ciclabile +3, colonnine +2, strada principale −8, industria −12.</li>
          <li>Le infrastrutture già esistenti contano al massimo ±20 punti.</li>
          <li>I comuni confinanti ricevono metà dell&apos;effetto delle tue modifiche.</li>
          <li>I cursori “Tutti insieme” migliorano l&apos;aria al massimo di +10 punti.</li>
        </ul>
      </details>
    </div>
  )
}
