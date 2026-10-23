import type { Aggiunta, Infrastruttura, TipoIndustria, TipoStrada } from "../types"
import { areaEttari, deltaAggiunta, DELTA_INFRA, INDUSTRIE, lunghezzaKm, STRADE } from "./costanti"

// Scheda di impatto di un'infrastruttura: effetti per ambito e pro/contro per la comunità.
// Modello qualitativo e indicativo, coerente con i punteggi del motore.
export type AmbitoImpatto = "Aria" | "Animali e verde" | "Rumore" | "Energia" | "Salute" | "Economia" | "Mobilità" | "Paesaggio"
export type Effetto = { ambito: AmbitoImpatto; livello: -3 | -2 | -1 | 0 | 1 | 2 | 3; testo: string }
export type Scheda = {
  titolo: string
  dettaglio: string
  icona: string
  impatto: number
  effetti: Effetto[]
  pro: string[]
  contro: string[]
}

const e = (ambito: AmbitoImpatto, livello: Effetto["livello"], testo: string): Effetto => ({ ambito, livello, testo })
const fmt = (n: number, d = 1) => n.toFixed(d).replace(".", ",")

const STRADA: Record<TipoStrada, { effetti: Effetto[]; pro: string[]; contro: string[] }> = {
  urbana: {
    effetti: [e("Aria", -1, "Traffico locale, emissioni contenute"), e("Animali e verde", -1, "Poca frammentazione degli habitat"),
      e("Rumore", -1, "Rumore moderato, velocità basse"), e("Mobilità", 2, "Collega quartieri e servizi")],
    pro: ["Raggiungibilità di case e negozi", "Basso impatto sul paesaggio", "Accesso ai mezzi di soccorso"],
    contro: ["Più auto nel centro abitato", "Suolo impermeabilizzato"],
  },
  provinciale: {
    effetti: [e("Aria", -1, "Emissioni dal traffico di collegamento"), e("Animali e verde", -2, "Taglia i corridoi di passaggio della fauna"),
      e("Rumore", -2, "Rumore costante lungo il tracciato"), e("Economia", 2, "Collega paesi e imprese"), e("Mobilità", 2, "Alternativa ai centri congestionati")],
    pro: ["Collega i comuni e riduce l'isolamento", "Sostiene artigiani e piccole imprese", "Alleggerisce le strade interne"],
    contro: ["Frammenta i campi e gli habitat", "Attrae nuovo traffico", "Rumore per le case vicine"],
  },
  tangenziale: {
    effetti: [e("Aria", -1, "Sposta le emissioni fuori dal centro, ma le aumenta complessivamente"), e("Animali e verde", -2, "Barriera per la fauna e consumo di suolo"),
      e("Rumore", -2, "Alto, con barriere antirumore parziali"), e("Salute", 1, "Meno traffico pesante nel centro"), e("Mobilità", 3, "Scorrimento veloce attorno ai centri")],
    pro: ["Libera i centri abitati dal traffico pesante", "Riduce i tempi di percorrenza", "Meno incidenti in città"],
    contro: ["Consumo di suolo agricolo", "Traffico che si sposta, non sparisce", "Barriera per animali e persone"],
  },
  autostrada: {
    effetti: [e("Aria", -2, "Forti emissioni di PM e NO₂ lungo il tracciato"), e("Animali e verde", -3, "Taglia in due habitat e corridoi ecologici"),
      e("Rumore", -3, "Rumore elevato a centinaia di metri"), e("Economia", 3, "Collegamenti rapidi per merci e lavoro"), e("Paesaggio", -2, "Grande opera, forte segno sul territorio")],
    pro: ["Collega la provincia ai grandi mercati", "Attrae imprese e logistica", "Tempi di viaggio molto ridotti"],
    contro: ["Inquinamento e rumore diffusi", "Forte consumo di suolo", "Incentiva il trasporto su gomma"],
  },
}

const INDUSTRIA: Record<TipoIndustria, { effetti: Effetto[]; pro: string[]; contro: string[] }> = {
  artigianale: {
    effetti: [e("Aria", -1, "Emissioni limitate"), e("Animali e verde", -1, "Occupa poco suolo"), e("Rumore", -1, "Rumore da laboratorio"), e("Economia", 2, "Lavoro locale e filiera corta")],
    pro: ["Posti di lavoro vicino a casa", "Sostiene il tessuto di PMI", "Impatto ambientale contenuto"],
    contro: ["Traffico di furgoni", "Nuovo capannone su suolo libero"],
  },
  logistica: {
    effetti: [e("Aria", -2, "Camion e furgoni, molto NO₂"), e("Animali e verde", -2, "Grandi piazzali impermeabili"), e("Rumore", -2, "Traffico e movimentazione notturna"),
      e("Economia", 2, "Molti posti di lavoro"), e("Mobilità", -2, "Congestiona le strade di accesso")],
    pro: ["Molti posti di lavoro", "Attrae commercio e imprese", "Tetti ampi adatti al fotovoltaico"],
    contro: ["Flusso continuo di camion", "Suolo impermeabilizzato", "Luci e rumore di notte"],
  },
  meccanica: {
    effetti: [e("Aria", -3, "Fumi e polveri da fonderie e lavorazioni"), e("Animali e verde", -2, "Contaminazione e perdita di habitat"), e("Rumore", -2, "Macchinari e traffico industriale"),
      e("Salute", -2, "Rischio per chi vive vicino"), e("Economia", 3, "Lavoro qualificato ed export")],
    pro: ["Lavoro qualificato e ben retribuito", "Traino per l'export veneto", "Indotto per le piccole imprese"],
    contro: ["Emissioni di polveri e metalli", "Consumo di energia e acqua", "Rumore per i residenti"],
  },
  conciaria: {
    effetti: [e("Aria", -3, "Odori e composti organici volatili"), e("Animali e verde", -3, "Scarichi chimici nei corsi d'acqua"), e("Salute", -3, "Rischio chimico per falde e residenti"),
      e("Paesaggio", -2, "Impianti e depuratori ingombranti"), e("Economia", 3, "Distretto di eccellenza, molto lavoro")],
    pro: ["Distretto di eccellenza del made in Italy", "Tanti posti di lavoro e indotto", "Conoscenze artigianali preziose"],
    contro: ["Rischio di inquinamento delle falde", "Odori e consumi idrici elevati", "Costi di depurazione e bonifica"],
  },
}

