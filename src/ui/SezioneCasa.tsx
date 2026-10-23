import React, { useEffect, useMemo, useRef, useState } from "react"
import { store, useApp } from "../app/useApp"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { applicaOggetto, togliOggetto, type Oggetto } from "../casa/oggetti"
import { Palco } from "../casa/Palco"
import { Palette, TIPO_DRAG } from "../casa/Palette"
import { Icona, IconaAuto } from "../casa/icone"
import { classeAuto, punteggioCasa, puntiGiardino } from "../engine"
import { PESI_GIARDINO, PESO_MASSIMO_GIARDINO } from "../engine/costanti"
import { ClassificaCard } from "../casa/ClassificaCard"
import { META_CLASSI } from "./DashboardCasa"
import { MAX_ALBERI_VISIBILI } from "../casa/vista"
import type { Alimentazione, Auto, Casa, CategoriaEuro, Giardino, TipoAlbero } from "../types"
import "../casa/casa.css"

export const CASA_DEMO_DEFAULT: Casa = {
  id: "casa-utente-demo",
  comune: dataset.comuni[0]?.istat ?? "024001",
  pubblico: true,
  nickname: "Casa Demo Fam. Rossi",
  dotazioni: {
    fotovoltaico: false,
    solareTermico: false,
    riscaldamento: "condensazione",
    cottura: "gas",
    isolamento: "medio",
    infissi: true,
    colonninaEV: false,
    giardino: { alberi: { latifoglia: 2, conifera: 2 } },
  },
}

// Salvataggio diretto in localStorage con try/catch + aggiornamento dello store Zustand
export function salvaCasaConTryCatch(casa: Casa): boolean {
  store.getState().setCasaUtente(casa)
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("casa-utente", JSON.stringify(casa))
      return true
    }
  } catch {
    // Fallback in memoria gestito dallo store se localStorage è disabilitato o lancia eccezione
  }
  return false
}

// Per ogni dotazione mancante, l'oggetto migliore da proporre.
const MIGLIORE: Record<string, { oggetto: Oggetto; etichetta: string }> = {
  fotovoltaico: { oggetto: "fotovoltaico", etichetta: "Fotovoltaico" },
  solareTermico: { oggetto: "solareTermico", etichetta: "Solare termico" },
  riscaldamento: { oggetto: "pompa_calore", etichetta: "Pompa di calore" },
  cottura: { oggetto: "induzione", etichetta: "Piano a induzione" },
  isolamento: { oggetto: "isolamento_buono", etichetta: "Isolamento a cappotto" },
  infissi: { oggetto: "infissi", etichetta: "Doppi vetri" },
  colonninaEV: { oggetto: "colonninaEV", etichetta: "Colonnina EV" },
}

const ALIMENTAZIONI: { id: Alimentazione; etichetta: string }[] = [
  { id: "benzina", etichetta: "Benzina" },
  { id: "diesel", etichetta: "Diesel" },
  { id: "gpl", etichetta: "GPL" },
  { id: "ibrido", etichetta: "Ibrida" },
  { id: "elettrico", etichetta: "Elettrica" },
]
const CATEGORIE_EURO: CategoriaEuro[] = [0, 1, 2, 3, 4, 5, 6]

