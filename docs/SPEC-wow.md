# SPEC — Effetto "wow" per la demo finale

> Estende [SPEC.md](../SPEC.md). Tre funzionalità pensate per la demo davanti alla giuria:
> **(A) Onda di propagazione** visibile, **(B) Macchina del tempo 2025 → 2040**, **(C) Assistente AI** che costruisce gli scenari a parole.
> Ordine di sviluppo consigliato: A → B → C (C sfrutta A e B per il suo effetto).
>
> **Stato (24/10, notte):** B implementata (`src/engine/tempo.ts`, `src/store/tempo.ts`, `src/map/MacchinaDelTempo.tsx`, passo demo "3. 2040") con quattro piani: *Passo indietro* (PM10 +2%/anno), *Inerzia* (−0,5%), *Piano clima* (−2%), *Tutti a bordo* (−3,5%). In più: paesaggio sonoro sintetizzato per zona (`src/audio/`), pulsante "Suoni" sulla mappa. A e C non ancora implementate.

## Problem Statement

La piattaforma calcola già tutto ciò che serve: indici per comune, spillover sui confinanti, scenari macro, cielo e fauna che reagiscono. Però tre messaggi chiave del pitch restano **detti e non mostrati**:

1. *"L'aria non si ferma al confine comunale"* (slide 3): nella mappa i comuni confinanti cambiano colore, ma insieme e in silenzio. Nessuno nota che l'effetto si è propagato.
2. *"Se tutti facessero la loro parte…"*: gli slider macro cambiano la mappa in un istante. Manca il senso del **percorso nel tempo**, che è la storia emotiva da raccontare.
3. *"Dati complessi, scelte semplici"* (slide 1): per costruire uno scenario oggi servono strumenti, palette e tracciati. Un giudice non può semplicemente **chiedere** "cosa succede se…".

## Solution

- **A. Onda di propagazione**: ogni modifica dello scenario parte dal comune toccato come un'onda luminosa che raggiunge i confinanti con un piccolo ritardo. Sopra ogni comune colpito compare un'etichetta del delta (`−12`, `−6`), che sale e svanisce.
- **B. Macchina del tempo**: una barra "2025 ▶ 2040" sotto la mappa. Con Play gli anni scorrono in circa 12 secondi e le quote di case virtuose crescono lungo una curva. I comuni cambiano colore, la nebbia si dirada, la camera ruota lentamente e i contatori salgono.
- **C. Assistente AI**: una barra "Chiedi" (anche a voce) in cui si scrive *"Cosa succede se Schio chiude un'industria e aggiunge due parchi?"*. Claude traduce la frase in un **piano di azioni** strutturato e l'app lo applica con il motore esistente: l'onda (A) parte e, se la domanda riguarda il futuro, si avvia la macchina del tempo (B). **I numeri li calcola sempre il motore, mai il modello.**

## User Stories

### A. Onda di propagazione
1. Come giurato, quando si aggiunge o si rimuove un'infrastruttura, voglio vedere un impulso partire dal comune toccato e raggiungere i confinanti, così da *vedere* che l'inquinamento non ha confini.
2. Come giurato, voglio leggere sopra ogni comune colpito di quanto è cambiato il suo indice, così da capire che il confinante riceve metà dell'effetto.
3. Come utente, voglio che l'onda sia verde per i miglioramenti e ambra o rossa per i peggioramenti, così da capirne il segno a colpo d'occhio.
4. Come utente con "riduci movimento" attivo nel sistema, voglio solo le etichette senza animazione, così da non avere fastidi.
5. Come presentatore, voglio che l'onda non rallenti la mappa anche con molte modifiche di fila, così che la demo resti fluida.

