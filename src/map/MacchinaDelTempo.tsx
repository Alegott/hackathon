import { useEffect, useMemo } from "react"
import { dataset } from "../data/dataset"
import { scenarioVuoto } from "../engine"
import { fotogrammi, PIANI, type Riepilogo } from "../engine/tempo"
import { duePassi, èPersonale, pianoPersonale } from "../engine/personale"
import { avviaTuo2040 } from "../app/tuo2040"
import { CASA_DEMO_DEFAULT } from "../ui/SezioneCasa"
import type { StatoComune } from "../types"
import { store, storeTempo, useApp, useMomento, useTempo } from "../app/useApp"

// Durata di un anno in riproduzione: 2025 → 2040 in circa 12 secondi.
const MS_PER_ANNO = 800
// Passo con cui l'anno avanza durante la riproduzione: limita i ricalcoli della mappa.
const PASSO = 0.2

const num = (n: number, decimali = 0) => n.toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali })
const buoni = (r: Riepilogo) => r.perFascia.ottima
const fascia = (s: StatoComune | undefined) => (s ? `${s.fascia} (${num(s.totale)}/100)` : "—")

function baseCorrente() {
  const st = store.getState()
  return { base: st.modalita === "scenario" ? st.scenario : scenarioVuoto(), casa: st.casaUtente ?? undefined }
}

function Contatore({ etichetta, valore, decimali = 0, unita, partenza, meglioSeScende = false }: {
  etichetta: string; valore: number; decimali?: number; unita: string; partenza: number; meglioSeScende?: boolean
}) {
  const delta = valore - partenza
  const buono = meglioSeScende ? delta < -0.05 : delta > 0.05
  const cattivo = meglioSeScende ? delta > 0.05 : delta < -0.05
  return (
    <div className={`tempo-contatore ${buono ? "tempo-contatore--su" : cattivo ? "tempo-contatore--giu" : ""}`}>
      <span className="tempo-contatore__etichetta">{etichetta}</span>
      <strong>{num(valore, decimali)}<small>{unita}</small></strong>
    </div>
  )
}

