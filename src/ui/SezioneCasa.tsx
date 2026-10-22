import React, { useState, useId, useMemo } from "react"
import { store, useApp } from "../app/useApp"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { DashboardCasa } from "./DashboardCasa"
import { ClassificaComunale } from "./ClassificaComunale"
import type { Casa, Dotazioni } from "../types"

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

export const SezioneCasa: React.FC = () => {
  const casaStore = useApp((s) => s.casaUtente)
  const casaAttiva: Casa = casaStore ?? CASA_DEMO_DEFAULT

  const [filtroComune, setFiltroComune] = useState("")
  const [statoSalvataggio, setStatoSalvataggio] = useState<string>(
    casaStore ? "Salvato in localStorage" : "Profilo demo pronto (clicca Salva o modifica un campo)",
  )

  const idPubblico = useId()
  const idFv = useId()
  const idSolare = useId()
  const idInfissi = useId()
  const idEv = useId()

  // Elenco completo dei 114 comuni della provincia di Vicenza (+ eventuali comuni mock del dataset)
  const elenco114 = useMemo(() => {
    const mappa = new Map<string, string>()
    for (const c of dataset.comuni) mappa.set(c.istat, c.nome)
    for (const c of COMUNI_VICENZA_114) {
      if (!mappa.has(c.istat)) mappa.set(c.istat, c.nome)
    }
    return Array.from(mappa.entries()).map(([istat, nome]) => ({ istat, nome }))
  }, [])

  const comuniFiltrati = useMemo(() => {
    const q = filtroComune.trim().toLowerCase()
    if (!q) return elenco114
    return elenco114.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.istat.toLowerCase().includes(q),
    )
  }, [elenco114, filtroComune])

  const applicaModifica = (nuovaCasa: Casa) => {
    const salvatoSuDisco = salvaCasaConTryCatch(nuovaCasa)
    const ora = new Date().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setStatoSalvataggio(
      salvatoSuDisco
        ? `Salvato in localStorage alle ${ora}`
        : `Salvato in memoria (fallback) alle ${ora}`,
    )
  }

  const aggiornaDotazione = <K extends keyof Dotazioni>(chiave: K, valore: Dotazioni[K]) => {
    applicaModifica({
      ...casaAttiva,
      dotazioni: {
        ...casaAttiva.dotazioni,
        [chiave]: valore,
      },
    })
  }

  return (
    <div className="pagina-sezione">
      <div className="intestazione-sezione">
        <div>
          <span className="eyebrow-tag">Modulo 2 · Utente Demo (già autenticato)</span>
          <h2>La mia Casa, Dashboard &amp; Classifica Comunale</h2>
          <p className="sottotitolo-sezione">
            Indica il comune (tra i 114 della provincia di Vicenza) e le dotazioni della tua
            abitazione per calcolare il punteggio 0–100, la classe A–G e confrontarti nella
            classifica comunale.
          </p>
        </div>

        <div className="pill-persistenza" role="status" aria-live="polite">
          <span>💾 {statoSalvataggio}</span>
        </div>
      </div>

      <div className="griglia-casa">
        {/* Form dotazioni, comune (114), interruttore Pubblico/Privato e nickname */}
        <form
          className="card-pannello form-casa"
          onSubmit={(e) => {
            e.preventDefault()
            applicaModifica(casaAttiva)
          }}
          aria-label="Form dotazioni e profilo della casa"
        >
          <h3>1. Comune e Privacy del Profilo</h3>

          <div className="campo-form">
            <label htmlFor="select-comune-casa">
              Comune dell&apos;abitazione (elenco dei {elenco114.length} comuni)
            </label>
            <div className="selettore-comune-114">
              <input
                type="search"
                className="input-testo"
                placeholder="Cerca tra i 114 comuni..."
                value={filtroComune}
                onChange={(e) => setFiltroComune(e.target.value)}
                aria-label="Filtra elenco dei 114 comuni"
              />
              <select
                id="select-comune-casa"
                className="input-select"
                value={casaAttiva.comune}
                onChange={(e) =>
                  applicaModifica({ ...casaAttiva, comune: e.target.value })
                }
              >
                {comuniFiltrati.map((c) => (
                  <option key={c.istat} value={c.istat}>
                    {c.nome} ({c.istat})
                  </option>
                ))}
                {!comuniFiltrati.some((c) => c.istat === casaAttiva.comune) && (
                  <option value={casaAttiva.comune}>
                    {elenco114.find((c) => c.istat === casaAttiva.comune)?.nome ??
                      casaAttiva.comune}
                  </option>
                )}
              </select>
            </div>
            <small className="nota-campo">
              🔒 Senza indirizzo civico: il comune serve solo per l&apos;aggregato territoriale.
            </small>
          </div>

          <div className="box-privacy-form">
            <label htmlFor={idPubblico} className="riga-switch">
              <div>
                <strong>
                  Profilo: {casaAttiva.pubblico ? "🌐 Pubblico" : "🔒 Privato"}
                </strong>
                <small>
                  {casaAttiva.pubblico
                    ? "Compare in classifica comunale con nickname, punteggio e dotazioni."
                    : "Compare in classifica comunale in forma anonima con le sole dotazioni (senza nome né punteggio)."}
                </small>
              </div>
              <input
                id={idPubblico}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={casaAttiva.pubblico}
                onChange={(e) =>
                  applicaModifica({ ...casaAttiva, pubblico: e.target.checked })
                }
              />
            </label>

            <div className="campo-form" style={{ marginTop: "10px", marginBottom: 0 }}>
              <label htmlFor="input-nickname">
                Nickname della casa{" "}
                {!casaAttiva.pubblico && <small>(non esposto se il profilo è privato)</small>}
              </label>
              <input
                id="input-nickname"
                type="text"
                className="input-testo"
                placeholder="Es. Casa Verde Rossi"
                value={casaAttiva.nickname ?? ""}
                disabled={!casaAttiva.pubblico}
                onChange={(e) =>
                  applicaModifica({ ...casaAttiva, nickname: e.target.value })
                }
              />
            </div>
          </div>

          <h3 style={{ marginTop: "18px" }}>2. Dotazioni della tua casa</h3>

          <div className="griglia-switches">
            <label htmlFor={idFv} className="card-switch">
              <div>
                <strong>☀️ Fotovoltaico</strong>
                <small>Pannelli fotovoltaici (+20 pt grezzi)</small>
              </div>
              <input
                id={idFv}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={casaAttiva.dotazioni.fotovoltaico}
                onChange={(e) => aggiornaDotazione("fotovoltaico", e.target.checked)}
              />
            </label>

            <label htmlFor={idSolare} className="card-switch">
              <div>
                <strong>🌡️ Solare termico</strong>
                <small>Acqua calda sanitaria (+10 pt grezzi)</small>
              </div>
              <input
                id={idSolare}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={casaAttiva.dotazioni.solareTermico}
                onChange={(e) => aggiornaDotazione("solareTermico", e.target.checked)}
              />
            </label>

            <label htmlFor={idInfissi} className="card-switch">
              <div>
                <strong>🪟 Infissi doppio/triplo vetro</strong>
                <small>Isolamento finestre (+9 pt grezzi)</small>
              </div>
              <input
                id={idInfissi}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={casaAttiva.dotazioni.infissi}
                onChange={(e) => aggiornaDotazione("infissi", e.target.checked)}
              />
            </label>

            <label htmlFor={idEv} className="card-switch">
              <div>
                <strong>🔌 Colonnina ricarica EV</strong>
                <small>Ricarica auto elettrica (+10 pt grezzi)</small>
              </div>
              <input
                id={idEv}
                type="checkbox"
                {...({ switch: "" } as any)}
                checked={casaAttiva.dotazioni.colonninaEV}
                onChange={(e) => aggiornaDotazione("colonninaEV", e.target.checked)}
              />
            </label>
          </div>

          <div className="campo-form">
            <label htmlFor="select-riscaldamento">♨️ Tipo di riscaldamento</label>
            <select
              id="select-riscaldamento"
              className="input-select"
              value={casaAttiva.dotazioni.riscaldamento}
              onChange={(e) =>
                aggiornaDotazione(
                  "riscaldamento",
                  e.target.value as Dotazioni["riscaldamento"],
                )
              }
            >
              <option value="pompa_calore">Pompa di calore (+20 pt)</option>
              <option value="condensazione">Caldaia a condensazione (+8 pt)</option>
              <option value="tradizionale">Caldaia tradizionale / gasolio (0 pt)</option>
            </select>
          </div>

          <div className="campo-form">
            <label htmlFor="select-cottura">🍳 Piano cottura</label>
            <select
              id="select-cottura"
              className="input-select"
              value={casaAttiva.dotazioni.cottura}
              onChange={(e) =>
                aggiornaDotazione("cottura", e.target.value as Dotazioni["cottura"])
              }
            >
              <option value="induzione">Piano a induzione (+8 pt)</option>
              <option value="gas">Piano a gas (0 pt)</option>
            </select>
          </div>

          <div className="campo-form">
            <label htmlFor="select-isolamento">🧱 Livello di isolamento</label>
            <select
              id="select-isolamento"
              className="input-select"
              value={casaAttiva.dotazioni.isolamento}
              onChange={(e) =>
                aggiornaDotazione("isolamento", e.target.value as Dotazioni["isolamento"])
              }
            >
              <option value="buono">Buono (+15 pt)</option>
              <option value="medio">Medio (+7 pt)</option>
              <option value="scarso">Scarso (0 pt)</option>
            </select>
          </div>

          <div className="azioni-form">
            <button type="submit" className="btn-primario">
              💾 Salva in localStorage
            </button>
            <button
              type="button"
              className="btn-sec"
              onClick={() => applicaModifica(CASA_DEMO_DEFAULT)}
            >
              ↺ Ripristina casa demo
            </button>
          </div>
        </form>

        {/* Dashboard Punteggio, Classe A-G e "Cosa ti manca per salire" */}
        <DashboardCasa
          dotazioni={casaAttiva.dotazioni}
          onApriSimulatore={() => store.getState().setSezione("simulazione")}
        />
      </div>

      {/* Classifica comunale con regole privacy e case seed "dati dimostrativi" */}
      <ClassificaComunale
        comuneIstat={casaAttiva.comune}
        onChangeComune={(istat) => applicaModifica({ ...casaAttiva, comune: istat })}
      />
    </div>
  )
}
