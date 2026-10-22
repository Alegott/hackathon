import React from "react"
import { punteggioCasa } from "../engine"
import type { Classe, Dotazioni } from "../types"

export const META_CLASSI: Record<
  Classe,
  { colore: string; bg: string; soglia: number; descrizione: string }
> = {
  A: { colore: "#15803d", bg: "#dcfce7", soglia: 86, descrizione: "Eccellente — Casa a quasi zero emissioni" },
  B: { colore: "#4d7c0f", bg: "#ecfccb", soglia: 72, descrizione: "Ottima efficienza energetica" },
  C: { colore: "#0f766e", bg: "#ccfbf1", soglia: 58, descrizione: "Buona sostenibilità domestica" },
  D: { colore: "#b45309", bg: "#fef3c7", soglia: 43, descrizione: "Media — Diversi interventi consigliati" },
  E: { colore: "#c2410c", bg: "#ffedd5", soglia: 29, descrizione: "Bassa efficienza — Consumi elevati" },
  F: { colore: "#b91c1c", bg: "#fee2e2", soglia: 15, descrizione: "Scarsa efficienza energetica" },
  G: { colore: "#7f1d1d", bg: "#fecaca", soglia: 0, descrizione: "Minima efficienza — Priorità di riqualificazione" },
}

const ORDINE_CLASSI: Classe[] = ["A", "B", "C", "D", "E", "F", "G"]

const ETICHETTA_DOTAZIONE_MANCANTE: Record<string, string> = {
  fotovoltaico: "☀️ Installazione impianto fotovoltaico",
  solareTermico: "🌡️ Pannelli per solare termico (acqua calda)",
  riscaldamento: "♨️ Passaggio a pompa di calore elettrica",
  cottura: "🍳 Passaggio a piano cottura a induzione",
  isolamento: "🧱 Miglioramento isolamento termico a livello buono (cappotto)",
  infissi: "🪟 Sostituzione infissi con doppio/triplo vetro",
  colonninaEV: "🔌 Installazione colonnina di ricarica EV domestica",
}

export const DashboardCasa: React.FC<{
  dotazioni: Dotazioni
  onApriSimulatore?: () => void
}> = ({ dotazioni, onApriSimulatore }) => {
  const { punteggio, classe, mancanti } = punteggioCasa(dotazioni)
  const meta = META_CLASSI[classe]

  const idxAttuale = ORDINE_CLASSI.indexOf(classe)
  const classeSuperiore = idxAttuale > 0 ? ORDINE_CLASSI[idxAttuale - 1] : null
  const puntiAllaSuperiore = classeSuperiore
    ? Math.max(1, META_CLASSI[classeSuperiore].soglia - punteggio)
    : 0

  return (
    <section className="dashboard-casa" aria-label="Dashboard punteggio e classe della casa">
      <div className="dashboard-casa__header">
        <div
          className="badge-classe-grande"
          style={{ backgroundColor: meta.bg, color: meta.colore, borderColor: meta.colore }}
        >
          <span className="badge-classe-grande__punti">{punteggio}</span>
          <small>/ 100 pt</small>
        </div>

        <div className="dashboard-casa__info">
          <span className="eyebrow-tag">Valutazione Sostenibilità Casa</span>
          <h3>
            Classe Energetica <span style={{ color: meta.colore }}>{classe}</span>
          </h3>
          <p>{meta.descrizione}</p>
          {classeSuperiore ? (
            <p className="avviso-salto-classe">
              🎯 Ti mancano <strong>{puntiAllaSuperiore} punti</strong> per salire in{" "}
              <strong>Classe {classeSuperiore}</strong> (soglia {META_CLASSI[classeSuperiore].soglia} pt).
            </p>
          ) : (
            <p className="avviso-salto-classe">
              🏆 Complimenti! Hai raggiunto la massima <strong>Classe A</strong>.
            </p>
          )}
        </div>
      </div>

      {/* Barra classi A–G */}
      <div className="scala-classi" role="list" aria-label="Scala classi da A a G">
        {ORDINE_CLASSI.map((c) => {
          const attiva = c === classe
          const m = META_CLASSI[c]
          return (
            <div
              key={c}
              role="listitem"
              className={`scala-classi__cella ${attiva ? "scala-classi__cella--attiva" : ""}`}
              style={{
                backgroundColor: attiva ? m.colore : m.bg,
                color: attiva ? "#fff" : m.colore,
              }}
            >
              <strong>Classe {c}</strong>
              <small>≥ {m.soglia} pt</small>
            </div>
          )
        })}
      </div>

      {/* Cosa ti manca per salire */}
      <div className="mancanti-card">
        <div className="mancanti-card__top">
          <div>
            <h4>Cosa ti manca per salire</h4>
            <small>Interventi consigliati ordinati per punti guadagnabili</small>
          </div>
          {onApriSimulatore && (
            <button type="button" className="btn-sec btn-sm" onClick={onApriSimulatore}>
              ⚡ Simula interventi →
            </button>
          )}
        </div>

        {mancanti.length === 0 ? (
          <p className="mancanti-vuoto">
            ✅ Tutte le dotazioni sostenibili sono già presenti nella tua casa!
          </p>
        ) : (
          <ul className="mancanti-lista">
            {mancanti.map((m) => {
              const etichetta = ETICHETTA_DOTAZIONE_MANCANTE[m.dotazione] ?? m.dotazione
              const consenteSalto = classeSuperiore !== null && m.punti >= puntiAllaSuperiore
              return (
                <li key={m.dotazione} className="mancanti-riga">
                  <div>
                    <span>{etichetta}</span>
                    {consenteSalto && classeSuperiore && (
                      <span className="pill-salto">Salto in Classe {classeSuperiore}</span>
                    )}
                  </div>
                  <strong className="val-pos">+{m.punti} pt</strong>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