// Auto di casa: alimentazione e categoria Euro pesano sul punteggio e cambiano la macchina nel 3D.
function SchedaAuto({ auto, onCambia }: { auto: Auto | null; onCambia: (a: Auto | null) => void }) {
  const classe = auto ? classeAuto(auto) : null
  return (
    <section className="scheda">
      <div className="auto-testa">
        <h3>La mia auto</h3>
        {classe && (
          <span className="auto-classe" style={{ background: META_CLASSI[classe].bg, color: META_CLASSI[classe].colore }}>
            Auto classe {classe}
          </span>
        )}
      </div>
      <div className="campo">
        <span id="auto-alim">Alimentazione</span>
        <div className="auto-scelte" role="group" aria-labelledby="auto-alim">
          <button type="button" aria-pressed={!auto} onClick={() => onCambia(null)}>Nessuna</button>
          {ALIMENTAZIONI.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={auto?.alimentazione === a.id}
              onClick={() => onCambia({ alimentazione: a.id, euro: auto?.euro ?? 6 })}
            >
              {a.etichetta}
            </button>
          ))}
        </div>
      </div>
      {auto && auto.alimentazione !== "elettrico" && (
        <div className="campo">
          <span id="auto-euro">Categoria Euro</span>
          <div className="auto-scelte auto-scelte--euro" role="group" aria-labelledby="auto-euro">
            {CATEGORIE_EURO.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={auto.euro === e}
                aria-label={`Euro ${e}`}
                onClick={() => onCambia({ ...auto, euro: e })}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="vuoto auto-nota">
        {!auto
          ? "Senza auto il punteggio dipende solo dalla casa."
          : auto.alimentazione === "elettrico"
            ? "Zero emissioni allo scarico: la categoria Euro non conta."
            : "Più alta è la categoria Euro, meno inquina."}
      </p>
    </section>
  )
}

const ALBERI: { id: TipoAlbero; etichetta: string; icona: string }[] = [
  { id: "latifoglia", etichetta: "Latifoglie", icona: "🌳" },
  { id: "conifera", etichetta: "Conifere", icona: "🌲" },
  { id: "frutto", etichetta: "Da frutto", icona: "🍎" },
  { id: "ulivo", etichetta: "Ulivi", icona: "🫒" },
]
const MAX_PER_TIPO = 8
// giardino undefined = non ancora indicato: nessuna delle due risposte è selezionata e non pesa sul punteggio.
function SchedaGiardino({ giardino, onCambia }: { giardino: Giardino | null | undefined; onCambia: (g: Giardino | null) => void }) {
  const punti = giardino === undefined ? null : puntiGiardino(giardino)
  const totale = giardino ? Object.values(giardino.alberi).reduce((a, n) => a + (n ?? 0), 0) : 0
  const imposta = (tipo: TipoAlbero, n: number) =>
    giardino && onCambia({ alberi: { ...giardino.alberi, [tipo]: Math.max(0, Math.min(MAX_PER_TIPO, n)) } })
  return (
    <section className="scheda">
      <div className="auto-testa">
        <h3>Il mio giardino</h3>
        {punti !== null && <span className="auto-classe giardino-totale">{giardino ? `${totale === 1 ? "1 albero" : `${totale} alberi`} · ` : ""}{punti}/{PESO_MASSIMO_GIARDINO} pt</span>}
      </div>
      <div className="campo">
        <span id="giardino-si">Hai un giardino?</span>
        <div className="auto-scelte" role="group" aria-labelledby="giardino-si">
          <button type="button" aria-pressed={!!giardino} onClick={() => !giardino && onCambia({ alberi: {} })}>Sì</button>
          <button type="button" aria-pressed={giardino === null} onClick={() => onCambia(null)}>No</button>
        </div>
      </div>
      {giardino && (
        <ul className="giardino-alberi">
          {ALBERI.map((a) => {
            const n = giardino.alberi[a.id] ?? 0
            return (
              <li key={a.id}>
                <span aria-hidden="true" className="giardino-icona">{a.icona}</span>
                <span className="giardino-nome" id={`albero-${a.id}`}>
                  {a.etichetta}
                  <small>{PESI_GIARDINO.alberi[a.id]} pt l'uno</small>
                </span>
                <div className="contatore" role="group" aria-labelledby={`albero-${a.id}`}>
                  <button type="button" aria-label={`Togli un albero: ${a.etichetta}`} disabled={n === 0} onClick={() => imposta(a.id, n - 1)}>−</button>
                  <output aria-live="polite">{n}</output>
                  <button type="button" aria-label={`Aggiungi un albero: ${a.etichetta}`} disabled={n === MAX_PER_TIPO} onClick={() => imposta(a.id, n + 1)}>+</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="vuoto auto-nota">
        {giardino === undefined
          ? "Indica se hai un giardino: prato e alberi alzano il punteggio."
          : !giardino
          ? "Senza giardino la casa ha un cortile pavimentato."
          : totale > MAX_ALBERI_VISIBILI
            ? `Nel modello 3D ne vedi ${MAX_ALBERI_VISIBILI}, ma li contiamo tutti.`
            : `Il prato vale ${PESI_GIARDINO.prato} punti, gli alberi fino a ${PESI_GIARDINO.tettoAlberi}.`}
      </p>
    </section>
  )
}

// Aggiunge latifoglie (l'albero che vale di più) finché il giardino arriva al massimo dei punti.
function conAlberiAlMassimo(g: Giardino | null): Giardino {
  const base: Giardino = g ?? { alberi: {} }
  let latifoglie = base.alberi.latifoglia ?? 0
  while (puntiGiardino({ alberi: { ...base.alberi, latifoglia: latifoglie } }) < PESO_MASSIMO_GIARDINO && latifoglie < MAX_PER_TIPO) latifoglie++
  return { alberi: { ...base.alberi, latifoglia: latifoglie } }
}

export const SezioneCasa: React.FC = () => {
  const casaStore = useApp((s) => s.casaUtente)
  const casa: Casa = casaStore ?? CASA_DEMO_DEFAULT
  const [trascinando, setTrascinando] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [nomeCasa, setNomeCasa] = useState(casa.nickname ?? "")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => setNomeCasa(casa.nickname ?? ""), [casa.nickname])

  const elencoComuni = useMemo(() => {
    const mappa = new Map<string, string>()
    for (const c of dataset.comuni) mappa.set(c.istat, c.nome)
    for (const c of COMUNI_VICENZA_114) if (!mappa.has(c.istat)) mappa.set(c.istat, c.nome)
    return Array.from(mappa, ([istat, nome]) => ({ istat, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "it"))
  }, [])

  // Salvataggio automatico a ogni modifica. Parte sempre dalla casa attuale nello store, non da
  // quella dell'ultimo rendering: due modifiche ravvicinate non si sovrascrivono.
  const aggiorna = (fn: (c: Casa) => Casa) => {
    const nuova = fn(store.getState().casaUtente ?? CASA_DEMO_DEFAULT)
    salvaCasaConTryCatch(nuova)
    setSalvato(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSalvato(false), 1800)
  }
  const modifica = (nuova: Casa) => aggiorna(() => nuova)

  const { mancanti } = punteggioCasa(casa.dotazioni)

  return (
    <div className="casa-v2">
      <div className="casa-testa">
        <div>
          <h2>La mia casa</h2>
          <p>Aggiungi le dotazioni e guarda il punteggio cambiare.</p>
        </div>
        <span className={`casa-salvato${salvato ? " casa-salvato--si" : ""}`} role="status">✓ Salvato</span>
      </div>

      <div className="casa-corpo">
        <Palco
          dotazioni={casa.dotazioni}
          trascinando={trascinando}
          onDrop={(o) => { setTrascinando(false); aggiorna((c) => ({ ...c, dotazioni: applicaOggetto(c.dotazioni, o) })) }}
        />

        <aside className="casa-lato">
          <section className="scheda">
            <h3>Dotazioni</h3>
            <Palette
              dotazioni={casa.dotazioni}
              onScegli={(o, attiva) =>
                aggiorna((c) => ({ ...c, dotazioni: attiva ? togliOggetto(c.dotazioni, o) : applicaOggetto(c.dotazioni, o) }))
              }
              onTrascinaInizio={() => setTrascinando(true)}
              onTrascinaFine={() => setTrascinando(false)}
            />
          </section>

          <SchedaAuto auto={casa.dotazioni.auto ?? null} onCambia={(auto) => aggiorna((c) => ({ ...c, dotazioni: { ...c.dotazioni, auto } }))} />

          <SchedaGiardino
            giardino={casa.dotazioni.giardino}
            onCambia={(giardino) => aggiorna((c) => ({ ...c, dotazioni: { ...c.dotazioni, giardino } }))}
          />

          <section className="scheda">
            <h3>Per salire di classe</h3>
            {mancanti.length === 0 ? (
              <p className="vuoto">Hai tutto. Casa al massimo ✨</p>
            ) : (
              <ul className="suggerimenti">
                {mancanti.slice(0, 4).map((m) => {
                  if (m.dotazione === "auto") {
                    return (
                      <li key="auto">
                        <button
                          type="button"
                          onClick={() => aggiorna((c) => ({ ...c, dotazioni: { ...c.dotazioni, auto: { alimentazione: "elettrico", euro: 6 } } }))}
                        >
                          <IconaAuto size={20} />
                          <span>Auto elettrica</span>
                          <strong>+{m.punti}</strong>
                        </button>
                      </li>
                    )
                  }
                  if (m.dotazione === "giardino") {
                    return (
                      <li key="giardino">
                        <button type="button" onClick={() => aggiorna((c) => ({ ...c, dotazioni: { ...c.dotazioni, giardino: conAlberiAlMassimo(c.dotazioni.giardino ?? null) } }))}>
                          <span aria-hidden="true" className="giardino-icona">🌳</span>
                          <span>{casa.dotazioni.giardino ? "Pianta altri alberi" : "Un giardino con alberi"}</span>
                          <strong>+{m.punti}</strong>
                        </button>
                      </li>
                    )
                  }
                  const s = MIGLIORE[m.dotazione]
                  if (!s) return null
                  return (
                    <li key={m.dotazione}>
                      <button
                        type="button"
                        draggable
                        onClick={() => aggiorna((c) => ({ ...c, dotazioni: applicaOggetto(c.dotazioni, s.oggetto) }))}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(TIPO_DRAG, s.oggetto)
                          e.dataTransfer.setData("text/plain", s.oggetto)
                          e.dataTransfer.effectAllowed = "copy"
                          setTrascinando(true)
                        }}
                        onDragEnd={() => setTrascinando(false)}
                      >
                        <Icona oggetto={s.oggetto} size={20} />
                        <span>{s.etichetta}</span>
                        <strong>+{m.punti}</strong>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="scheda scheda--profilo">
            <h3>Profilo</h3>
            <label className="campo">
              <span>Comune</span>
              <select value={casa.comune} onChange={(e) => aggiorna((c) => ({ ...c, comune: e.target.value }))}>
                {elencoComuni.map((c) => <option key={c.istat} value={c.istat}>{c.nome}</option>)}
              </select>
            </label>
            <div className="campo">
              <span>Visibilità in classifica</span>
              <div className="segmenti" role="group" aria-label="Visibilità del profilo">
                <button type="button" className={casa.pubblico ? "on" : ""} onClick={() => aggiorna((c) => ({ ...c, pubblico: true }))}>Pubblico</button>
                <button type="button" className={!casa.pubblico ? "on" : ""} onClick={() => aggiorna((c) => ({ ...c, pubblico: false }))}>Privato</button>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (nomeCasa.trim()) aggiorna((c) => ({ ...c, nickname: nomeCasa.trim() })) }}>
              <label className="campo">
                <span>Nome della casa (obbligatorio)</span>
                <input type="text" required pattern=".*\S.*" value={nomeCasa} maxLength={32} placeholder="Dai un nome alla tua casa" onChange={(e) => setNomeCasa(e.target.value)} onBlur={() => { if (nomeCasa.trim()) aggiorna((c) => ({ ...c, nickname: nomeCasa.trim() })) }} />
              </label>
              <button type="submit">Salva nome casa</button>
            </form>
            <button type="button" className="link" onClick={() => modifica(CASA_DEMO_DEFAULT)}>Ripristina casa demo</button>
          </section>
        </aside>
      </div>

      <ClassificaCard comuneIstat={casa.comune} onChangeComune={(istat) => aggiorna((c) => ({ ...c, comune: istat }))} utente={casa} />
    </div>
  )
}
