# TASKS — Divisione del lavoro (6 dev)

Riferimento: [SPEC.md](SPEC.md). Scadenze: **integrazione alle 16:45**, **app demo-abile alle 17:30**, poi solo rifiniture e prove del pitch (fine alle 19:00).

## Regole per lavorare in parallelo

1. **Prima cosa (Dev 4, entro 14:45):** scaffold dell'app (React + Vite + React Three Fiber + Vitest), cartelle e file dei contratti qui sotto. Tutti partono da quel commit.
2. Ognuno lavora sul **proprio branch** (`dev1-dati`, `dev2-osm-seed`, …) e tocca solo i propri file. I punti di contatto sono **solo i contratti** qui sotto.
3. Finché il pezzo di un altro non è pronto, si lavora con il **mock** previsto dal contratto (`dataset.mock.json`, motore finto che restituisce valori fissi).
4. Merge su `main` piccoli e frequenti. Chi rompe `main` lo sistema subito.

## Contratti condivisi (non cambiarli senza avvisare tutti)

### A. Dataset statico (`dataset.json`, prodotto da Dev 1 + Dev 2)
```ts
type Dataset = {
  meta: { periodoAria: string; inquinante: "PM10" | "PM10+NO2"; generatoIl: string }
  comuni: Comune[]
  infrastrutture: Infrastruttura[]
  caseSeed: Casa[]
}
type Comune = {
  istat: string; nome: string
  geometria: [number, number][][]   // poligoni semplificati, coordinate proiettate in metri
  centroide: [number, number]
  confinanti: string[]               // codici ISTAT
  ariaNorm: number                   // 0–100
  pm10: number; nCentraline: number
}
type TipoInfra = "parco" | "ciclabile" | "colonnine" | "industria" | "strada"
type Infrastruttura = { id: string; comune: string; tipo: TipoInfra; posizione: [number, number] }
type Dotazioni = {
  fotovoltaico: boolean; solareTermico: boolean
  riscaldamento: "pompa_calore" | "condensazione" | "tradizionale"
  cottura: "induzione" | "gas"
  isolamento: "buono" | "medio" | "scarso"
  infissi: boolean; colonninaEV: boolean
}
type Casa = { id: string; comune: string; pubblico: boolean; nickname?: string; dotazioni: Dotazioni }
```

### B. Motore indici (Dev 3)
```ts
punteggioCasa(d: Dotazioni): { punteggio: number; classe: "A"|"B"|"C"|"D"|"E"|"F"|"G"; mancanti: { dotazione: string; punti: number }[] }
statoTerritorio(ds: Dataset, s: Scenario, casaUtente?: Casa): Record<istat, {
  aria: number; infrastrutture: number; scenario: number; totale: number
  fascia: "ottima"|"buona"|"media"|"scarsa"|"pessima"; indiceCaseMedio: number
}>
classifica(case: Casa[], comune: string): { nome?: string; punteggio?: number; dotazioni: Dotazioni }[]
type Scenario = {
  aggiunte: { id: string; comune: string; tipo: TipoInfra; posizione: [number, number] }[]
  rimozioni: string[]   // id infrastrutture
  macro: { ambito: "provincia" | string; pctFV: number; pctSenzaGas: number; pctIsolamentoBuono: number } | null
}
```

### C. Stato globale dell'app (store, Dev 4)
```ts
{ vista: "provincia" | "comune"; comuneSelezionato: string | null
  modalita: "realta" | "scenario"; strumento: TipoInfra | "rimuovi" | null
  scenario: Scenario; casaUtente: Casa | null; sezione: "mappa" | "casa" | "simulazione" }
```
Gli indici si derivano sempre con `statoTerritorio(dataset, scenario, casaUtente)` e non si salvano mai nello store.

---

## Dev 1 — Dati aria e comuni (script di preparazione)
**Obiettivo:** produrre la parte `meta` + `comuni` di `dataset.json`.
- [x] Analizzare il CSV in `data/`: colonne, inquinanti, centraline, coordinate, periodo. Riportare subito al team se manca qualcosa rispetto a SPEC (assunzioni Q31–Q33).
- [x] Scaricare i confini ISTAT dei comuni della provincia di Vicenza, filtrarli (114), semplificarli e proiettarli in metri.
- [x] Calcolare centroidi e **confinanti** (adiacenza tra poligoni).
- [x] Media PM10 dell'ultimo anno per centralina, **IDW** sui centroidi, `nCentraline` usate.
- [x] Normalizzazione: 15 µg/m³ → 100, 50 → 0, lineare.
- [x] Consegnare entro le 14:45 un `dataset.mock.json` con 5 comuni finti per sbloccare gli altri, ed entro le 16:00 la versione reale.

**Fatto quando:** 114 comuni con `ariaNorm` plausibili, nessun comune senza confinanti tranne casi reali.

> Stato: consegna Dev 1 completata. Il CSV originale manca: usate medie annuali ufficiali ARPAV 2025 e coordinate ufficiali. Dettagli in [docs/dev1-dati.md](docs/dev1-dati.md). Le spunte indicano il completamento attuale, non attestano il rispetto degli orari originari.

