# SPEC — Piattaforma Interattiva per la Sostenibilità Territoriale (Provincia di Vicenza)

> Stato: MVP per demo hackathon (scadenza 22/10/2026 ore 19:00, app demo-abile entro le 17:30).
> Le decisioni Q31–Q34 (dati aria) sono **assunzioni predefinite** da verificare quando il CSV dell'hackathon sarà in `data/`.

## Problem Statement

I cittadini della provincia di Vicenza non percepiscono in modo concreto né la qualità dell'aria del proprio comune né quanto le scelte energetiche della propria casa (fotovoltaico, riscaldamento, isolamento, cottura, mobilità elettrica) incidano sulla sostenibilità della comunità. I dati ambientali esistono (centraline, open data), ma sono numeri astratti, frammentati e poco coinvolgenti. Mancano anche strumenti semplici per capire "cosa succederebbe se…": se installassi una pompa di calore, se il mio comune avesse un parco in più o un'industria in meno, se metà delle case passasse al fotovoltaico.

## Solution

Una web app in italiano costruita attorno a una **mappa 3D low-poly a diorama** dei 114 comuni della provincia di Vicenza. Ogni comune ha un **indice ambientale 0–100**, calcolato dalla qualità dell'aria reale più il contributo delle infrastrutture reali (OpenStreetMap). L'indice si traduce visivamente: cielo limpido, alberi rigogliosi e fauna attiva quando è alto; foschia, vegetazione spoglia e nessun animale quando è basso.

L'utente demo può:
1. **Esplorare la mappa**: la vista provincia ha i comuni colorati per fascia. Un clic su un comune apre lo zoom sul diorama vivo, con il pannello che scompone l'indice.
2. **Censire la propria casa**: indica il comune e le dotazioni, ottiene un punteggio 0–100 con classe A–G e vede cosa gli manca per salire. Sceglie se il profilo è pubblico o privato e si confronta nella classifica comunale.
3. **Simulare scenari**:
   - modalità **Scenario** per aggiungere o rimuovere infrastrutture sul diorama;
   - simulatore **casa singola**;
   - **macro-scenari** con slider percentuali sulle case.

   La mappa reagisce in tempo reale.

Social (follow, amicizie, consigli) e gamification (missioni) sono presentati **solo come roadmap nelle slide del pitch**.

## User Stories

### Mappa 3D (modulo 1)
1. Come cittadino, voglio vedere all'apertura una mappa 3D low-poly di tutta la provincia di Vicenza, così da riconoscere subito il mio territorio.
2. Come cittadino, voglio che ogni comune sia colorato in base alla sua fascia di indice ambientale, così da capire a colpo d'occhio dove l'ambiente sta meglio o peggio.
3. Come cittadino, voglio vedere una legenda con le 5 fasce (Ottima, Buona, Media, Scarsa, Pessima), così da interpretare correttamente i colori.
4. Come cittadino, voglio poter ruotare, zoomare e spostare la vista della provincia, così da esplorarla liberamente.
5. Come cittadino, voglio passare il mouse su un comune e vederne nome e indice, così da orientarmi senza cliccare.
6. Come cittadino, voglio cliccare su un comune e ottenere uno zoom animato sul suo diorama, così da vederlo "da vicino".
7. Come cittadino, voglio che il cielo del diorama cambi (azzurro con nuvole bianche → velato → grigio → foschia scura) in base alla fascia, così da percepire la qualità dell'aria.
8. Come cittadino, voglio che la densità di alberi del diorama scenda al peggiorare dell'indice (100% → 75% → 50% → 25% → rami spogli), così da vedere il degrado della vegetazione.
9. Come cittadino, voglio vedere uccelli e piccoli animali animati in quantità proporzionale alla fascia, così da percepire la vitalità dell'ecosistema.
10. Come cittadino, voglio vedere sul diorama le infrastrutture reali del comune (parchi, aree industriali, strade principali, piste ciclabili, colonnine) come modellini low-poly, così da collegare l'indice a ciò che esiste davvero.
11. Come cittadino, voglio un pannello del comune con la scomposizione "Aria reale X · Infrastrutture ±Y · Totale Z", così da capire da cosa dipende il punteggio.
12. Come cittadino, voglio sapere nel pannello che l'aria è "stima da N centraline" e di quale periodo, così da fidarmi della fonte.
13. Come cittadino, voglio vedere nel pannello anche l'indice medio delle case del comune (etichettato "dati dimostrativi"), così da capire la sostenibilità domestica della mia comunità.
14. Come cittadino, voglio tornare alla vista provincia con un pulsante, così da confrontare altri comuni.
15. Come presentatore della demo, voglio che la mappa resti fluida su un portatile normale, così che la demo non si blocchi.