export function schedaImpatto(a: Aggiunta | Infrastruttura): Scheda {
  // Un'infrastruttura reale è un'aggiunta senza forma: stessa scheda, valori base.
  const aggiunta: Aggiunta = a
  const impatto = deltaAggiunta(aggiunta)
  if (aggiunta.strada) {
    const t = aggiunta.strada.tipo
    return { titolo: `Strada ${STRADE[t].etichetta.toLowerCase()}`, dettaglio: `${fmt(lunghezzaKm(aggiunta.strada.tracciato))} km · ${STRADE[t].descrizione}`,
      icona: "🛣️", impatto, ...STRADA[t] }
  }
  if (a.tipo === "strada")
    return { titolo: "Strada principale", dettaglio: "già presente", icona: "🛣️", impatto, ...STRADA.provinciale }
  if (a.tipo === "industria") {
    const v = aggiunta.industria ?? "meccanica"
    return { titolo: `Industria ${INDUSTRIE[v].etichetta.toLowerCase()}`, dettaglio: INDUSTRIE[v].descrizione, icona: "🏭", impatto, ...INDUSTRIA[v] }
  }
  if (a.tipo === "parco") {
    const ha = aggiunta.parco ? areaEttari(aggiunta.parco.contorno) : null
    const grande = ha === null || ha >= 3
    return { titolo: "Parco", dettaglio: ha === null ? "già presente" : `${fmt(ha)} ettari`, icona: "🌳", impatto,
      effetti: [e("Aria", grande ? 2 : 1, "Gli alberi trattengono polveri e CO₂"), e("Animali e verde", grande ? 3 : 2, grande ? "Habitat per uccelli e piccoli mammiferi" : "Piccolo rifugio per uccelli e insetti"),
        e("Salute", 2, "Spazio per camminare e fare sport"), e("Rumore", 1, "Assorbe parte del rumore"), e("Economia", -1, "Costi di manutenzione")],
      pro: ["Aria più pulita e meno caldo in estate", "Luogo di incontro per la comunità", "Più biodiversità"],
      contro: ["Manutenzione a carico del comune", "Sottrae suolo ad altri usi"] }
  }
  if (a.tipo === "ciclabile") {
    const km = aggiunta.ciclabile ? lunghezzaKm(aggiunta.ciclabile.tracciato) : null
    return { titolo: "Pista ciclabile", dettaglio: km === null ? "già presente" : `${fmt(km)} km`, icona: "🚲", impatto,
      effetti: [e("Aria", 1, "Meno auto sui tragitti brevi"), e("Salute", 2, "Più movimento quotidiano"), e("Mobilità", 2, "Alternativa sicura all'auto"),
        e("Animali e verde", -1, "Fascia di suolo asfaltata"), e("Economia", 1, "Turismo lento e commercio locale")],
      pro: ["Meno traffico e meno emissioni", "Più sicurezza per i ciclisti", "Attrae turismo in bicicletta"],
      contro: ["Occupa spazio stradale o campagna", "Costi di costruzione e manutenzione"] }
  }
  if (a.tipo === "colonnine")
    return { titolo: "Colonnine di ricarica", dettaglio: "stazione di ricarica EV", icona: "🔌", impatto,
      effetti: [e("Aria", 1, "Favorisce le auto elettriche"), e("Rumore", 1, "Motori elettrici più silenziosi"), e("Energia", -1, "Aumenta la domanda di elettricità"),
        e("Mobilità", 2, "Rende praticabile l'auto elettrica")],
      pro: ["Incentiva l'auto elettrica", "Meno emissioni locali", "Servizio per residenti e turisti"],
      contro: ["Richiede potenza dalla rete", "Dipende da come è prodotta l'energia"] }
  return { titolo: "Centrale nucleare", dettaglio: "energia pulita, impianto di grandi dimensioni", icona: "⚛️", impatto,
    effetti: [e("Energia", 3, "Energia continua, senza CO₂ in produzione"), e("Aria", 2, "Sostituisce fonti fossili: meno PM e NO₂"), e("Animali e verde", -1, "Prelievo d'acqua e calore dagli scarichi"),
      e("Paesaggio", -2, "Torri e impianti molto visibili"), e("Salute", -1, "Percezione del rischio, gestione delle scorie"), e("Economia", 2, "Lavoro qualificato e bollette stabili")],
    pro: ["Energia pulita e costante, anche di notte", "Meno emissioni su tutta la provincia", "Posti di lavoro altamente qualificati"],
    contro: ["Scorie da custodire per secoli", "Costi e tempi di costruzione elevati", "Forte impatto visivo e contrarietà locali"] }
}