## Dev 2 — Infrastrutture OSM e case seed
**Obiettivo:** produrre `infrastrutture` + `caseSeed` di `dataset.json` (unendo il proprio output a quello di Dev 1).
- [ ] Estrazione OSM (Overpass) per la provincia: parchi, aree industriali, strade statali/provinciali, piste ciclabili, colonnine.
- [ ] Assegnare ogni oggetto al comune (punto nel poligono) e tenere **max 3 per tipo per comune**, i più grandi o importanti.
- [ ] **Ripiego entro le 15:00:** se OSM non funziona, posizionamento procedurale plausibile per comune.
- [ ] Generare le case seed sintetiche, alcune per comune, con mix di dotazioni plausibile e mix pubblico/privato con nickname. Sono "dati dimostrativi".
- [ ] Script finale che unisce tutto in `dataset.json`.

**Fatto quando:** ogni comune ha qualche infrastruttura e qualche casa, e il file pesa poco (< 5 MB).

## Dev 3 — Motore indici + test
**Obiettivo:** implementare il contratto B come modulo puro, con test Vitest.
- [ ] `punteggioCasa`: pesi della checklist (dal responsabile pesi, congelati alle 16:30), classe A–G, lista `mancanti` ordinata per punti.
- [ ] `statoTerritorio`:
  - `aria + infrastrutture + scenario`, con clamp 0–100;
  - infrastrutture esistenti con tetto ±20;
  - aggiunte e rimozioni a delta pieno;
  - spillover a metà sui confinanti solo per lo scenario;
  - macro-scenari che ricalcolano le case seed nell'ambito e aggiungono un delta aria con tetto +10;
  - fasce;
  - indice case medio, includendo la casa utente.
- [ ] `classifica`: ordinamento per punteggio; i privati senza nome né punteggio.
- [ ] Test sui casi elencati in SPEC → Testing Decisions, con un dataset fittizio di 3–4 comuni.
- [ ] Entro le 14:45: pubblicare una versione stub con le firme giuste e valori fissi, così gli altri possono integrare.

**Fatto quando:** tutti i test sono verdi e le firme coincidono col contratto.

## Dev 4 — Scaffold, store e vista provincia
**Obiettivo:** l'ossatura dell'app e la mappa della provincia.
- [ ] **Entro le 14:45:** scaffold del progetto, store (contratto C), caricamento di `dataset.json`/mock e navigazione fra le sezioni Mappa / Casa / Simulazione.
- [ ] Vista provincia in R3F: estrusione low-poly dei poligoni dei comuni, colore per fascia, controlli camera (ruota/zoom/sposta).
- [ ] Hover con nome e indice; legenda delle 5 fasce.
- [ ] Clic su un comune → zoom animato e passaggio a `vista: "comune"`; pulsante "Torna alla provincia".
- [ ] Integrazione finale su `main` alle 16:45: è il responsabile del merge.

**Fatto quando:** la mappa gira fluida sul portatile della demo e i colori reagiscono ai cambi di scenario.

## Dev 5 — Diorama del comune + build mode sul terreno
**Obiettivo:** la vista "comune viva" e l'interazione di posizionamento.
- [ ] Diorama del comune selezionato: terreno low-poly dal poligono.
- [ ] **5 preset di fascia**: cielo e nebbia, nuvole bianche o grigie, densità degli alberi instanziati (100/75/50/25%/spogli), uccelli e animali animati.
- [ ] Modellini low-poly per i 5 tipi di infrastruttura, sia reali sia aggiunti.
- [ ] Build mode, quando `modalita === "scenario"`:
  - clic sul terreno con uno strumento attivo → aggiunge a `scenario.aggiunte`;
  - clic su un'infrastruttura con "rimuovi" → aggiunge a `scenario.rimozioni`.
- [ ] Transizione morbida quando cambia la fascia.

**Fatto quando:** aggiungere un'industria rende visibilmente il cielo più grigio e toglie alberi e uccelli.

## Dev 6 — UI: Casa, classifica, pannelli di simulazione
**Obiettivo:** tutte le schermate 2D sopra la mappa.
- [x] **Casa:**
  - form dotazioni e comune (elenco dei 114);
  - interruttore Pubblico/Privato e nickname;
  - salvataggio in `localStorage` con try/catch.
- [x] **Dashboard:** punteggio, classe A–G, "cosa ti manca per salire".
- [x] **Classifica comunale** con le regole privacy, case seed etichettate "dati dimostrativi".
- [x] **Pannello comune:** "Aria reale X · Infrastrutture ±Y · (Scenario ±W) · Totale Z", "stima da N centraline", periodo, indice case medio.
- [x] **Simulazione:**
  - interruttore Realtà/Scenario e palette strumenti (con "rimuovi");
  - pulsante Reset;
  - simulatore casa (dotazioni ipotetiche, punteggio prima → dopo, senza toccare la casa reale);
  - 3 slider macro con scelta dell'ambito provincia/comune;
  - nota "modello semplificato e indicativo".

**Fatto quando:** lo script della demo (SPEC → Further Notes) si percorre tutto dall'interfaccia.

---

## Fuori dai dev (chi è libero / dopo le 17:30)
- **Slide del pitch:** problema → soluzione → demo → roadmap (social: follow, richieste, amicizie, consigli; gamification: missioni, badge).
- **Pesi della checklist:** ritocchi fino alle 16:30, poi comunicati a Dev 3.
- **Tester:** dalle 16:45 percorre lo script della demo e segnala i bug nel canale del team.

## Dipendenze in sintesi

| Chi | Aspetta | Mock per non bloccarsi |
|---|---|---|
| Dev 3 | nessuno | dataset fittizio nei test |
| Dev 4, 5, 6 | Dev 1/2 (dati), Dev 3 (motore) | `dataset.mock.json` + motore stub (alle 14:45) |
| Dev 2 | Dev 1 (poligoni dei comuni) | confini ISTAT scaricati in autonomia, se serve |