### Casa e dashboard (modulo 2)
16. Come utente demo, voglio trovarmi già "loggato" senza registrazione, così da entrare subito nella funzionalità.
17. Come utente, voglio scegliere il comune della mia casa da un elenco dei 114 comuni, senza indirizzo, così da proteggere la mia privacy.
18. Come utente, voglio indicare se ho il fotovoltaico, così che il punteggio lo consideri.
19. Come utente, voglio indicare se ho il solare termico, così che il punteggio lo consideri.
20. Come utente, voglio scegliere il tipo di riscaldamento (pompa di calore, caldaia a condensazione, caldaia tradizionale/gasolio), così che il punteggio lo consideri.
21. Come utente, voglio scegliere il piano cottura (induzione o gas), così che il punteggio lo consideri.
22. Come utente, voglio indicare il livello di isolamento (buono, medio, scarso), così che il punteggio lo consideri.
23. Come utente, voglio indicare se ho infissi a doppio/triplo vetro, così che il punteggio lo consideri.
24. Come utente, voglio indicare se ho una colonnina di ricarica EV, così che il punteggio lo consideri.
25. Come utente, voglio vedere nella dashboard il punteggio 0–100 e la classe A–G, così da capire quanto è sostenibile la mia casa.
26. Come utente, voglio vedere la lista "cosa ti manca per salire" con i punti che ogni intervento farebbe guadagnare, così da sapere dove investire.
27. Come utente, voglio che i dati della mia casa restino salvati quando ricarico la pagina, così da non reinserirli.
28. Come utente, voglio scegliere se il mio profilo casa è Pubblico o Privato, così da controllare cosa vedono gli altri.
29. Come utente con profilo pubblico, voglio dare un nome o nickname alla mia casa, così da comparire riconoscibile in classifica.
30. Come utente, voglio vedere la classifica del mio comune, così da confrontarmi con i vicini.
31. Come utente con profilo pubblico, voglio comparire in classifica con nome, punteggio e dotazioni, così da essere riconosciuto per i miei sforzi.
32. Come utente con profilo privato, voglio comparire in classifica in forma anonima con le sole dotazioni (senza nome né punteggio), così da contribuire senza espormi.
33. Come utente, voglio che il mio comune non venga mai mostrato ad altri se non come dato aggregato, così che la mia posizione resti protetta.
34. Come utente, voglio che la mia casa contribuisca all'indice case medio del mio comune, così da sentirmi parte della comunità.

### Simulazione (modulo 4)
35. Come utente, voglio un interruttore "Realtà / Scenario", così da sperimentare senza confondere la simulazione con il dato reale.
36. Come utente in modalità Scenario, voglio una palette con parco, pista ciclabile, colonnine, industria e strada principale, così da scegliere cosa aggiungere.
37. Come utente in modalità Scenario, voglio cliccare sul terreno del comune selezionato per piazzare l'elemento scelto, così da costruire il mio scenario.
38. Come utente in modalità Scenario, voglio cliccare su un'infrastruttura (anche reale) per rimuoverla, così da vedere cosa succederebbe senza di essa.
39. Come utente, voglio che l'indice del comune e il suo diorama (cielo, alberi, fauna) si aggiornino immediatamente dopo ogni modifica, così da percepire l'impatto.
40. Come utente, voglio che i comuni confinanti risentano di metà dell'effetto delle mie modifiche, così da capire che l'inquinamento non ha confini.
41. Come utente, voglio vedere nel pannello la riga "Scenario ±W" oltre ad aria e infrastrutture, così da distinguere la mia simulazione dalla realtà.
42. Come utente, voglio un pulsante "Reset" che annulli tutto lo scenario, così da ricominciare.
43. Come utente, voglio un simulatore casa in cui attivare dotazioni ipotetiche (es. pompa di calore + fotovoltaico) e vedere il punteggio prima → dopo, senza modificare la mia casa reale, così da valutare un intervento.
44. Come utente, voglio slider macro "% case con fotovoltaico", "% case senza gas" e "% case con isolamento buono", applicabili a tutta la provincia o a un comune, così da esplorare scenari di scala.
45. Come utente, voglio vedere come cambiano l'indice case medio e l'indice ambientale (con un tetto dichiarato) muovendo gli slider macro, così da capire l'effetto collettivo.
46. Come utente, voglio vedere la mappa della provincia cambiare colore mentre muovo gli slider macro, così da rendere visibile lo scenario.
47. Come presentatore, voglio che i coefficienti siano dichiarati come "modello semplificato e indicativo", così da essere trasparente con la giuria.

### Pitch
48. Come team, voglio slide di roadmap che descrivano social (follow, richieste, amicizie, consigli) e gamification (missioni giornaliere/settimanali, badge), così da comunicare la visione completa senza implementarla.

