import { describe, expect, it } from "vitest"
import { creaStore } from "./store"

const nuovo = () => creaStore({ storage: null })

describe("store - navigazione", () => {
  it("parte sulla vista provincia, sezione mappa, in modalità realtà e senza scenario", () => {
    expect(nuovo().getState()).toMatchObject({
      vista: "provincia",
      comuneSelezionato: null,
      modalita: "realta",
      strumento: null,
      scenario: { aggiunte: [], rimozioni: [], macro: null },
      casaUtente: null,
      sezione: "mappa",
    })
  })
  it("selezionare un comune passa alla vista comune", () => {
    const s = nuovo()
    s.getState().selezionaComune("024001")
    expect(s.getState()).toMatchObject({ vista: "comune", comuneSelezionato: "024001" })
  })
  it("tornare alla provincia azzera il comune selezionato", () => {
    const s = nuovo()
    s.getState().selezionaComune("024001")
    s.getState().tornaAllaProvincia()
    expect(s.getState()).toMatchObject({ vista: "provincia", comuneSelezionato: null })
  })
  it("cambiare sezione non perde il comune selezionato", () => {
    const s = nuovo()
    s.getState().selezionaComune("024001")
    s.getState().setSezione("casa")
    expect(s.getState()).toMatchObject({ sezione: "casa", comuneSelezionato: "024001", vista: "comune" })
  })
})

describe("store - modalità e strumenti", () => {
  const inScenario = () => {
    const s = nuovo()
    s.getState().setModalita("scenario")
    return s
  }
  it("si può passare a scenario e scegliere uno strumento", () => {
    const s = inScenario()
    s.getState().setStrumento("parco")
    expect(s.getState()).toMatchObject({ modalita: "scenario", strumento: "parco" })
  })
  it("in realtà non si può attivare uno strumento", () => {
    const s = nuovo()
    s.getState().setStrumento("parco")
    expect(s.getState().strumento).toBeNull()
  })
  it("tornare in realtà disattiva lo strumento ma conserva lo scenario", () => {
    const s = inScenario()
    s.getState().setStrumento("parco")
    s.getState().aggiungiInfrastruttura("024001", "parco", [10, 20])
    s.getState().setModalita("realta")
    expect(s.getState().strumento).toBeNull()
    expect(s.getState().scenario.aggiunte).toHaveLength(1)
  })
})

describe("store - scenario", () => {
  const inScenario = () => {
    const s = nuovo()
    s.getState().setModalita("scenario")
    return s
  }
  it("aggiungere un'infrastruttura la registra con un id univoco", () => {
    const s = inScenario()
    s.getState().aggiungiInfrastruttura("024001", "parco", [10, 20])
    s.getState().aggiungiInfrastruttura("024001", "parco", [30, 40])
    const [a, b] = s.getState().scenario.aggiunte
    expect(a).toMatchObject({ comune: "024001", tipo: "parco", posizione: [10, 20] })
    expect(a!.id).not.toBe(b!.id)
  })
  it("in realtà aggiungere o rimuovere non ha effetto", () => {
    const s = nuovo()
    s.getState().aggiungiInfrastruttura("024001", "parco", [0, 0])
    s.getState().rimuoviInfrastruttura("i1")
    expect(s.getState().scenario).toEqual({ aggiunte: [], rimozioni: [], macro: null })
  })
  it("rimuovere un'infrastruttura reale la mette nelle rimozioni, una volta sola", () => {
    const s = inScenario()
    s.getState().rimuoviInfrastruttura("i4")
    s.getState().rimuoviInfrastruttura("i4")
    expect(s.getState().scenario.rimozioni).toEqual(["i4"])
  })
  it("rimuovere un'infrastruttura aggiunta la elimina dalle aggiunte", () => {
    const s = inScenario()
    s.getState().aggiungiInfrastruttura("024001", "industria", [0, 0])
    const id = s.getState().scenario.aggiunte[0]!.id
    s.getState().rimuoviInfrastruttura(id)
    expect(s.getState().scenario).toEqual({ aggiunte: [], rimozioni: [], macro: null })
  })
  it("setMacro imposta e azzera gli slider", () => {
    const s = inScenario()
    const macro = { ambito: "provincia", pctFV: 50, pctSenzaGas: 0, pctIsolamentoBuono: 20 }
    s.getState().setMacro(macro)
    expect(s.getState().scenario.macro).toEqual(macro)
    s.getState().setMacro(null)
    expect(s.getState().scenario.macro).toBeNull()
  })
  it("il reset svuota lo scenario e lo strumento ma resta in modalità scenario", () => {
    const s = inScenario()
    s.getState().setStrumento("strada")
    s.getState().aggiungiInfrastruttura("024001", "strada", [0, 0])
    s.getState().rimuoviInfrastruttura("i4")
    s.getState().setMacro({ ambito: "provincia", pctFV: 10, pctSenzaGas: 0, pctIsolamentoBuono: 0 })
    s.getState().resetScenario()
    expect(s.getState()).toMatchObject({
      scenario: { aggiunte: [], rimozioni: [], macro: null },
      strumento: null,
      modalita: "scenario",
    })
  })
})

