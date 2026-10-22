# Cartografia reale 3D

La vista iniziale usa MapLibre GL JS e la cartografia vettoriale OpenFreeMap / OpenStreetMap.
Strade, corsi d'acqua, aree verdi, sagome degli edifici e posizioni dei centri abitati derivano
dalla cartografia online. La vista provinciale dà priorità a undici centri di riferimento:
Vicenza, Bassano, Schio, Thiene, Arzignano, Valdagno, Montecchio Maggiore, Lonigo, Marostica,
Asiago e Noventa Vicentina. Le collisioni tra etichette sono gestite dal motore cartografico;
non tutti i nomi sono necessariamente visibili contemporaneamente su schermi piccoli.

I confini comunali ISTAT già presenti nel dataset vengono trasformati da EPSG:32632 a WGS84
con proj4. Non si spostano comuni o edifici per migliorare la composizione visiva.
La selezione del comune apre il centro abitato OSM, quando caricato; altrimenti usa il centroide.

## Fonti e limiti

- [OpenFreeMap](https://openfreemap.org/quick_start/): stile Liberty, tile vettoriali,
  glyph e sprite, senza chiave API. I dati OSM seguono la licenza ODbL; le attribuzioni
  OpenFreeMap / OpenMapTiles / OpenStreetMap rimangono visibili sulla mappa.
- [OpenStreetMap](https://www.openstreetmap.org/copyright): edifici e rete stradale;
  si usano le proprietà OpenMapTiles `render_height` e `render_min_height`.
  Dove manca l'altezza renderizzata si usa una convenzione grafica di 8 metri.
  Le altezze presenti nelle tile possono essere stime del produttore: non sono un rilievo certificato.
- [MapLibre: edifici 3D](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/):
  rendering delle impronte con `fill-extrusion`; niente modelli fotografici o facciate ricostruite.
- [Mapzen Terrain Tiles / AWS Open Data](https://registry.opendata.aws/terrain-tiles/):
  rilievo reale in formato Terrarium, visualizzato come ombreggiatura topografica. La superficie
  non viene deformata: si evita il costo della mesh del terreno, mantenendo gli edifici 3D.
  Attribuzione europea EU-DEM / Copernicus
  e SRTM / USGS, con [dettagli del produttore](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

La mappa richiede Internet per tile e font. Se il caricamento iniziale fallisce o WebGL
non è disponibile compare un accesso esplicito al diorama offline. Non si scarica in blocco
la provincia: il browser carica le tile necessarie alla vista, con livelli di dettaglio progressivi.

## Interazioni

- Click su un comune: selezione e volo verso il centro abitato, zoom con edifici 3D.
- `2D / 3D`: vista dall'alto o camera inclinata; tasto destro e trascinamento per ruotare.
- Indice ambientale: colori sempre attivi, calcolati dal motore indici.
- `Alberi e fauna`: attiva o sospende gli elementi animati integrati nella cartografia.
- `Crea uno scenario`: strumenti di aggiunta e rimozione direttamente nella mappa reale.
  Il diorama separato è disponibile come ripiego offline.

La cartografia è una rappresentazione stilizzata dei dati disponibili, non una copia di Snap Map.
Non modifica le formule del motore o le misure PM10. Le due librerie cartografiche sono caricate
su richiesta, per evitare di scaricare subito anche il diorama.

## Verifiche

`npm.cmd run build` e `npm.cmd test`. I test di proiezione usano un punto di controllo Vicenza
calcolato indipendentemente con PROJ, verificano anelli chiusi e multipoligoni.
Controllo reale Chrome headless: nomi dei centri renderizzati, zoom su Vicenza, edifici 3D visibili
e nessun errore JavaScript. Le anteprime locali sono in `.tmp/` (escluse da Git).

## Integrazione ambientale e isolamento provinciale

La mappa reale ora mostra sempre i colori dell'indice ambientale: lo stesso `StatoComune.fascia`
che guidava il diorama controlla colori, densità degli alberi, uccelli, piccoli animali e nuvole.
Il colore deriva da aria + infrastrutture + scenario, come definito nella SPEC; non rappresenta
una nuova misura di PM10. Gli animali sono una rappresentazione illustrativa dell'indice,
non osservazioni di fauna reale. Le animazioni rispettano `prefers-reduced-motion` e si
fermano quando la sezione mappa non è attiva.

`EcosistemaLayer` usa istanze Three.js nello stesso contesto WebGL di MapLibre, con la stessa
camera e il buffer di profondità. Non sovrappone una seconda scena scollegata dal territorio.
Nello zoom comunale si privilegiano le aree verdi OSM caricate, più vicine al centro della vista.
Numero e fogliame seguono i preset esistenti; peggiorando l'indice la fauna diminuisce fino a zero.
Alberi e animali aggiunti sono decorazioni del modello ambientale, non un inventario OSM.

La provincia è delimitata da `src/data/provincia.geojson.json`, ottenuto dissolvendo i confini
ISTAT originali (COD_PROV=24, fotografia 2024) e semplificando il bordo a 30 metri.
Rigenerazione: `.venv/Scripts/python.exe scripts/prepare_map_boundary.py`.
Il file dissolve prima della semplificazione, evitando fessure sui bordi interni comunali.

Gli edifici originali restano 2D nella cartografia di base. Solo quelli ritagliati con
`polygon-clipping` sul confine provinciale vengono passati alla sorgente degli edifici 3D.
Si ritagliano anche edifici che attraversano il bordo: non basta filtrarne il centroide.
L'espressione MapLibre `within` non è usata sugli edifici, perché supporta punti e linee.
Una maschera CSS proiettata dal confine applica sfocatura e desaturazione solo all'esterno;
si aggiorna durante trascinamento, zoom, rotazione e resize. L'interno rimane nitido.

La modalità Scenario mantiene la mappa reale. La barra strumenti permette aggiunte al punto
cliccato, rimozioni dei marcatori di infrastruttura e reset; indici, colori e fauna si aggiornano
con lo stesso motore già testato. Il diorama separato rimane un ripiego offline esplicito.
I cerchi delle infrastrutture rappresentano gli oggetti del dataset e delle aggiunte, non tutti
gli edifici OSM; rimuoverli modifica il modello di scenario, non la cartografia geografica.

Verifica Chrome: colori attivi all'avvio; maschera esterna con blur; alberi e uccelli in vista
provinciale; animali e volumi nello zoom; aggiunta di tre industrie a Vicenza porta l'indice
nella fascia pessima, con rosso e zero uccelli, mantenendo montata la mappa reale.
Test automatici: confine con punti di controllo interni/esterni, edifici fuori e a cavallo del
bordo, proprietà delle tile normalizzate per i worker, fauna per fascia e proiezione maschera.
