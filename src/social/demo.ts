import type { Messaggio, ProfiloAmico } from "./types"
import { dataset } from "../data/dataset"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import type { Dotazioni } from "../types"

const dotazioni: Dotazioni = {
  fotovoltaico: true, solareTermico: false, riscaldamento: "pompa_calore" as const,
  cottura: "induzione" as const, isolamento: "buono" as const, infissi: true, colonninaEV: false,
  auto: { alimentazione: "ibrido", euro: 6 },
  giardino: { alberi: { latifoglia: 2, frutto: 1 } },
}

export const PROFILI_DEMO: ProfiloAmico[] = [
  { id: "VS-LUCA-2048", nome: "luca", nomeCasa: "Casa nel verde", comune: "Vicenza", dotazioni },
  { id: "VS-SARA-7316", nome: "sara", nomeCasa: "Casa solare", comune: "Schio", dotazioni: { ...dotazioni, solareTermico: true, colonninaEV: true, auto: { alimentazione: "elettrico", euro: 6 }, giardino: { alberi: { conifera: 1, ulivo: 2 } } } },
  { id: "VS-MARCO-9052", nome: "marco", nomeCasa: "Un passo alla volta", comune: "Thiene", dotazioni: { ...dotazioni, fotovoltaico: false, isolamento: "medio", riscaldamento: "condensazione", auto: { alimentazione: "benzina", euro: 5 }, giardino: null } },
]

export type StatoSocial = {
  id: string
  nomeUtente?: string
  foto?: string
  amici: string[]
  ricevute: string[]
  inviate: string[]
  chat: Record<string, Messaggio[]>
}
export const idProfiloCasa = (idCasa: string) => `VS-CASA-${idCasa}`
export const PROFILI_SOCIAL: ProfiloAmico[] = [...PROFILI_DEMO, ...dataset.caseSeed.filter((c) => c.pubblico).map((c) => ({
  id: idProfiloCasa(c.id), nome: c.nickname || "Casa pubblica", nomeCasa: c.nickname || "Casa pubblica",
  comune: dataset.comuni.find((comune) => comune.istat === c.comune)?.nome ?? COMUNI_VICENZA_114.find((comune) => comune.istat === c.comune)?.nome ?? c.comune,
  dotazioni: c.dotazioni,
}))]
const CHIAVE = "vicenza-social-demo-v1"
const valido = (id: string) => PROFILI_SOCIAL.some((p) => p.id === id)

export function caricaSocial(storage: Pick<Storage, "getItem"> | null): StatoSocial {
  try {
    const saved: StatoSocial = JSON.parse(storage?.getItem(CHIAVE) ?? "null")
    if (saved && /^VS-(?:[a-z0-9_.-]{3,24}-)?[a-f0-9-]{36}$/i.test(saved.id) &&
      (saved.nomeUtente === undefined || (typeof saved.nomeUtente === "string" && /^[a-zA-Z0-9_.]{3,24}$/.test(saved.nomeUtente))) &&
      (saved.foto === undefined || (typeof saved.foto === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(saved.foto))) &&
      [saved.amici, saved.ricevute, saved.inviate].every((ids) => Array.isArray(ids) && ids.every(valido)) &&
      saved.chat && typeof saved.chat === "object" && Object.values(saved.chat).every((lista) =>
        Array.isArray(lista) && lista.every((m) => m && typeof m.id === "string" && typeof m.mittente === "string" && typeof m.testo === "string" && typeof m.creatoIl === "string"))) return saved
  } catch { /* Storage non disponibile o dati non validi: nuova sessione demo. */ }
  return {
    id: `VS-${crypto.randomUUID()}`, amici: [PROFILI_DEMO[0]!.id],
    ricevute: [PROFILI_DEMO[1]!.id], inviate: [],
    chat: { [PROFILI_DEMO[0]!.id]: [{ id: "benvenuto", mittente: PROFILI_DEMO[0]!.id,
      testo: "Ciao! Qui puoi provare la chat e confrontare le dotazioni delle nostre case. Questo è un messaggio dimostrativo.", creatoIl: new Date().toISOString() }] },
  }
}

export function salvaSocial(storage: Pick<Storage, "setItem"> | null, stato: StatoSocial): boolean {
  try { if (!storage) return false; storage.setItem(CHIAVE, JSON.stringify(stato)); return true } catch { return false }
}

export type AzioneSocial =
  | { tipo: "profilo"; nomeUtente: string; foto?: string }
  | { tipo: "lettura-demo"; id: string }
  | { tipo: "richiedi" | "accetta" | "rifiuta" | "annulla"; id: string }
  | { tipo: "messaggio"; id: string; messaggio: Messaggio }

export function aggiornaSocial(s: StatoSocial, a: AzioneSocial): StatoSocial {
  if (a.tipo === "profilo") {
    const nomeUtente = a.nomeUtente.trim()
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(nomeUtente)) return s
    const id = s.nomeUtente ? s.id : `VS-${nomeUtente.toLowerCase()}-${crypto.randomUUID()}`
    return { ...s, id, nomeUtente, foto: a.foto, chat: Object.fromEntries(Object.entries(s.chat).map(([key, lista]) => [key, lista.map((m) => m.mittente === s.id ? { ...m, mittente: id } : m)])) }
  }
  if (!valido(a.id)) return s
  switch (a.tipo) {
    case "lettura-demo":
      if (!s.amici.includes(a.id)) return s
      return { ...s, chat: { ...s.chat, [a.id]: (s.chat[a.id] ?? []).map((m) => m.mittente === s.id && !m.visualizzatoIl ? { ...m, visualizzatoIl: new Date().toISOString() } : m) } }
    case "richiedi":
      return s.amici.includes(a.id) || s.inviate.includes(a.id) || s.ricevute.includes(a.id)
        ? s : { ...s, inviate: [...s.inviate, a.id] }
    case "accetta":
      return !s.ricevute.includes(a.id) ? s : { ...s,
        amici: [...new Set([...s.amici, a.id])], ricevute: s.ricevute.filter((id) => id !== a.id) }
    case "rifiuta": return { ...s, ricevute: s.ricevute.filter((id) => id !== a.id) }
    case "annulla": return { ...s, inviate: s.inviate.filter((id) => id !== a.id) }
    case "messaggio":
      if (!s.amici.includes(a.id) || a.messaggio.mittente !== s.id || !a.messaggio.testo.trim() || a.messaggio.testo.length > 2000) return s
      return { ...s, chat: { ...s.chat, [a.id]: [...(s.chat[a.id] ?? []), { ...a.messaggio, testo: a.messaggio.testo.trim() }] } }
  }
}
