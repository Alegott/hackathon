import { useMemo, useState } from "react"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { META_CLASSI } from "../ui/DashboardCasa"
import type { Casa, Classe, Dotazioni } from "../types"
import { preparaClassifica, type Medaglia, type RigaPrivata, type RigaPubblica } from "./classificaView"
import { Icona } from "./icone"
import { oggettiAttivi } from "./oggetti"

const RIGHE_INIZIALI = 6
// Prima lettera della prima e dell'ultima parola: "Casa demo 9" → "C9", "Casa Mia" → "CM".
const INIZIALI = (nome: string) => {
  const parole = nome.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean)
  if (parole.length === 0) return "C"
  const prima = parole[0]![0]!, ultima = parole[parole.length - 1]![0]!
  return parole.length === 1 ? prima.toUpperCase() : `${prima}${ultima}`.toUpperCase()
}

function PillClasse({ classe }: { classe: Classe }) {
  const m = META_CLASSI[classe]
  return <span className="cl-classe" style={{ background: m.bg, color: m.colore }}>{classe}</span>
}

function Icone({ d, max = 6 }: { d: Dotazioni; max?: number }) {
  const attivi = oggettiAttivi(d)
  return (
    <span className="cl-icone" aria-label={`${attivi.length} dotazioni`}>
      {attivi.slice(0, max).map((o) => <span key={o} className="cl-icona"><Icona oggetto={o} size={15} /></span>)}
      {attivi.length > max && <span className="cl-piu">+{attivi.length - max}</span>}
      {attivi.length === 0 && <span className="cl-nulla">nessuna dotazione</span>}
    </span>
  )
}

function Medaglia({ tipo, n }: { tipo: Medaglia | null; n: number }) {
  return <span className={`cl-medaglia cl-medaglia--${tipo ?? "nessuna"}`}>{n}</span>
}

function Podio({ righe }: { righe: RigaPubblica[] }) {
  // Ordine visivo: secondo, primo, terzo.
  const ordine = [righe[1], righe[0], righe[2]]
  return (
    <div className="cl-podio" role="list" aria-label="Podio">
      {ordine.map((r, i) =>
        r ? (
          <div key={i} role="listitem" className={`cl-gradino cl-gradino--${r.posizione === 1 ? "primo" : r.posizione === 2 ? "secondo" : "terzo"}${r.mia ? " cl-gradino--mia" : ""}`}>
            <div className="cl-avatar" style={{ borderColor: META_CLASSI[r.classe].colore }}>{INIZIALI(r.nome)}</div>
            <Medaglia tipo={r.medaglia} n={r.posizione} />
            <strong className="cl-nome">{r.nome}</strong>
            {r.mia && <span className="cl-tua">La tua casa</span>}
            <div className="cl-punti">{r.punteggio}<small> pt</small></div>
            <PillClasse classe={r.classe} />
            <Icone d={r.dotazioni} max={4} />
          </div>
        ) : <div key={i} className="cl-gradino cl-gradino--vuoto" />,
      )}
    </div>
  )
}

function Riga({ r }: { r: RigaPubblica }) {
  const m = META_CLASSI[r.classe]
  return (
    <li className={`cl-riga${r.mia ? " cl-riga--mia" : ""}`}>
      <span className="cl-pos">{r.posizione}</span>
      <span className="cl-chi">
        <strong>{r.nome}</strong>
        {r.mia && <span className="cl-tua">La tua casa</span>}
      </span>
      <span className="cl-barra" aria-hidden><span style={{ width: `${r.punteggio}%`, background: m.colore }} /></span>
      <span className="cl-valore">{r.punteggio}</span>
      <PillClasse classe={r.classe} />
      <Icone d={r.dotazioni} />
    </li>
  )
}

function RigaAnonima({ r }: { r: RigaPrivata }) {
  return (
    <li className={`cl-riga cl-riga--anonima${r.mia ? " cl-riga--mia" : ""}`}>
      <span className="cl-pos cl-lucchetto" aria-hidden>🔒</span>
      <span className="cl-chi"><strong>Profilo privato</strong>{r.mia && <span className="cl-tua">La tua casa</span>}</span>
      <span className="cl-nascosto">punteggio nascosto</span>
      <Icone d={r.dotazioni} />
    </li>
  )
}