describe("store - casa utente e persistenza", () => {
  const casa = {
    id: "io", comune: "024001", pubblico: true, nickname: "Casa mia",
    dotazioni: {
      fotovoltaico: true, solareTermico: false, riscaldamento: "pompa_calore" as const,
      cottura: "induzione" as const, isolamento: "medio" as const, infissi: true, colonninaEV: false,
    },
  }
  const memoria = (iniziale: Record<string, string> = {}) => {
    const dati = { ...iniziale }
    const storage = {
      getItem: (k: string) => dati[k] ?? null,
      setItem: (k: string, v: string) => void (dati[k] = v),
      removeItem: (k: string) => void delete dati[k],
    } as unknown as Storage
    return { dati, storage }
  }
  const rotto = {
    getItem: () => { throw new Error("storage bloccato") },
    setItem: () => { throw new Error("storage bloccato") },
  } as unknown as Storage

  it("la casa impostata resta in memoria", () => {
    const s = nuovo()
    s.getState().setCasaUtente(casa)
    expect(s.getState().casaUtente).toEqual(casa)
  })
  it("una casa salvata sopravvive al ricaricamento (nuovo store, stesso storage)", () => {
    const { storage } = memoria()
    creaStore({ storage }).getState().setCasaUtente(casa)
    expect(creaStore({ storage }).getState().casaUtente).toEqual(casa)
  })
  it("rimuovere la casa la cancella anche dallo storage", () => {
    const { storage } = memoria()
    const s = creaStore({ storage })
    s.getState().setCasaUtente(casa)
    s.getState().setCasaUtente(null)
    expect(creaStore({ storage }).getState().casaUtente).toBeNull()
  })
  it("non salva né ricarica scenario, modalità o sezione", () => {
    const { storage, dati } = memoria()
    const s = creaStore({ storage })
    s.getState().setModalita("scenario")
    s.getState().aggiungiInfrastruttura("024001", "parco", [0, 0])
    s.getState().setSezione("casa")
    s.getState().setCasaUtente(casa)
    expect(Object.keys(dati)).toHaveLength(1)
    expect(creaStore({ storage }).getState()).toMatchObject({ modalita: "realta", sezione: "mappa", scenario: { aggiunte: [] } })
  })
  it("dati salvati corrotti vengono ignorati", () => {
    for (const valore of ["{non json", "123", "null", '{"id":"x"}', JSON.stringify({ ...casa, dotazioni: { fotovoltaico: "sì" } })]) {
      const { storage } = memoria({ "casa-utente": valore })
      expect(creaStore({ storage }).getState().casaUtente).toBeNull()
    }
  })
  it("se lo storage lancia errori l'app funziona comunque, solo in memoria", () => {
    const s = creaStore({ storage: rotto })
    expect(s.getState().casaUtente).toBeNull()
    expect(() => s.getState().setCasaUtente(casa)).not.toThrow()
    expect(s.getState().casaUtente).toEqual(casa)
  })
})

