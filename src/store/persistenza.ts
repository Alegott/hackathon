import type { Casa } from "../types"

const CHIAVE = "casa-utente"

const èAuto = (a: any) =>
  typeof a === "object" && a !== null &&
  ["benzina", "diesel", "gpl", "ibrido", "elettrico"].includes(a.alimentazione) &&
  Number.isInteger(a.euro) && a.euro >= 0 && a.euro <= 6

const èGiardino = (g: any) =>
  typeof g === "object" && g !== null && typeof g.alberi === "object" && g.alberi !== null &&
  Object.entries(g.alberi).every(([tipo, n]) =>
    ["latifoglia", "conifera", "frutto", "ulivo"].includes(tipo) && Number.isInteger(n) && (n as number) >= 0)

const èCasa = (x: unknown): x is Casa => {
  if (typeof x !== "object" || x === null) return false
  const c = x as Record<string, any>
  const d = c.dotazioni
  return (
    typeof c.id === "string" &&
    typeof c.comune === "string" &&
    typeof c.pubblico === "boolean" &&
    (c.nickname === undefined || typeof c.nickname === "string") &&
    typeof d === "object" && d !== null &&
    typeof d.fotovoltaico === "boolean" &&
    typeof d.solareTermico === "boolean" &&
    ["pompa_calore", "condensazione", "tradizionale"].includes(d.riscaldamento) &&
    ["induzione", "gas"].includes(d.cottura) &&
    ["buono", "medio", "scarso"].includes(d.isolamento) &&
    typeof d.infissi === "boolean" &&
    typeof d.colonninaEV === "boolean" &&
    (d.auto === undefined || d.auto === null || èAuto(d.auto)) &&
    (d.giardino === undefined || d.giardino === null || èGiardino(d.giardino))
  )
}

// Ogni accesso allo storage può lanciare (modalità privata, storage bloccato): in quel caso
// l'app continua a funzionare con la sola copia in memoria dello store.
export function caricaCasa(storage: Storage | null): Casa | null {
  try {
    const grezzo = storage?.getItem(CHIAVE)
    if (!grezzo) return null
    const parsed: unknown = JSON.parse(grezzo)
    return èCasa(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function salvaCasa(storage: Storage | null, casa: Casa | null): void {
  try {
    if (!storage) return
    if (casa) storage.setItem(CHIAVE, JSON.stringify(casa))
    else storage.removeItem(CHIAVE)
  } catch {
    // ignora: resta solo in memoria
  }
}
