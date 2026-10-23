import { punteggioCasa } from "../engine"
import { etichetteDotazioni } from "../ui/ClassificaComunale"
import type { ProfiloAmico as Profilo } from "./types"
import { FotoProfilo } from "./FotoProfilo"
import { FotoCasa } from "../casa/FotoCasa"

export function ProfiloAmico({ profilo }: { profilo: Profilo }) {
  const indice = profilo.dotazioni ? punteggioCasa(profilo.dotazioni) : null
  return (
    <section className="amici-profilo" aria-label="Caratteristiche dell’amico">
      <div className="amici-profilo-testa"><FotoProfilo nome={profilo.nome} foto={profilo.foto} /><div><h3>@{profilo.nome || "Utente"}</h3><strong>{profilo.nomeCasa || "Casa non indicata"}</strong><p>Comune della casa: {profilo.comune || "Non indicato"}</p></div></div>
      <code>{profilo.id}</code>
      <p>Profilo in sola lettura</p>
      {profilo.dotazioni && <FotoCasa dotazioni={profilo.dotazioni} nome={profilo.nomeCasa || "Casa"} />}
      {profilo.dotazioni && indice ? <>
        <p><strong>{indice.punteggio}/100</strong> · Classe {indice.classe}</p>
        <ul>{etichetteDotazioni(profilo.dotazioni).map((testo) => <li key={testo}>{testo}</li>)}</ul>
      </> : <p>Questo amico non ha ancora condiviso le dotazioni della casa.</p>}
    </section>
  )
}
