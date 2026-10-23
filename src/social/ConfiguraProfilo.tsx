import { useState } from "react"
import { store, useApp } from "../app/useApp"
import { CASA_DEMO_DEFAULT } from "../ui/SezioneCasa"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { FotoProfilo } from "./FotoProfilo"
import type { StatoSocial } from "./demo"

export function ConfiguraProfilo({ stato, onSave }: { stato: StatoSocial; onSave: (nome: string, foto?: string) => void }) {
  const casa = useApp((s) => s.casaUtente)
  const [nome, setNome] = useState(stato.nomeUtente ?? "")
  const [nomeCasa, setNomeCasa] = useState(casa?.nickname ?? "")
  const [comune, setComune] = useState(casa?.comune ?? CASA_DEMO_DEFAULT.comune)
  const [foto, setFoto] = useState(stato.foto)
  return <section className="amici-card"><h2>{stato.nomeUtente ? "Modifica profilo" : "Inserisci il tuo nome utente"}</h2><p>Completa il profilo per inviare richieste di amicizia. Il tuo identificatore casuale viene creato al primo salvataggio.</p>
    <form className="amici-configura" onSubmit={(e) => { e.preventDefault(); if (!nomeCasa.trim()) return; store.getState().setCasaUtente({ ...(store.getState().casaUtente ?? CASA_DEMO_DEFAULT), nickname: nomeCasa.trim(), comune }); onSave(nome.trim(), foto) }}>
      <FotoProfilo nome={nome} foto={foto} onChange={setFoto} />
      <label>Nome utente<input autoFocus required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_.]{3,24}" title="Da 3 a 24 lettere, numeri, punti o underscore" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="username" /></label>
      <label>Nome della casa (obbligatorio)<input required maxLength={32} pattern=".*\S.*" value={nomeCasa} onChange={(e) => setNomeCasa(e.target.value)} /></label>
      <label>Comune della casa<select required value={comune} onChange={(e) => setComune(e.target.value)}>{COMUNI_VICENZA_114.map((c) => <option value={c.istat} key={c.istat}>{c.nome}</option>)}</select></label>
      <button type="submit">Salva profilo</button>
    </form>
  </section>
}
