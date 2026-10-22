import { describe, expect, it } from "vitest"

// Su Windows e macOS il file system ignora le maiuscole: due moduli come "alberi.ts" e
// "Alberi.tsx" nella stessa cartella fanno risolvere "./Alberi" al file sbagliato (il resolver
// prova .ts prima di .tsx). Su Linux invece funziona, quindi l'errore passa inosservato.
// Questo test lo intercetta su qualunque sistema operativo.

// Glob lazy: elenca i percorsi senza importare i moduli.
const MODULI = Object.keys(import.meta.glob("./**/*.{ts,tsx,js,jsx}"))

describe("portabilità Windows/Linux", () => {
  it("non ci sono moduli in src/ che differiscono solo per maiuscole", () => {
    const perChiave = new Map<string, Set<string>>()
    for (const percorso of [...MODULI, "./portabilita.test.ts"]) {
      const isTest = /\.test\.[^.]+$/.test(percorso)
      const senzaEstensione = percorso.replace(/(\.test)?\.[^./]+$/, "")
      const chiave = `${senzaEstensione.toLowerCase()}${isTest ? "#test" : ""}`
      if (!perChiave.has(chiave)) perChiave.set(chiave, new Set())
      perChiave.get(chiave)!.add(senzaEstensione)
    }
    const collisioni = [...perChiave.values()].filter((s) => s.size > 1).map((s) => [...s].join(" <-> "))
    expect(MODULI.length).toBeGreaterThan(10)
    expect(collisioni).toEqual([])
  })
})
