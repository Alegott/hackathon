import React, { useEffect, useMemo, useRef, useState } from "react"
import { store, useApp } from "../app/useApp"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { applicaOggetto, togliOggetto, type Oggetto } from "../casa/oggetti"
import { Palco } from "../casa/Palco"
import { Palette, TIPO_DRAG } from "../casa/Palette"
import { Icona } from "../casa/icone"
import { punteggioCasa } from "../engine"
import { ClassificaCard } from "../casa/ClassificaCard"
import type { Casa } from "../types"
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

          <section className="scheda">
            <h3>Per salire di classe</h3>
            {mancanti.length === 0 ? (
              <p className="vuoto">Hai tutto. Casa al massimo ✨</p>
            ) : (
              <ul className="suggerimenti">
                {mancanti.slice(0, 4).map((m) => {
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
