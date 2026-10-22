# Dev 2 — infrastrutture OSM e case seed

Script offline per il contratto A di `TASKS.md`. Legge `meta` e `comuni`
prodotti da Dev 1 e scrive un unico JSON compatto con `infrastrutture` e
`caseSeed`. Preserva i dati di Dev 1; sostituisce eventuali vecchie infrastrutture
e case seed. Non modifica lo scaffold, lo store o il motore indici.

Richiede Node >= 22.12 e npm. Dalla radice del repository:

```powershell
npm.cmd ci --prefix scripts/dev2
npm.cmd test --prefix scripts/dev2
npm.cmd run typecheck --prefix scripts/dev2

# Esempio completamente fittizio, riproducibile e senza rete:
npm.cmd run dataset --prefix scripts/dev2 -- --base fixtures/dati-dev1.mock.json --out examples/dataset.mock.json --mode procedurale

# Dati reali: adattare i percorsi e confermare il CRS con Dev 1.
npm.cmd run dataset --prefix scripts/dev2 -- --base ../../data/dati-dev1.json --out ../../public/dataset.json --mode auto --crs EPSG:32632
```

I percorsi passati tramite `npm --prefix` sono relativi a `scripts/dev2`.
In PowerShell si usa `npm.cmd` per evitare restrizioni su `npm.ps1`.
Il dataset reale richiede i poligoni Dev 1, ancora assenti alla realizzazione
di questa task. L'esempio consegnato contiene **5 comuni fittizi**, 25
infrastrutture procedurali e 60 case; non rappresenta il territorio reale.

## Geometria e selezione OSM

Le coordinate Dev 1 devono essere in metri nello stesso sistema passato a
`--crs`: EPSG:32632 (WGS84 / UTM 32N), EPSG:25832 (ETRS89 / UTM 32N), o
EPSG:3857. Nessuna traslazione/scalatura locale: in quel caso Dev 1 deve
fornire prima le coordinate nella proiezione originale. Le coordinate OSM
WGS84 sono convertite con proj4 prima del punto nel poligono.

`geometria` segue il contratto semplificato: ogni anello rappresenta un
poligono esterno, anche nei comuni con più parti. I buchi non sono
rappresentabili dal contratto A: Dev 1 deve consegnare geometrie senza buchi.
Un punto sul confine appartiene al primo comune nell'ordine del dataset,
così un oggetto non viene duplicato tra comuni.

La query Overpass usa il bounding box dei comuni e scarica la geometria di:

- `leisure=park`, `landuse=industrial`;
- `highway=cycleway`;
- `amenity=charging_station`;
- strade trunk/primary/secondary (inclusi link) o con riferimento SS/SP.

Gli oggetti vengono assegnati usando il centro del bounding box della
geometria (o le coordinate del nodo/centro OSM). Oggetti fuori dai comuni
sono esclusi. Ogni ID OSM viene usato una sola volta. Si mantengono massimo
3 oggetti per tipo e comune: area per parchi/industrie, lunghezza per
strade/ciclabili, capacità dichiarata per colonnine (default 1). Per relazioni
si considerano i membri esterni; le superfici sono una stima semplificata.

Fonte tecnica: [Overpass: geometrie e output](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example).
I dati OSM richiedono attribuzione **© OpenStreetMap contributors**, licenza
[ODbL](https://www.openstreetmap.org/copyright), da mostrare nell'app quando
si usa un dataset estratto da OSM.

## Fallback e dati dimostrativi

Un solo tentativo Overpass: timeout server 40 secondi, timeout client 45
secondi. Errori HTTP, rete, JSON o risposte parziali attivano subito il
fallback, entro il budget di 30 minuti della spec. Per i comuni senza
oggetti selezionati si generano 5 elementi procedurali, uno per tipo,
con ID `procedurale:...` e posizioni riproducibili contenute nei poligoni.
Non si aggiungono oggetti inventati ai comuni con OSM disponibile.
`--mode procedurale` forza il fallback senza rete e non richiede CRS.

Si generano 12 case per comune: 8 pubbliche con nickname "Casa demo N" e 4
private; dotazioni distribuite con proporzioni dimostrative fisse (25% FV,
25% pompe di calore, 25% induzione, 25% isolamento buono, circa 17% solare
termico e colonnina). Non sono statistiche osservate. I dati sono
deterministici; riordinare i comuni non cambia le case di ciascun comune.

Il contratto JSON rimane invariato. Un file affiancato
`dataset.json.report.json` riporta `caseSeed: "dati dimostrativi"`, la fonte
infrastrutture (`osm`, `procedurale`, `mista`), i comuni procedurali e
l'eventuale motivo del fallback. **La UI deve mostrare "dati dimostrativi"
ovunque presenta case seed**, come richiesto dalla spec; usare gli ID
`procedurale:` per distinguere le infrastrutture simulate da quelle reali.

Input senza comuni, geometrie degeneri, ISTAT duplicati o output >= 5 MB
producono errore; non vengono troncati silenziosamente.

## Verifica TDD

Confine pubblico: preparazione dataset e comando di generazione. Ogni
comportamento è stato aggiunto dopo un test fallente ed eseguito in verde
prima del ciclo successivo: merge/case, assegnazione/selezione OSM,
tipi/geometrie OSM, poligoni concavi, fallback parziale, validazione/limite
dimensione, estrazione HTTP, fallback su errori, scrittura CLI, CRS.
I test usano dati fittizi e sostituiscono solo il confine HTTP/tempo; non
contattano Overpass e non verificano internals del motore o la UI.
