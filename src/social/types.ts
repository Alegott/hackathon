import type { Dotazioni } from "../types"

// L'identità appartiene all'account, indipendentemente dal nickname della casa.
export type ProfiloAmico = {
  id: string
  nome: string
  foto?: string
  nomeCasa?: string
  comune?: string
  dotazioni: Dotazioni | null
}

export type RichiestaAmicizia = {
  id: string
  mittente: ProfiloAmico
  destinatario: ProfiloAmico
}

export type Messaggio = {
  id: string
  mittente: string
  testo: string
  creatoIl: string
  visualizzatoIl?: string
}

export type ReteAmici = {
  utente: ProfiloAmico
  amici: ProfiloAmico[]
  ricevute: RichiestaAmicizia[]
  inviate: RichiestaAmicizia[]
}