export function ClassificaCard({ comuneIstat, onChangeComune, utente }: {
  comuneIstat: string
  onChangeComune: (istat: string) => void
  utente: Casa
}) {
  const [tutte, setTutte] = useState(false)
  const elenco = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of dataset.comuni) m.set(c.istat, c.nome)
    for (const c of COMUNI_VICENZA_114) if (!m.has(c.istat)) m.set(c.istat, c.nome)
    return Array.from(m, ([istat, nome]) => ({ istat, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "it"))
  }, [])
  const nomeComune = elenco.find((c) => c.istat === comuneIstat)?.nome ?? comuneIstat

  const { righe, podio, mediaComune, riepilogo } = useMemo(
    () => preparaClassifica({ case: [...dataset.caseSeed, utente], comune: comuneIstat, utenteId: utente.id }),
    [comuneIstat, utente],
  )
  const pubbliche = righe.filter((r): r is RigaPubblica => r.tipo === "pubblica")
  const private_ = righe.filter((r): r is RigaPrivata => r.tipo === "privata")
  const restanti = pubbliche.slice(3)
  const visibili = tutte ? restanti : restanti.slice(0, RIGHE_INIZIALI)

  return (
    <section className="classifica-v2" aria-label="Classifica comunale">
      <div className="cl-testa">
        <div>
          <h3>Classifica</h3>
          <label className="cl-comune">
            <span className="sr-only">Comune</span>
            <select value={comuneIstat} onChange={(e) => onChangeComune(e.target.value)}>
              {elenco.map((c) => <option key={c.istat} value={c.istat}>{c.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="cl-media" title="Media del punteggio di tutte le case del comune">
          <span>Media del comune</span><strong>{mediaComune}<small>/100</small></strong>
        </div>
      </div>

      {riepilogo && (
        <div className="cl-riepilogo" style={{ ["--cl" as string]: META_CLASSI[riepilogo.classe].colore }}>
          <div>
            {riepilogo.pubblico && riepilogo.posizione !== null ? (
              <p className="cl-grande">Sei <strong>{riepilogo.posizione}°</strong> su {riepilogo.su}</p>
            ) : (
              <p className="cl-grande">Il tuo profilo è <strong>privato</strong></p>
            )}
            <p className="cl-sotto">
              {riepilogo.pubblico ? "" : "Non compari con nome né punteggio. "}
              Il tuo punteggio è {riepilogo.punteggio}, classe {riepilogo.classe}.
            </p>
          </div>
          <span className={`cl-confronto ${riepilogo.differenzaDallaMedia >= 0 ? "cl-confronto--su" : "cl-confronto--giu"}`}>
            {riepilogo.differenzaDallaMedia >= 0 ? "+" : "−"}{Math.abs(riepilogo.differenzaDallaMedia)} rispetto alla media
          </span>
        </div>
      )}

      {pubbliche.length === 0 && private_.length === 0 ? (
        <p className="cl-vuota">Nessuna casa censita a {nomeComune}. Rendi pubblico il tuo profilo per aprire la classifica!</p>
      ) : (
        <>
          {podio.length > 0 && <Podio righe={podio} />}
          {visibili.length > 0 && <ol className="cl-lista" start={4}>{visibili.map((r, i) => <Riga key={i} r={r} />)}</ol>}
          {restanti.length > RIGHE_INIZIALI && (
            <button type="button" className="cl-altre" onClick={() => setTutte((t) => !t)}>
              {tutte ? "Mostra meno" : `Mostra altre ${restanti.length - RIGHE_INIZIALI}`}
            </button>
          )}
          {private_.length > 0 && (
            <>
              <h4 className="cl-sezione">Profili privati <span>{private_.length}</span></h4>
              <ul className="cl-lista">{private_.map((r, i) => <RigaAnonima key={i} r={r} />)}</ul>
            </>
          )}
        </>
      )}

      <p className="cl-nota">🔒 I profili privati mostrano solo le dotazioni. Le altre case sono <strong>dati dimostrativi</strong>.</p>
    </section>
  )
}