describe("store - strade e spostamenti", () => {
  const inScenario = () => {
    const s = nuovo()
    s.getState().setModalita("scenario")
    return s
  }
  it("traccia una strada punto per punto e la conferma nel comune", () => {
    const s = inScenario()
    s.getState().setStrumento("strada")
    s.getState().setTipoStrada("tangenziale")
    s.getState().aggiungiPuntoStrada([0, 0])
    s.getState().aggiungiPuntoStrada([1500, 0])
    s.getState().confermaTracciato("024001")
    expect(s.getState().bozzaStrada).toEqual([])
    expect(s.getState().scenario.aggiunte[0]).toMatchObject({
      comune: "024001", tipo: "strada", strada: { tipo: "tangenziale", tracciato: [[0, 0], [1500, 0]] },
    })
  })
  it("con un solo punto la strada non viene creata", () => {
    const s = inScenario()
    s.getState().aggiungiPuntoStrada([0, 0])
    s.getState().confermaTracciato("024001")
    expect(s.getState().scenario.aggiunte).toEqual([])
  })
  it("cambiare strumento scarta la bozza", () => {
    const s = inScenario()
    s.getState().aggiungiPuntoStrada([0, 0])
    s.getState().setStrumento("parco")
    expect(s.getState().bozzaStrada).toEqual([])
  })
  it("sposta un oggetto piazzato ma non una strada", () => {
    const s = inScenario()
    s.getState().aggiungiInfrastruttura("024001", "nucleare", [1, 1])
    s.getState().aggiungiInfrastruttura("024001", "strada", [0, 0], { strada: { tipo: "urbana", tracciato: [[0, 0], [10, 0]] } })
    const [n, r] = s.getState().scenario.aggiunte
    s.getState().spostaInfrastruttura(n!.id, "024002", [5, 5])
    s.getState().spostaInfrastruttura(r!.id, "024002", [5, 5])
    expect(s.getState().scenario.aggiunte[0]).toMatchObject({ comune: "024002", posizione: [5, 5] })
    expect(s.getState().scenario.aggiunte[1]).toMatchObject({ comune: "024001", posizione: [0, 0] })
  })
  it("conclude una pista ciclabile e un parco con la forma disegnata", () => {
    const s = inScenario()
    s.getState().setStrumento("ciclabile")
    s.getState().setBozzaStrada([[0, 0], [500, 0]])
    s.getState().confermaTracciato("024001")
    s.getState().setStrumento("parco")
    s.getState().setBozzaStrada([[0, 0], [100, 0], [100, 100]])
    s.getState().confermaTracciato("024001")
    const [c, p] = s.getState().scenario.aggiunte
    expect(c).toMatchObject({ tipo: "ciclabile", ciclabile: { tracciato: [[0, 0], [500, 0]] } })
    expect(p).toMatchObject({ tipo: "parco", parco: { contorno: [[0, 0], [100, 0], [100, 100]] } })
  })
  it("un parco con meno di tre punti non viene creato", () => {
    const s = inScenario()
    s.getState().setStrumento("parco")
    s.getState().setBozzaStrada([[0, 0], [100, 0]])
    s.getState().confermaTracciato("024001")
    expect(s.getState().scenario.aggiunte).toEqual([])
  })
  it("l'industria piazzata porta la tipologia scelta", () => {
    const s = inScenario()
    s.getState().setTipoIndustria("conciaria")
    s.getState().aggiungiInfrastruttura("024001", "industria", [0, 0])
    expect(s.getState().scenario.aggiunte[0]).toMatchObject({ industria: "conciaria" })
  })
})
