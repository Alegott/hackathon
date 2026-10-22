import { useEffect, useState } from "react"

export type Tema = "chiaro" | "scuro" | "sistema"

// Stessa chiave letta dallo script inline in index.html, che applica il tema prima del primo paint.
const CHIAVE = "vicenza-tema"

function leggiTema(): Tema {
  try {
    const v = localStorage.getItem(CHIAVE)
    if (v === "chiaro" || v === "scuro") return v
  } catch {
    // storage non disponibile (es. finestra privata): si resta sul sistema
  }
  return "sistema"
}

export function applicaTema(tema: Tema) {
  const html = document.documentElement
  if (tema === "sistema") delete html.dataset.theme
  else html.dataset.theme = tema === "scuro" ? "dark" : "light"
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(leggiTema)
  useEffect(() => {
    applicaTema(tema)
    try {
      if (tema === "sistema") localStorage.removeItem(CHIAVE)
      else localStorage.setItem(CHIAVE, tema)
    } catch {
      // vedi leggiTema
    }
  }, [tema])
  return [tema, setTema]
}