## Implementation Decisions

### Architettura
- **Web app single-page**, interfaccia solo in italiano, React + Vite + React Three Fiber (Three.js).
- **Nessun backend né autenticazione** (scelta valida solo per la demo): utente demo predefinito.
- **Dati statici precalcolati**: uno script di preparazione, eseguito una sola volta, produce un unico dataset JSON che l'app carica all'avvio. Contiene i comuni (geometria semplificata, codice ISTAT, nome, confinanti), l'aria normalizzata, le infrastrutture OSM e le case seed.
- **Persistenza**: casa dell'utente in `localStorage` (con fallback in memoria). Lo scenario **non** è persistito.
- **Demo eseguita in locale** sul portatile del presentatore; deploy (es. Vercel) solo se avanza tempo.

### Moduli
1. **Preparazione dati** (script offline):
   - confini comunali ISTAT della provincia di Vicenza, semplificati;
   - join con il CSV aria tramite codice ISTAT o nome;
   - interpolazione IDW;
   - estrazione OSM;
   - generazione delle case seed;
   - calcolo dell'adiacenza tra comuni.
2. **Motore indici** (modulo puro, senza UI): è il cuore testabile, vedi l'interfaccia sotto.
3. **Mappa / diorama** (componenti 3D): vista provincia ed estrusione dei comuni colorati per fascia; vista comune con cielo, alberi instanziati, fauna animata e modellini delle infrastrutture. Riceve gli indici già calcolati dal motore.
4. **Casa**: form dotazioni, dashboard punteggio, interruttore privacy, nickname, classifica comunale.
5. **Simulazione**: interruttore Realtà/Scenario, palette, posizionamento e rimozione, reset, simulatore casa, slider macro. Produce un oggetto "scenario" che passa al motore.

### Interfaccia del motore indici (unico seam)
Funzioni pure, deterministiche:
- `punteggioCasa(dotazioni) → { punteggio 0–100, classe A–G, mancanti: [{ dotazione, puntiGuadagnabili }] }`
- `statoTerritorio(datiBase, scenario) → per ogni comune { aria, infrastrutture, scenario, totale, fascia, indiceCaseMedio }`
  - `scenario` = `{ aggiunte: [{comune, tipo}], rimozioni: [idInfrastruttura], macro: { ambito: provincia|comune, pctFV, pctSenzaGas, pctIsolamentoBuono } }`
- `classifica(case, comune) → righe` già filtrate secondo le regole privacy.

### Dati aria (assunzioni Q31–Q33, da verificare sul CSV)
- Inquinante: **PM10**; composito PM10+NO₂ solo se entrambi sono disponibili per tutte le centraline.
- Periodo: **media dell'ultimo anno** disponibile nel CSV.
- Da centraline a comuni: **IDW** sul centroide del comune, calcolata in preparazione. Il pannello mostra "stima da N centraline".
- Normalizzazione: `aria_norm` = 100 se PM10 ≤ 15 µg/m³ (linea guida OMS), 0 se ≥ 50 µg/m³, lineare in mezzo.

### Formula dell'indice ambientale del comune
- `totale = clamp(aria_norm + contributoInfrastrutture + contributoScenario, 0, 100)`.
- **Delta per infrastruttura**, identici per esistenti e aggiunte:

  | Infrastruttura | Aggiunta | Rimozione |
  |---|---|---|
  | Parco | +5 | −5 |
  | Pista ciclabile | +3 | −3 |
  | Colonnine | +2 | −2 |
  | Industria | −12 | +12 |
  | Strada principale | −3 | +3 |

  Rimuovere un elemento annulla il suo delta.
