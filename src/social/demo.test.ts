import { describe, expect, it } from "vitest"
import { aggiornaSocial, caricaSocial, PROFILI_DEMO, PROFILI_SOCIAL, idProfiloCasa, salvaSocial } from "./demo"
import { dataset } from "../data/dataset"

describe("Amici demo", () => {
  it("salva richieste dalla classifica, le ritrova al rientro e permette di annullarle", () => {
    const casa = dataset.caseSeed.find((c) => c.pubblico)!
    const id = idProfiloCasa(casa.id)
    expect(PROFILI_SOCIAL.find((p) => p.id === id)).toMatchObject({ nomeCasa: casa.nickname, dotazioni: casa.dotazioni })
    const s = aggiornaSocial(caricaSocial(null), { tipo: "richiedi", id })
    expect(s.inviate).toContain(id)
    expect(aggiornaSocial(s, { tipo: "richiedi", id }).inviate.filter((i) => i === id)).toHaveLength(1)
    const ricaricato = caricaSocial({ getItem: () => JSON.stringify(s) })
    expect(ricaricato).toEqual(s)
    expect(aggiornaSocial(ricaricato, { tipo: "annulla", id }).inviate).not.toContain(id)
  })
  it("non espone profili privati della classifica e rifiuta richieste verso di loro", () => {
    const privata = dataset.caseSeed.find((c) => !c.pubblico)!
    const id = idProfiloCasa(privata.id)
    expect(PROFILI_SOCIAL.some((p) => p.id === id)).toBe(false)
    const s = caricaSocial(null)
    expect(aggiornaSocial(s, { tipo: "richiedi", id })).toBe(s)
  })
  it("crea un identificatore dal nome utente e lo mantiene modificando il profilo", () => {
    const iniziale = caricaSocial(null)
    expect(aggiornaSocial(iniziale, { tipo: "profilo", nomeUtente: "!" })).toBe(iniziale)
    const profilo = aggiornaSocial(iniziale, { tipo: "profilo", nomeUtente: "mario.rossi" })
    expect(profilo.id).toMatch(/^VS-mario\.rossi-/)
    const aggiornato = aggiornaSocial(profilo, { tipo: "profilo", nomeUtente: "mario2" })
    expect(aggiornato.id).toBe(profilo.id)
    expect(caricaSocial({ getItem: () => JSON.stringify(aggiornato) })).toEqual(aggiornato)
  })
  it("mantiene i messaggi non letti finché viene simulata la lettura e solo nella chat scelta", () => {
    const s = caricaSocial(null), id = s.amici[0]!
    const inviato = aggiornaSocial(s, { tipo: "messaggio", id, messaggio: { id: "lettura", mittente: s.id, testo: "Ciao", creatoIl: new Date().toISOString() } })
    expect(inviato.chat[id]!.at(-1)!.visualizzatoIl).toBeUndefined()
    expect(aggiornaSocial(inviato, { tipo: "lettura-demo", id: PROFILI_DEMO[2]!.id })).toBe(inviato)
    const letto = aggiornaSocial(inviato, { tipo: "lettura-demo", id })
    expect(letto.chat[id]!.at(-1)!.visualizzatoIl).toBeTruthy()
    expect(letto.chat[id]![0]!.visualizzatoIl).toBeUndefined()
    expect(caricaSocial({ getItem: () => JSON.stringify(letto) })).toEqual(letto)
  })
  it("mantiene l'ID dopo un nuovo accesso e salva messaggi e amicizie", () => {
    let value: string | null = null
    const storage = { getItem: () => value, setItem: (_k: string, v: string) => { value = v } }
    const stato = caricaSocial(storage)
    salvaSocial(storage, stato)
    expect(caricaSocial(storage)).toEqual(stato)
  })
  it("richiede accettazione prima di scrivere e non modifica profili altrui", () => {
    const s = caricaSocial(null)
    const id = PROFILI_DEMO[1]!.id
    const messaggio = { id: "m1", mittente: s.id, testo: "Ciao", creatoIl: "2026-10-23T09:00:00Z" }
    expect(aggiornaSocial(s, { tipo: "messaggio", id, messaggio })).toBe(s)
    const amici = aggiornaSocial(s, { tipo: "accetta", id })
    expect(amici.ricevute).not.toContain(id)
    expect(amici.amici).toContain(id)
    expect(aggiornaSocial(amici, { tipo: "messaggio", id, messaggio }).chat[id]).toEqual([messaggio])
    expect(s.amici).not.toContain(id)
  })
  it("non duplica richieste e permette di annullarle", () => {
    const s = caricaSocial(null), id = PROFILI_DEMO[2]!.id
    const inviata = aggiornaSocial(s, { tipo: "richiedi", id })
    expect(aggiornaSocial(inviata, { tipo: "richiedi", id }).inviate).toEqual([id])
    expect(aggiornaSocial(inviata, { tipo: "annulla", id }).inviate).toEqual([])
  })
  it("gestisce storage bloccato e dati corrotti", () => {
    expect(caricaSocial({ getItem: () => "{}" }).id).toMatch(/^VS-/)
    expect(salvaSocial({ setItem: () => { throw Error("blocked") } }, caricaSocial(null))).toBe(false)
  })
})
