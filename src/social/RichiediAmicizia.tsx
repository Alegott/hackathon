import { useState } from "react"
import { store, useApp } from "../app/useApp"
import { idProfiloCasa } from "./demo"
import { useSocial } from "./useSocial"

export function RichiediAmicizia({ casaId, nome }: { casaId: string; nome: string }) {
  const { stato, dispatch, persistito } = useSocial()
  const casa = useApp((s) => s.casaUtente)
  const [inviataQui, setInviataQui] = useState(false)
  const id = idProfiloCasa(casaId)
  const amico = stato.amici.includes(id)
  const inviata = stato.inviate.includes(id)
  const ricevuta = stato.ricevute.includes(id)
  const pronto = !!stato.nomeUtente && !!casa?.nickname?.trim()
  return <span className="cl-amicizia">
    <button type="button" disabled={amico || inviata} aria-label={`${amico ? "Già amico" : inviata ? "Richiesta inviata" : ricevuta ? "Accetta amicizia" : pronto ? "Aggiungi agli amici" : "Completa il profilo per aggiungere agli amici"}: ${nome}`} onClick={() => {
      if (!pronto) { store.getState().setSezione("amici"); return }
      dispatch({ tipo: ricevuta ? "accetta" : "richiedi", id })
      setInviataQui(true)
    }}>{amico ? "Già amici" : inviata ? "Richiesta inviata" : ricevuta ? "Accetta amicizia" : pronto ? "+ Aggiungi amico" : "Completa profilo per aggiungere"}</button>
    {inviataQui && <small role="status">{!persistito ? "Salvata solo per questa sessione" : amico ? "Amicizia accettata" : "Richiesta demo salvata in Amici"}</small>}
  </span>
}
