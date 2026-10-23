import type { Casa, Dotazioni } from "../types"
import { punteggioCasa } from "./casa"
import { PIANI, type PianoTemporale } from "./tempo"

// "Il tuo 2040": la macchina del tempo con un piano costruito dalla casa dell'utente.
// Domanda: e se tutta la provincia vivesse come te? Le quote di case virtuose convergono verso le
// tue dotazioni; il PM10 segue riscaldamento e auto (le due fonti principali in pianura padana);
// il parco auto segue la tua scelta di mobilità. Modello illustrativo, dichiarato in UI.

export type VariantePersonale = "come-te" | "due-passi"

const ETICHETTE_PASSI: Record<string, string> = {
  fotovoltaico: "il fotovoltaico",
  solareTermico: "il solare termico",
  riscaldamento: "la pompa di calore",
  cottura: "il piano a induzione",
  isolamento: "un buon isolamento",
  infissi: "gli infissi doppi",
  colonninaEV: "la colonnina di ricarica",
  auto: "l'auto elettrica",
  giardino: "più alberi in giardino",
}

function migliora(d: Dotazioni, dotazione: string): Dotazioni {
  switch (dotazione) {
    case "fotovoltaico": return { ...d, fotovoltaico: true }
    case "solareTermico": return { ...d, solareTermico: true }
    case "riscaldamento": return { ...d, riscaldamento: "pompa_calore" }
    case "cottura": return { ...d, cottura: "induzione" }
    case "isolamento": return { ...d, isolamento: "buono" }
    case "infissi": return { ...d, infissi: true }
    case "colonninaEV": return { ...d, colonninaEV: true }
    case "auto": return { ...d, auto: { alimentazione: "elettrico", euro: 6 } }
    case "giardino": return { ...d, giardino: { alberi: { ...(d.giardino?.alberi ?? {}), latifoglia: (d.giardino?.alberi.latifoglia ?? 0) + 3 } } }
    default: return d
  }
}

// I due interventi che fanno guadagnare più punti, presi dalla lista "Per salire di classe".
export function duePassi(d: Dotazioni): { dotazioni: Dotazioni; passi: string[] } {
  const scelti = punteggioCasa(d).mancanti.slice(0, 2).map((m) => m.dotazione)
  return { dotazioni: scelti.reduce(migliora, d), passi: scelti.map((s) => ETICHETTE_PASSI[s] ?? s) }
}

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))
const alberi = (d: Dotazioni) => Object.values(d.giardino?.alberi ?? {}).reduce((n, k) => n + (k ?? 0), 0)

// Tendenza annua del PM10 (%) se ogni famiglia facesse le tue stesse scelte.
export function trendDaDotazioni(d: Dotazioni): number {
  let t = 0.4 // crescita di case, capannoni e strade
  t += { pompa_calore: -1.3, condensazione: -0.3, tradizionale: 0.7 }[d.riscaldamento]
  t += { buono: -0.4, medio: 0, scarso: 0.3 }[d.isolamento]
  if (d.fotovoltaico) t -= 0.2
  const a = d.auto
  if (!a) t -= 0.7
  else if (a.alimentazione === "elettrico") t -= 0.6
  else if (a.alimentazione === "ibrido") t -= 0.2
  else if (a.alimentazione === "diesel") t += a.euro >= 6 ? 0.2 : 0.6
  else if (a.euro <= 4) t += 0.2
  return clamp(Math.round(t * 10) / 10, -3, 2.5)
}

export function pianoDaDotazioni(d: Dotazioni, id: VariantePersonale, nome: string, descrizione: string): PianoTemporale {
  const base = PIANI.find((p) => p.id === "inerzia")!
  const senzaGas = d.riscaldamento === "pompa_calore" && d.cottura === "induzione"
  const a = d.auto
  return {
    ...base,
    id, nome, descrizione,
    obiettivi: {
      pctFV: d.fotovoltaico ? 85 : 0,
      pctSenzaGas: senzaGas ? 80 : d.riscaldamento === "pompa_calore" ? 45 : 0,
      pctIsolamentoBuono: d.isolamento === "buono" ? 80 : d.isolamento === "medio" ? 35 : 0,
    },
    curva: "s",
    trendPm10PctAnno: trendDaDotazioni(d),
    crescita: {
      ...base.crescita,
      ciclabiliAnno: !a || a.alimentazione === "elettrico" ? 1.2 : 0.3,
      parchiAnno: alberi(d) >= 3 ? 0.8 : 0.2,
      nucleareAnno: null,
    },
    motorizzazionePctAnno: !a ? -1.5 : a.alimentazione === "elettrico" ? -0.3 : a.alimentazione === "diesel" ? 0.8 : 0.5,
  }
}

export function pianoPersonale(casa: Casa, variante: VariantePersonale): { piano: PianoTemporale; passi: string[] } {
  if (variante === "come-te")
    return { piano: pianoDaDotazioni(casa.dotazioni, "come-te", "Tutti come te", "tutta la provincia vive come la tua casa"), passi: [] }
  const { dotazioni, passi } = duePassi(casa.dotazioni)
  const testo = passi.length ? passi.join(" e ") : "nessun passo: sei già al massimo"
  return { piano: pianoDaDotazioni(dotazioni, "due-passi", "Come te + 2 passi", `tutti come te, con ${testo}`), passi }
}

export const èPersonale = (p: PianoTemporale) => p.id === "come-te" || p.id === "due-passi"