- **Infrastrutture esistenti (OSM)**: al massimo 3 oggetti per tipo per comune (i più grandi o importanti). La somma dei loro delta ha un **tetto di ±20** per comune.
- **Modifiche in build mode**: delta pieno sul comune, **metà delta ai comuni confinanti** (spillover solo per lo scenario, non per l'esistente).
- **Macro-scenari**: gli slider ricalcolano le dotazioni delle case seed (nell'ambito scelto) e quindi l'indice case medio. Applicano inoltre all'indice ambientale un delta proporzionale con **tetto +10**.
- **Fasce** (discrete, 5 preset visivi):

  | Fascia | Indice | Cielo | Alberi | Fauna |
  |---|---|---|---|---|
  | Ottima | 80–100 | azzurro, nuvole bianche | 100% | abbondante (uccelli e piccoli mammiferi) |
  | Buona | 60–79 | – | 75% | – |
  | Media | 40–59 | velato | 50% | pochi uccelli |
  | Scarsa | 20–39 | grigio | 25% | rara |
  | Pessima | 0–19 | foschia scura | rami spogli | assente |

### Punteggio casa (checklist pesata, max 100)

| Dotazione | Punti |
|---|---|
| Fotovoltaico | +20 |
| Solare termico | +10 |
| Pompa di calore | +20 |
| Caldaia a condensazione | +8 |
| Caldaia tradizionale / gasolio | 0 |
| Piano a induzione | +8 |
| Piano a gas | 0 |
| Isolamento: buono | +15 |
| Isolamento: medio | +7 |
| Isolamento: scarso | 0 |
| Infissi doppio/triplo vetro | +9 |
| Colonnina EV | +10 |

- Classe A–G su fasce uniformi del punteggio (soglie esatte da fissare all'implementazione).
- I pesi possono essere ritoccati dal responsabile fino alle 16:30, poi sono congelati.

### Privacy e classifica
- Il comune della casa non viene mai esposto individualmente: compare solo nell'aggregato di zona.
- **Profilo pubblico** → in classifica con nickname, punteggio e dotazioni.
- **Profilo privato** → in classifica anonima con le sole dotazioni, senza nome né punteggio.
- Le case seed sono **sintetiche**, distribuite sui comuni con proporzioni plausibili, ed etichettate "dati dimostrativi" ovunque appaiano. Includono un mix di profili pubblici e privati.

### Infrastrutture OSM
- Tipi: parchi (leisure=park), aree industriali (landuse=industrial), strade principali (statali/provinciali), piste ciclabili (highway=cycleway), colonnine (amenity=charging_station).
- Estratte una volta sola e salvate nel dataset statico.
- **Ripiego**: se l'estrazione fallisce entro 30 minuti, si passa a un posizionamento procedurale plausibile per comune.

### Ruoli del team
| Ruolo | Persone |
|---|---|
| Dati (CSV, verifica numeri) | 1 |
| Slide e pitch | 2 |
| Pesi della checklist casa | 1 |
| Tester | 1 |

## Testing Decisions

- **Unico seam di test: il motore indici.** È puro e deterministico. I test usano un piccolo dataset di 3–4 comuni fittizi con adiacenze note e verificano solo gli output pubblici, senza testare la UI 3D.
- Un buon test verifica il comportamento esterno ("aggiungere un'industria al comune A abbassa A di 12 e i confinanti di 6"), non i dettagli interni.
- Casi da coprire:
  - punteggio casa per combinazioni note, classe e lista "mancanti";
  - clamp 0–100;
  - tetto ±20 sulle infrastrutture esistenti;
  - limite di 3 oggetti per tipo;
  - delta di aggiunta e rimozione;
  - spillover a metà solo per lo scenario;
  - tetto +10 dei macro-scenari;
  - assegnazione delle fasce ai bordi (19/20, 39/40, …);
  - filtro privacy della classifica (il privato non espone nome né punteggio);
  - normalizzazione PM10 (15 → 100, 50 → 0, valori intermedi).
- Strumento: Vitest. Non ci sono precedenti nel repo, che è vuoto.
- La mappa 3D e i form si verificano a mano dal tester, con uno script della demo.

## Out of Scope

- **Social** (follow, richieste di follow, amicizie, consigli tra amici, scheda amico): solo slide di roadmap.
- **Gamification** (missioni giornaliere/settimanali, punti temporanei, badge): solo slide di roadmap.
- Backend, database, registrazione e login reali, multi-utente.
- Quartieri: si lavora solo per comune.
- App mobile nativa (la web app è responsive al meglio possibile).
- Salvataggio o condivisione degli scenari.
- Modelli fisici di dispersione degli inquinanti o stime kWh/CO₂: si usano delta fissi dichiarati come indicativi.
- Aggiornamento in tempo reale dei dati aria: snapshot statico.

## Further Notes

- **Da verificare all'arrivo del CSV**:
  - colonne e inquinanti presenti;
  - codici dei comuni (ISTAT o nome) e copertura;
  - coordinate delle centraline (necessarie per l'IDW);
  - periodo disponibile;
  - eventuali dati sulle abitazioni. Se presenti, valutare se sostituire o calibrare le case seed (Q20).
- Messaggio chiave del pitch: "partiamo dal dato reale, la sandbox mostra cosa cambierebbe". La scomposizione nel pannello comune è l'argomento di credibilità davanti alla giuria.
- Script consigliato per la demo:
  1. vista provincia;
  2. zoom su un comune industriale (fascia bassa);
  3. modalità Scenario: rimuovere un'industria e aggiungere un parco, così cielo e alberi migliorano e i confinanti si schiariscono;
  4. casa: punteggio e "cosa ti manca";
  5. simulatore casa con pompa di calore + FV;
  6. slider macro "100% FV" sulla provincia;
  7. slide di roadmap.