### B. Macchina del tempo
6. Come giurato, voglio premere Play e vedere la provincia evolvere anno per anno dal 2025 al 2040, così da percepire l'effetto cumulativo delle scelte.
7. Come utente, voglio scegliere tra tre piani predefiniti ("Inerzia", "Piano clima", "Tutti a bordo") o impostare gli obiettivi al 2040, così da confrontare futuri diversi.
8. Come utente, voglio trascinare il cursore dell'anno avanti e indietro, così da fermarmi su un anno preciso.
9. Come giurato, voglio vedere contatori che crescono (% case con fotovoltaico, PM10 medio stimato, comuni in fascia Ottima o Buona), così da avere numeri concreti accanto alle immagini.
10. Come giurato, voglio che cielo, nebbia, nuvole, alberi e fauna seguano l'anno mostrato, così da vivere il cambiamento e non solo leggerlo.
11. Come utente, voglio che nel 2025 la mappa coincida esattamente con la realtà, così da fidarmi del punto di partenza.
12. Come giurato, voglio a fine riproduzione una scheda riassuntiva "2025 → 2040", così da avere la sintesi per il pitch.
13. Come presentatore, voglio che le ipotesi (curva di adozione, tendenza del PM10) siano dichiarate sullo schermo, così da essere trasparente con la giuria.

### C. Assistente AI
14. Come giurato, voglio scrivere una domanda in italiano naturale e vedere la mappa rispondere, così da provare la piattaforma senza imparare gli strumenti.
15. Come presentatore, voglio poter parlare invece di scrivere, così da rendere la demo più naturale.
16. Come utente, prima che la mappa cambi, voglio vedere il piano capito dall'AI come elenco di azioni ("➕ 2 parchi a Schio", "➖ 1 industria a Schio"), così da verificare che abbia capito bene.
17. Come utente, voglio una risposta breve con i numeri reali prima → dopo calcolati dal motore, così da avere una risposta affidabile.
18. Come utente, voglio chiedere scenari nel tempo ("…entro il 2040") e veder partire la macchina del tempo, così da collegare domanda e futuro.
19. Come utente, voglio fare domande sui dati ("Qual è il comune messo peggio?") e ottenere la risposta con lo zoom sul comune, così da esplorare parlando.
20. Come utente, voglio annullare tutto quello che l'assistente ha fatto con un clic, così da ricominciare.
21. Come presentatore, voglio che la demo funzioni anche senza rete o senza chiave API sulle domande del copione, così da non dipendere dal Wi-Fi della sala.
22. Come utente, voglio che i dati della mia casa non vengano mai inviati all'AI, così da proteggere la mia privacy.

## Implementation Decisions

### Principi comuni
- Restano validi i contratti A, B e C di [TASKS.md](../TASKS.md). **`statoTerritorio` non cambia firma.** Le nuove funzionalità sono moduli puri attorno al motore e componenti UI.
- La vista principale è `MappaTerritorio` (MapLibre). Il diorama R3F (`Provincia.tsx`) riceve solo il cielo e gli indici dell'anno (B): niente onda né assistente nel diorama, almeno nella prima versione.
- Tutto il testo è in italiano. Rispettare `prefers-reduced-motion`.

---

### A. Onda di propagazione

**Modulo puro `src/map/onda.ts`**
```ts
// Anelli di distanza dal comune di origine lungo il grafo dei confinanti (0 = origine).
anelli(comuni: Comune[], origine: string, maxAnello = 2): Map<string, number>
// Comuni il cui totale è cambiato più di una soglia, con il delta (dopo − prima).
differenze(prima: Record<string, StatoComune>, dopo: Record<string, StatoComune>, soglia = 0.05): { istat: string; delta: number }[]
// Ritardo di accensione per anello, in ms.
ritardo(anello: number): number   // 0 → 0, 1 → 350, 2 → 700
```

