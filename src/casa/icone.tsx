import type { Oggetto } from "./oggetti"

// Icone semplici e uniformi (tratto 1.7, 24×24), una per oggetto.
const P: Record<Oggetto, string> = {
  fotovoltaico: "M3 15l3-9h12l3 9H3zM9 6l-1.5 9M15 6l1.5 9M4.5 10.5h15M12 18v3M8 21h8",
  solareTermico: "M4 17l2-8h12l2 8H4zM12 9v8M7 13h10M12 3v2M5 5l1.5 1.5M19 5l-1.5 1.5",
  pompa_calore: "M5 4h14v16H5zM12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 8v8M8 12h8",
  condensazione: "M7 9h10v11H7zM10 9V5M14 9V5M9 3c1 1-1 2 0 3M13 3c1 1-1 2 0 3M10 15h4",
  tradizionale: "M7 10h10v10H7zM15 10V4h3v6M10 15h4M16 2c1 1-1 2 0 3",
  induzione: "M3 14h18v5H3zM8 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M16 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 3v2",
  gas: "M12 3c3 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8zM9 21h6",
  isolamento_buono: "M3 6h18v12H3zM3 12h18M8 6v6M16 12v6M12 6v0M3 9h18",
  isolamento_medio: "M3 6h18v12H3zM3 12h18M8 6v6M16 12v6",
  isolamento_scarso: "M3 6h18v12H3zM9 6v12M15 6v12",
  infissi: "M5 3h14v18H5zM5 12h14M12 3v18",
  colonninaEV: "M8 3h8v18H8zM11 8l-1.5 3h3L11 14M16 8h2.5a1.5 1.5 0 0 1 1.5 1.5V16",
}

export function Icona({ oggetto, size = 28 }: { oggetto: Oggetto; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[oggetto]} />
    </svg>
  )
}
