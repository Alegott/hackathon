import { create } from "zustand"
import { aggiornaSocial, caricaSocial, salvaSocial, type AzioneSocial, type StatoSocial } from "./demo"

const archivio = (() => { try { return window.localStorage } catch { return null } })()

// Un solo stato per classifica e Amici, anche quando lo storage non è disponibile.
export const useSocial = create<{ stato: StatoSocial; persistito: boolean; dispatch: (azione: AzioneSocial) => void }>((set) => ({
  stato: caricaSocial(archivio),
  persistito: true,
  dispatch: (azione) => set((corrente) => {
    const stato = aggiornaSocial(corrente.stato, azione)
    return { stato, persistito: salvaSocial(archivio, stato) }
  }),
}))