**Rilevamento.** Un hook in `MappaTerritorio` confronta gli indici precedenti con quelli nuovi a ogni cambio di `scenario` (non quando cambiano `macro` o l'anno della macchina del tempo, che hanno animazioni proprie).
- L'origine è il comune dell'ultima aggiunta o rimozione, ricavato dal diff di `scenario.aggiunte` e `scenario.rimozioni`.
- Si animano solo i comuni presenti in `differenze`, ordinati per anello; i comuni cambiati ma fuori dagli anelli usano l'anello più lontano.

**Resa grafica**
- **Impulso sui confini**: nuovo layer `line` `onda-confini` sulla sorgente `comuni-vicenza`, con `line-width` e `line-opacity` guidate da `feature-state.impulso` e transizione di 600 ms. Per ogni comune si imposta `impulso = 1` dopo `ritardo(anello)` e lo si riporta a 0 dopo 600 ms.
- **Colore dell'impulso**: verde (`#22c55e`) se delta > 0, ambra o rossa (`#f97316`) se delta < 0.
- **Riempimento**: già animato (`fill-color-transition: 900ms`). Si ritarda solo l'aggiornamento del `feature-state.colore` di ciascun comune secondo il suo anello, così il colore "arriva" con l'onda.
- **Etichette**: `maplibregl.Marker` HTML sul centroide con `−12` / `−6`, con un'animazione CSS di salita e dissolvenza in 1,8 s, poi rimossi.
- **Opzionale (P2)**: una scia di particelle dal punto dell'infrastruttura verso i confinanti nel layer custom esistente (`EcosistemaLayer`). È solo illustrativa: il motore applica metà delta a **tutti** i confinanti indipendentemente dal vento, quindi nessuna direzione deve suggerire numeri diversi.

**Prestazioni.** Al massimo un'onda attiva per comune di origine: una nuova onda annulla i timer della precedente. Niente `setData` sulla sorgente durante l'onda: si usano solo i `feature-state`.

**Fuori scope.** Spillover oltre il primo anello nei numeri (il motore resta a metà delta sui soli confinanti). Il secondo anello si anima solo se `differenze` lo include.

---

### B. Macchina del tempo

**Modulo puro `src/engine/tempo.ts`**
```ts
type Curva = "lineare" | "s"          // "s" = adozione logistica, più realistica
type PianoTemporale = {
  nome: string
  annoInizio: number                  // 2025 = anno dei dati aria
  annoFine: number                    // 2040
  ambito: "provincia" | string
  obiettivi: { pctFV: number; pctSenzaGas: number; pctIsolamentoBuono: number } // quote al annoFine
  curva: Curva
  trendPm10PctAnno: number            // es. −2 = −2% di PM10 all'anno, dichiarato in UI
}
quoteAttuali(ds: Dataset, ambito): { pctFV; pctSenzaGas; pctIsolamentoBuono }   // dalle case seed
avanzamento(curva: Curva, t: number): number                                    // t ∈ [0,1] → [0,1]
datasetAnno(ds: Dataset, anni: number, trendPm10PctAnno: number): Dataset       // ricalcola pm10 → ariaNorm (15→100, 50→0)
scenarioAnno(piano: PianoTemporale, anno: number, base: Scenario, attuali): Scenario
fotogrammi(ds, piano, base: Scenario, casaUtente?): { anno: number; indici: Record<string, StatoComune>; riepilogo: Riepilogo }[]
type Riepilogo = { pctFV: number; pm10Medio: number; perFascia: Record<Fascia, number>; indiceMedio: number }
```

**Decisioni**
- **Anno di partenza = realtà.** Per l'anno iniziale `scenarioAnno` restituisce `base` con `macro: null`, quindi gli indici del 2025 sono identici a quelli mostrati in modalità realtà.
- **Quote nel tempo**: `quota(anno) = attuale + (obiettivo − attuale) × avanzamento(curva, t)`. Le quote non scendono mai sotto quella attuale (lo garantisce già `applicaMacro`, che non toglie dotazioni).
- **Aria nel tempo.** Il delta macro sull'aria ha un tetto di +10 (SPEC), troppo poco per un cambiamento visibile in 15 anni. Si aggiunge quindi una **tendenza del PM10 dichiarata** (`trendPm10PctAnno`) applicata da `datasetAnno` al `pm10` di ogni comune, ricalcolando `ariaNorm` con la stessa normalizzazione.
  - Il contratto B non cambia: si passa a `statoTerritorio` un dataset derivato.
  - Valore predefinito per "Inerzia": la tendenza storica ARPAV, ricavata da `polveri-pm10_trend.csv` (già usato da Dev 1; serve la serie pluriennale in `data/raw/`). Valori di ripiego se il file manca: −1%/anno per "Inerzia", −3%/anno per "Piano clima" e "Tutti a bordo".
  - In UI c'è sempre la scritta: *"Proiezione illustrativa: tendenza PM10 X%/anno + adozione dotazioni. Modello semplificato."*
- **Piani predefiniti**

  | Piano | FV | Senza gas | Isolamento buono | Trend PM10 | Curva |
  |---|---|---|---|---|---|
  | Inerzia | attuale + 10 | attuale + 5 | attuale + 5 | storico ARPAV | lineare |
  | Piano clima | 50% | 40% | 50% | −3%/anno | s |
  | Tutti a bordo | 80% | 70% | 75% | −3%/anno | s |

- **Scenario dell'utente.** Se in modalità Scenario ci sono aggiunte o rimozioni, una casella "Includi il mio scenario dal 2027" le fa entrare in `base` dall'anno indicato. Valore predefinito: inclusa.
- **Precalcolo.** Si calcolano 16 fotogrammi (uno per anno) quando si sceglie il piano, cioè 16 chiamate a `statoTerritorio`, accettabile su 114 comuni e 1368 case. Tra due anni si **interpola linearmente** il `totale` di ogni comune per avere un'animazione continua; la fascia si ricava dal totale interpolato.

**Store (contratto C, estensione retrocompatibile)**
```ts
tempo: { attivo: boolean; anno: number; inRiproduzione: boolean; piano: PianoTemporale } | null
avviaTempo(piano), fermaTempo(), setAnno(anno: number /* anche frazionario */), play(), pausa()
```
- `useIndici()` restituisce gli indici interpolati dell'anno quando `tempo.attivo`, altrimenti quelli di oggi. Così colori, cielo (`atmosferaDaStato`), fauna ed edifici seguono senza toccare i loro componenti.
- Mentre la macchina del tempo è attiva, gli strumenti dello scenario sono disabilitati (barra in sola lettura). Si esce con "Torna al presente".

**UI: `src/map/MacchinaDelTempo.tsx`**
- Barra in basso sulla mappa con:
  - anno grande, con numeri tabellari;
  - pulsanti ▶ / ⏸;
  - cursore 2025–2040;
  - scelta del piano;
  - velocità 1× / 2×;
  - riga delle ipotesi dichiarate.
- Tre contatori animati: % case con FV, PM10 medio µg/m³, comuni in fascia Ottima o Buona (`n/114`).
- **Riproduzione**: circa 0,8 s per anno, guidata da `requestAnimationFrame`. Camera: rotazione lenta del `bearing` (circa 25° in tutto) e leggero `pitch`, ripristinati a fine corsa. Senza movimento della camera se `prefers-reduced-motion`.
- **Scheda finale** a fine corsa: "2025 → 2040", comuni migliorati di fascia, ΔPM10, Δ indice medio e % case con FV. Pulsante "Rivedi".
- Punto d'ingresso: un pulsante "🕰 2040" nella barra della mappa e un nuovo passo nella barra demo (`App.tsx`, `eseguiPassoDemo`).

---

### C. Assistente AI

**Architettura**
- **Nessuna chiave nel browser.** Si aggiunge un middleware al dev server di Vite (plugin in `vite.config.ts` → `server/assistente.ts`) che espone `POST /api/assistente` e chiama la Claude API con `@anthropic-ai/sdk` lato Node.
  - Credenziali: `ANTHROPIC_API_KEY`, oppure il profilo creato con `ant auth login`.
  - La demo gira con `npm run dev` sul portatile del presentatore, come previsto da SPEC. Lo stesso handler si può esporre come serverless function in caso di deploy.
- **Modello**: `claude-opus-5-5` con `output_config.effort: "low"` per tenere bassa la latenza (obiettivo: risposta in meno di 4 s).
  - Attivo `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) per non restare senza risposta in caso di rifiuto.
  - Si controlla sempre `stop_reason` prima di leggere il contenuto.
- **Una sola chiamata con output strutturato** (`output_config.format` con JSON Schema), non un ciclo di tool. Il modello restituisce un **piano**; l'app lo valida e lo applica con il motore. Motivi: latenza, determinismo, e il fatto che i numeri restano calcolati dal motore.
- **Contesto nel system prompt**, stabile e quindi messo in cache con `cache_control`. Contiene:
  - regole del modello (delta delle infrastrutture, spillover, tetti);
  - l'elenco dei 114 comuni in forma compatta: `istat | nome | totale | fascia | n infrastrutture per tipo | confinanti`;
  - i piani predefiniti di B.

  Lo stato volatile (scenario corrente, comune selezionato) va nel messaggio utente, dopo il punto di cache. **Mai `casaUtente`.**

**Schema del piano (`src/assistente/piano.ts`)**
```ts
type Azione =
  | { tipo: "aggiungi"; comune: string /* istat */; infra: TipoInfra; quantita: number /* 1–5 */; industria?: TipoIndustria; strada?: { tipo: TipoStrada; km: number } }
  | { tipo: "rimuovi"; comune: string; infra: TipoInfra; quantita: number }
  | { tipo: "macro"; ambito: "provincia" | string; pctFV: number; pctSenzaGas: number; pctIsolamentoBuono: number }
  | { tipo: "tempo"; piano: "inerzia" | "piano_clima" | "tutti_a_bordo" | PianoTemporale }
  | { tipo: "vai"; comune: string }
  | { tipo: "reset" }
type Piano = { azioni: Azione[]; risposta: string /* max 2 frasi, senza numeri inventati */; nonCapito?: string }
```

**Funzioni pure (testabili senza rete)**
```ts
validaPiano(json: unknown, ds: Dataset): { ok: true; piano: Piano } | { ok: false; errore: string }
// codici ISTAT esistenti, quantità e percentuali nei limiti, al massimo 8 azioni
applicaPiano(scenario: Scenario, piano: Piano, ds: Dataset, trovaPunto: (comune, tipo) => [number, number] | null): Scenario
// "aggiungi": posizioni libere vicino al centroide (ricerca a spirale con areaLibera/percorsoLibero di ostacoli.ts);
//   strade: segmento rettilineo di `km` dentro il comune.
// "rimuovi": sceglie gli id delle infrastrutture del comune di quel tipo, prima quelle che contano (le prime 3).
esito(prima, dopo, comuni coinvolti): { istat; nome; prima: number; dopo: number; fasciaPrima; fasciaDopo }[]
```

**Flusso UI (`src/assistente/Assistente.tsx`)**
1. Una barra flottante "✨ Chiedi alla mappa" si apre con un clic o con ⌘K / Ctrl+K e ha un pulsante 🎤 per la voce (Web Speech API, `it-IT`, solo Chrome ed Edge; il pulsante è nascosto se non disponibile).
2. Durante l'attesa: "Sto leggendo i 114 comuni…" con indicatore.
3. Il piano compare come chip, e le azioni vengono applicate **una alla volta, a 700 ms di distanza**, così ogni modifica fa partire la sua onda (A). Il passaggio in modalità Scenario e il volo sul comune (`flyTo`) sono automatici.
4. Una scheda risposta mostra la frase del modello più la tabella prima → dopo generata da `esito`. I numeri vengono **solo** dal motore.
5. Un'azione `tempo` apre la macchina del tempo (B) con quel piano e avvia Play.
6. Il pulsante "Annulla" ripristina lo scenario salvato prima della domanda.

**Robustezza per la demo**
- **Copione offline**: `src/assistente/copione.ts` contiene i piani già pronti per le 3–4 domande della demo, confrontate in forma normalizzata (minuscole, senza punteggiatura). Si usano se l'endpoint fallisce o non risponde entro 6 s, oppure con `?offline=1`. La UI resta identica.
- Errori di validazione: messaggio "Non ho capito: …" con 3 domande d'esempio cliccabili.
- Al massimo una richiesta alla volta; il pulsante è disabilitato durante l'attesa.

**Domande d'esempio mostrate nella barra**
- "Cosa succede se Schio chiude un'industria e aggiunge due parchi?"
- "Costruisci un'autostrada di 10 km a Thiene"
- "Mostrami la provincia nel 2040 se metà delle case mette il fotovoltaico"
- "Qual è il comune messo peggio?"

---

### Copione demo che unisce A + B + C (circa 2 minuti)
1. "Chiedi alla mappa": *"Cosa succede se Schio chiude un'industria e aggiunge due parchi?"*. Volo su Schio, tre onde verdi che raggiungono i confinanti, scheda prima → dopo.
2. *"E se entro il 2040 metà delle case della provincia mettesse il fotovoltaico?"*. Parte la macchina del tempo: la provincia vira al verde, la nebbia si dirada, i contatori salgono.
3. Scheda finale "2025 → 2040" sullo schermo mentre si chiude il pitch.

## Testing Decisions

- Si testano solo i moduli puri, con Vitest e le fixture esistenti (`src/engine/fixtures.ts`). Nessun test di UI 3D né di rete.
- **A** (`onda.test.ts`):
  - anelli BFS corretti su un grafo noto;
  - `maxAnello` rispettato;
  - `differenze` ignora i delta sotto soglia;
  - aggiungere un'industria al comune A produce A = −12 e i confinanti = −6.
- **B** (`tempo.test.ts`):
  - il fotogramma 2025 è uguale a `statoTerritorio(ds, base)`;
  - le quote all'anno finale sono uguali agli obiettivi;
  - `avanzamento` è monotono e vale 0 → 0 e 1 → 1 per entrambe le curve;
  - `datasetAnno` con trend 0 lascia il dataset invariato;
  - con trend negativo `ariaNorm` non scende;
  - le quote non scendono mai sotto `quoteAttuali`.
- **C** (`piano.test.ts`):
  - `validaPiano` rifiuta ISTAT inesistenti, percentuali fuori 0–100, quantità fuori 1–5 e più di 8 azioni;
  - `applicaPiano` con "rimuovi 1 industria" rimuove un id reale del comune giusto;
  - "aggiungi 2 parchi" produce 2 aggiunte nel comune;
  - "reset" svuota lo scenario;
  - ogni domanda del copione offline produce un piano valido.
- Verifica manuale con il copione demo, sia con rete sia con `?offline=1`.

## Out of Scope
- Chat con più turni e memoria della conversazione (una domanda = un piano).
- Diorama R3F nell'onda e nell'assistente.
- Deploy pubblico dell'assistente con chiave in produzione.
- Spillover "a vento" nei numeri del motore.

## Questioni aperte
1. **Quando è la presentazione?** Determina se si fanno tutte e tre o solo A + B.
2. **Chiave API**: c'è un account Anthropic utilizzabile sul portatile della demo? Senza, si consegna C solo in modalità copione.
3. **Tendenza PM10**: si accetta un valore dichiarato oppure si recupera la serie storica ARPAV (`polveri-pm10_trend.csv`) per l'"Inerzia"?
4. **Browser della demo**: Chrome è garantito? Serve per la voce.

## Stima indicativa
| Blocco | Sforzo |
|---|---|
| A. Onda | ½ giornata |
| B. Macchina del tempo | 1 giornata |
| C. Assistente (con copione offline) | 1–1½ giornate |