export function MacchinaDelTempo() {
  const attivo = useTempo((s) => s.attivo)
  const inRiproduzione = useTempo((s) => s.inRiproduzione)
  const piano = useTempo((s) => s.piano)
  const concluso = useTempo((s) => s.concluso)
  const fot = useTempo((s) => s.fotogrammi)
  const momento = useMomento()
  const sezione = useApp((s) => s.sezione)
  // La casa della sezione Casa: base del "tuo 2040".
  const casa = useApp((s) => s.casaUtente) ?? CASA_DEMO_DEFAULT
  const nomeComune = dataset.comuni.find((c) => c.istat === casa.comune)?.nome ?? "il tuo comune"
  const personale = èPersonale(piano)
  // Nel confronto "+ 2 passi" serve anche dove saresti arrivato restando come sei.
  const comeTe = useMemo(() => {
    if (piano.id !== "due-passi" || !concluso) return null
    const { base, casa: c } = baseCorrente()
    return fotogrammi(dataset, pianoPersonale(casa, "come-te").piano, base, c).at(-1)!.indici[casa.comune]
  }, [piano.id, concluso, casa])

  // Riproduzione: l'anno avanza con il tempo reale, a passi discreti.
  useEffect(() => {
    if (!inRiproduzione) return
    let frame = 0
    let ultimo = performance.now()
    let anno = storeTempo.getState().anno
    const passo = (ora: number) => {
      anno += (ora - ultimo) / MS_PER_ANNO
      ultimo = ora
      const st = storeTempo.getState()
      if (anno >= st.piano.annoFine) return st.concludi()
      const q = Math.floor(anno / PASSO) * PASSO
      if (Math.abs(q - st.anno) > 1e-6) st.setAnno(q)
      frame = requestAnimationFrame(passo)
    }
    frame = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(frame)
  }, [inRiproduzione])

  // La barra spaziatrice avvia e ferma la riproduzione mentre la macchina è aperta.
  useEffect(() => {
    if (!attivo) return
    const tasto = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, button")) return
      if (e.key === " ") {
        e.preventDefault()
        const st = storeTempo.getState()
        if (st.inRiproduzione) st.pausa()
        else st.play()
      } else if (e.key === "Escape") storeTempo.getState().chiudi()
    }
    window.addEventListener("keydown", tasto)
    return () => window.removeEventListener("keydown", tasto)
  }, [attivo])

  if (sezione !== "mappa") return null

  if (!attivo || !momento || !fot.length) {
    return (
      <button type="button" className="tempo-apri" onClick={() => {
        const { base, casa } = baseCorrente()
        storeTempo.getState().apri(dataset, base, casa)
      }}>
        <span aria-hidden="true">🕰</span> Viaggia al 2040
      </button>
    )
  }

  const inizio = fot[0]!.riepilogo
  const fine = fot.at(-1)!.riepilogo
  const r = momento.riepilogo
  const annoIntero = Math.floor(momento.anno + 1e-6)
  const st = storeTempo.getState()

  return (
    <>
      {concluso && (
        <section className="tempo-finale" aria-labelledby="tempo-finale-titolo">
          <span className="tempo-finale__eyebrow">{piano.nome} · {piano.annoInizio} → {piano.annoFine}</span>
          {personale ? <>
            <h3 id="tempo-finale-titolo">
              {piano.id === "come-te"
                ? `Se tutti vivessero come te, nel ${piano.annoFine} ${nomeComune} sarebbe in fascia ${fascia(fot.at(-1)!.indici[casa.comune])}`
                : `Con ${duePassi(casa.dotazioni).passi.join(" e ") || "le tue scelte"}, ${nomeComune} arriverebbe in fascia ${fascia(fot.at(-1)!.indici[casa.comune])}`}
            </h3>
            <p className="tempo-finale__tu">
              Oggi {nomeComune} è in fascia {fascia(fot[0]!.indici[casa.comune])}.
              {comeTe && <> Restando come sei: fascia {fascia(comeTe)}.</>}
            </p>
          </> : (
            <h3 id="tempo-finale-titolo">
              {fine.indiceMedio < inizio.indiceMedio
                ? `L'indice medio scende da ${num(inizio.indiceMedio)} a ${num(fine.indiceMedio)}`
                : `${buoni(fine)} comuni su 114 in fascia ottima`}
            </h3>
          )}
          <dl>
            <div><dt>PM10 medio</dt><dd>{num(inizio.pm10Medio, 1)} → <b>{num(fine.pm10Medio, 1)}</b> µg/m³</dd></div>
            <div><dt>Case con fotovoltaico</dt><dd>{num(inizio.pctFV)}% → <b>{num(fine.pctFV)}%</b></dd></div>
            <div><dt>Costruito</dt><dd>+{fine.crescita.case} case · +{fine.crescita.industrie} capannoni · +{num(fine.crescita.stradeKm)} km strade · +{fine.crescita.parchi} parchi{fine.crescita.nucleari > 0 && ` · ${fine.crescita.nucleari} reattore SMR`}</dd></div>
            <div><dt>Auto in circolazione</dt><dd>{num(inizio.auto / 1000)} → <b>{num(fine.auto / 1000)}</b> mila</dd></div>
            <div><dt>Indice ambientale medio</dt><dd>{num(inizio.indiceMedio)} → <b>{num(fine.indiceMedio)}</b></dd></div>
          </dl>
          <div className="tempo-finale__azioni">
            {piano.id === "come-te" && duePassi(casa.dotazioni).passi.length > 0 && (
              <button type="button" onClick={() => avviaTuo2040(casa, "due-passi")}>👣 E se facessi 2 passi?</button>
            )}
            {piano.id === "due-passi" && <button type="button" onClick={() => avviaTuo2040(casa, "come-te")}>↺ Rivedi "Tutti come te"</button>}
            {!personale && <button type="button" onClick={() => st.play()}>↺ Rivedi</button>}
            <button type="button" onClick={() => st.chiudi()}>Torna al presente</button>
          </div>
        </section>
      )}
      <section className="tempo-barra" aria-label="Macchina del tempo">
        <div className="tempo-riga">
          <button type="button" className="tempo-play" onClick={() => (inRiproduzione ? st.pausa() : st.play())}
            aria-label={inRiproduzione ? "Pausa" : "Avvia la riproduzione"}>
            {inRiproduzione ? "❚❚" : "▶"}
          </button>
          <div className="tempo-anno" aria-live="off">{annoIntero}</div>
          <input type="range" className="tempo-cursore" min={piano.annoInizio} max={piano.annoFine} step={0.1}
            value={momento.anno} aria-label="Anno"
            onChange={(e) => { st.pausa(); st.setAnno(Number(e.target.value)) }} />
          <button type="button" className="tempo-chiudi" onClick={() => st.chiudi()} aria-label="Torna al presente" title="Torna al presente (Esc)">✕</button>
        </div>
        <div className="tempo-piani" role="radiogroup" aria-label="Piano">
          {PIANI.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={p.id === piano.id} title={p.descrizione}
              className={p.id === "passo-indietro" ? "tempo-piano--rischio" : ""}
              onClick={() => {
                const { base, casa } = baseCorrente()
                st.scegliPiano(dataset, p, base, casa)
                storeTempo.getState().play()
              }}>
              {p.nome}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={piano.id === "come-te"} className="tempo-piano--tuo"
            title="La tua casa (sezione Casa) moltiplicata per tutta la provincia" onClick={() => avviaTuo2040(casa, "come-te")}>
            👤 Tutti come te
          </button>
          <button type="button" role="radio" aria-checked={piano.id === "due-passi"} className="tempo-piano--tuo"
            title="Come te, più i due interventi che ti fanno salire di più" onClick={() => avviaTuo2040(casa, "due-passi")}>
            👣 + 2 passi
          </button>
        </div>
        <div className="tempo-contatori">
          <Contatore etichetta="Comuni in fascia ottima" valore={r.perFascia.ottima} unita="/114" partenza={inizio.perFascia.ottima} />
          <Contatore etichetta="PM10 medio" valore={r.pm10Medio} decimali={1} unita=" µg/m³" partenza={inizio.pm10Medio} meglioSeScende />
          <Contatore etichetta="Case con fotovoltaico" valore={r.pctFV} unita="%" partenza={inizio.pctFV} />
          <Contatore etichetta="Indice medio" valore={r.indiceMedio} unita="/100" partenza={inizio.indiceMedio} />
          <Contatore etichetta="Auto in circolazione" valore={r.auto / 1000} unita=" mila" partenza={inizio.auto / 1000} meglioSeScende />
        </div>
        <div className="tempo-crescita" aria-label={`Costruito dal ${piano.annoInizio}`}>
          <span className="tempo-crescita__titolo">Costruito dal {piano.annoInizio}</span>
          <span title="Case nuove (classe energetica quasi zero, obbligatoria dal 2021)">🏠 +{r.crescita.case} case</span>
          <span className={r.crescita.industrie ? "tempo-crescita--peso" : ""}>🏭 +{r.crescita.industrie} capannoni</span>
          <span className={r.crescita.stradeKm >= 1 ? "tempo-crescita--peso" : ""}>🛣 +{num(r.crescita.stradeKm)} km strade</span>
          <span className={r.crescita.parchi ? "tempo-crescita--bene" : ""}>🌳 +{r.crescita.parchi} parchi</span>
          <span className={r.crescita.ciclabiliKm >= 1 ? "tempo-crescita--bene" : ""}>🚲 +{num(r.crescita.ciclabiliKm)} km ciclabili</span>
          {r.crescita.nucleari > 0 && <span className="tempo-crescita--bene" title="Piccolo reattore modulare (SMR): ipotesi">⚛️ +{r.crescita.nucleari} reattore SMR</span>}
        </div>
        <ol className="tempo-cronaca" aria-label="Cronaca" aria-live="polite">
          {momento.cronaca.slice(-2).reverse().map((v) => (
            <li key={v.anno + v.descrizione}><b>{v.anno}</b> {v.descrizione}</li>
          ))}
          {!momento.cronaca.length && <li className="tempo-cronaca--vuota">Premi ▶: anno dopo anno compariranno le nuove opere.</li>}
        </ol>
        <p className="tempo-ipotesi">
          Proiezione illustrativa · PM10 {piano.trendPm10PctAnno > 0 ? "+" : ""}{num(piano.trendPm10PctAnno, 1)}% l'anno
          {piano.obiettivi.pctFV > 0 && <> · al {piano.annoFine}: fotovoltaico {piano.obiettivi.pctFV}%, senza gas {piano.obiettivi.pctSenzaGas}%, isolamento buono {piano.obiettivi.pctIsolamentoBuono}% delle case</>}
          {" "}· crescita: {num(piano.crescita.industrieAnno, 1)} capannoni, {num(piano.crescita.stradeAnno, 1)} strade, {num(piano.crescita.parchiAnno, 1)} parchi, {num(piano.crescita.ciclabiliAnno, 1)} ciclabili e +{num(piano.crescita.casePctAnno, 1)}% case l'anno, auto per famiglia {piano.motorizzazionePctAnno > 0 ? "+" : ""}{num(piano.motorizzazionePctAnno, 1)}% l'anno (parco auto iniziale stimato) · modello semplificato
        </p>
      </section>
    </>
  )
}
