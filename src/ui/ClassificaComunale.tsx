import React, { useId } from "react"
import { classifica, punteggioCasa } from "../engine"
import { dataset } from "../data/dataset"
import { useApp, useIndici } from "../app/useApp"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { META_CLASSI } from "./DashboardCasa"
import type { Dotazioni } from "../types"

export function etichetteDotazioni(d: Dotazioni): string[] {
  const out: string[] = []
  if (d.fotovoltaico) out.push("☀️ Fotovoltaico")
  if (d.solareTermico) out.push("🌡️ Solare termico")
  if (d.riscaldamento === "pompa_calore") out.push("♨️ Pompa di calore")
  else if (d.riscaldamento === "condensazione") out.push("🔥 Caldaia condensazione")
  else out.push("🛢️ Caldaia tradiz.")

  if (d.cottura === "induzione") out.push("⚡ Induzione")
  else out.push("🔥 Gas")

  if (d.isolamento === "buono") out.push("🧱 Isolamento buono")
  else if (d.isolamento === "medio") out.push("🧱 Isolamento medio")
  else out.push("🧱 Isolamento scarso")

  if (d.infissi) out.push("🪟 Infissi doppio/triplo vetro")
  if (d.colonninaEV) out.push("🔌 Colonnina EV")
  return out
}

export const ClassificaComunale: React.FC<{
  comuneIstat: string
  onChangeComune?: (istat: string) => void
}> = ({ comuneIstat, onChangeComune }) => {
  const casaUtente = useApp((s) => s.casaUtente)
  const indici = useIndici()
  const captionId = useId()

  // Elenco combinato (include eventuali comuni mock + tutti i 114 comuni ISTAT)
  const elencoComuni = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const c of dataset.comuni) map.set(c.istat, c.nome)
    for (const c of COMUNI_VICENZA_114) {
      if (!map.has(c.istat)) map.set(c.istat, c.nome)
    }
    return Array.from(map.entries()).map(([istat, nome]) => ({ istat, nome }))
  }, [])

  const nomeComune =
    elencoComuni.find((c) => c.istat === comuneIstat)?.nome ?? comuneIstat

  const tutteLeCase = React.useMemo(() => {
    const base = dataset.caseSeed
    if (!casaUtente) return base
    return [...base.filter((c) => c.id !== casaUtente.id), casaUtente]
  }, [casaUtente])

  const righe = classifica(tutteLeCase, comuneIstat)
  const indiceMedio = Math.round(indici[comuneIstat]?.indiceCaseMedio ?? 0)

  return (
    <section className="classifica-comunale" aria-label="Classifica comunale delle abitazioni">
      <div className="classifica-comunale__header">
        <div>
          <div className="classifica-comunale__badges">
            <span className="eyebrow-tag">Confronto nel tuo comune</span>
            <span className="etichetta-dimostrativa-pill">dati dimostrativi</span>
          </div>
          <h3>Classifica comunale — {nomeComune}</h3>
          <p className="classifica-comunale__nota-privacy">
            🔒 <strong>Regole privacy:</strong> i profili pubblici compaiono con nickname,
            punteggio e dotazioni; i profili privati compaiono in forma anonima con le{" "}
            <em>sole dotazioni</em> (senza nome né punteggio). Il comune è mostrato solo come
            aggregato. Le case seed sono sintetiche (<strong>dati dimostrativi</strong>).
          </p>
        </div>

        <div className="classifica-comunale__controlli">
          {onChangeComune && (
            <label className="select-inline-label">
              <span>Comune classifica:</span>
              <select
                value={comuneIstat}
                onChange={(e) => onChangeComune(e.target.value)}
                className="input-select"
              >
                {elencoComuni.map((c) => (
                  <option key={c.istat} value={c.istat}>
                    {c.nome} ({c.istat})
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="indice-medio-pill">
            <span>Indice case medio</span>
            <strong>{indiceMedio} / 100</strong>
            <small>dati dimostrativi</small>
          </div>
        </div>
      </div>

      {righe.length === 0 ? (
        <div className="classifica-vuota">
          Nessuna abitazione censita per {nomeComune}. Salva la tua casa in questo comune per
          inaugurare la classifica!
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper"
        >
          <table
            className="classifica-table"
            style={
              {
                "--label-2": '"Profilo / Casa"',
                "--label-3": '"Punteggio"',
                "--label-4": '"Dotazioni"',
              } as React.CSSProperties
            }
          >
            <caption id={captionId} className="sr-only">
              Classifica sostenibilità domestica del comune di {nomeComune}
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Profilo / Casa</th>
                <th scope="col">Punteggio</th>
                <th scope="col">Dotazioni</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r, idx) => {
                const isPubblico = r.punteggio !== undefined
                const classe =
                  r.punteggio !== undefined ? punteggioCasa(r.dotazioni).classe : null
                const meta = classe ? META_CLASSI[classe] : null
                const chips = etichetteDotazioni(r.dotazioni)
                const isMiaCasa =
                  casaUtente?.comune === comuneIstat &&
                  ((casaUtente.pubblico && r.nome === casaUtente.nickname) ||
                    (!casaUtente.pubblico && !isPubblico && idx === righe.length - 1))

                return (
                  <tr key={idx} className={isMiaCasa ? "riga-utente" : ""}>
                    <th scope="row">#{idx + 1}</th>
                    <td>
                      <div className="cella-profilo">
                        {isPubblico ? (
                          <strong>{r.nome || "Casa pubblica"}</strong>
                        ) : (
                          <span className="testo-anonimo">
                            🔒 Profilo privato (anonimo)
                          </span>
                        )}
                        {isMiaCasa ? (
                          <span className="pill-mia-casa">La tua casa</span>
                        ) : (
                          <span className="etichetta-dimostrativa-pill">
                            dati dimostrativi
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {isPubblico && r.punteggio !== undefined && classe && meta ? (
                        <div className="cella-punteggio">
                          <strong>{r.punteggio} pt</strong>
                          <span
                            className="pill-classe"
                            style={{ backgroundColor: meta.bg, color: meta.colore }}
                          >
                            Classe {classe}
                          </span>
                        </div>
                      ) : (
                        <span className="testo-anonimo">🔒 Nascosto (privato)</span>
                      )}
                    </td>
                    <td>
                      <div className="chips-dotazioni">
                        {chips.map((c) => (
                          <span key={c} className="chip-dotazione">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
