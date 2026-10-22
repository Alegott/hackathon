# Dev 1: dati aria e comuni

## Consegne

- `dataset.mock.json`: 5 comuni **interamente fittizi**, per integrazione del team.
- `data/comuni.vicenza.json`: 114 comuni reali ISTAT, centroidi, geometrie semplificate e confinanti.
- `scripts/build_dataset.py`: genera `meta` + `comuni` con PM10 medio interpolato e `ariaNorm`.

Il CSV aria reale e il contratto A non erano presenti nel repository all'avvio.
Lo schema è quindi dichiarato `provisional-1`: richiede allineamento al contratto A
prima dell'integrazione definitiva. `dataset.json` reale richiede misure e coordinate reali;
i CSV in `data/examples/` sono sintetici e servono solo a mostrare il formato.

## Esecuzione (PowerShell, Python 3.12+)

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe scripts/generate_mock.py
.venv/Scripts/python.exe scripts/download_boundaries.py
.venv/Scripts/python.exe scripts/prepare_boundaries.py
```

Generazione con CSV reali (adattare i nomi delle colonne):

```powershell
.venv/Scripts/python.exe scripts/build_dataset.py --measurements data/aria.csv --stations data/centraline.csv --station-col centralina --value-col valore --pollutant-col inquinante
```

Esecuzione dimostrativa, senza confondere i risultati con i dati reali:

```powershell
.venv/Scripts/python.exe scripts/build_dataset.py --measurements data/examples/aria.csv --stations data/examples/centraline.csv --value-col valore --pollutant-col inquinante --output data/processed/dataset.example.json
```

`--help` elenca gli argomenti. Il CSV coordinate può essere lo stesso delle misure;
`--coordinate-station-col` permette identificativi con intestazioni diverse nei due file.
Separatore CSV rilevato fra virgola, punto e virgola e tab; decimali con punto o virgola.
Input UTF-8, anche con BOM. Per misure in formato lungo usare `--pollutant-col`;
senza questa opzione la colonna scelta deve contenere solo PM10 in µg/m³.

## Elaborazione

1. Media aritmetica delle misure PM10 valide per identificativo centralina, su tutto il CSV.
   Valori vuoti, `NA`, `N/A`, `ND`, `N.D.`, `NULL`, `-` esclusi e conteggiati in `meta`.
   Valori negativi, non numerici o non finiti interrompono la generazione: i codici
   specifici della fonte e i flag di validazione vanno concordati dopo l'ispezione del CSV reale.
   Non si interpretano automaticamente valori censurati (`<5`) o unità diverse.
2. Confini ISTAT generalizzati al **1 gennaio 2024**, filtro `COD_PROV = 24`,
   codici comunali `PRO_COM` come stringhe di 6 cifre. Conteggio obbligatorio: 114.
   Si usa questa fotografia storica per soddisfare il perimetro richiesto, non i confini correnti.
3. Proiezione **EPSG:32632 (WGS84 / UTM 32N)**, unità metri, ordine `[x, y]`.
   Centroidi geometrici sui poligoni originali proiettati; possono cadere fuori da poligoni concavi.
4. Adiacenza se il confine condiviso ha lunghezza positiva; il solo contatto in un punto
   non conta. Relazioni simmetriche, calcolate prima della semplificazione.
5. Semplificazione di ogni comune con tolleranza 50 m e conservazione della validità
   del singolo poligono. I lati condivisi semplificati indipendentemente possono divergere:
   per analisi topologiche usare le adiacenze memorizzate, non le geometrie semplificate.
6. Centraline da WGS84 lon/lat (modificabile con `--station-crs`) a EPSG:32632.
   IDW con tutte le centraline disponibili, pesi `1 / distanza²`, potenza configurabile.
   Distanza zero: si usa il valore della centralina; centraline coincidenti: media dei valori.
   Centraline misurate senza coordinate causano errore, evitando esclusioni silenziose.
7. `ariaNorm = clamp((50 - PM10) / 35 * 100, 0, 100)`.
   PM10 15 → 100; 32,5 → 50; 50 → 0. PM10 e indice arrotondati a 6 decimali.

Le stime IDW sono interpolazioni delle medie di centralina, non misure comunali.
La copertura temporale del CSV e l'omogeneità delle osservazioni restano da verificare sul file reale.

## Schema provvisorio

`meta`: versione, flag mock, timestamp UTC, CRS, unità, fonti, conteggi delle misure,
medie per centralina, provenienza ISTAT con SHA-256, metodo IDW e normalizzazione.

`comuni[]`: `id`, `nome`, `centroide: [x,y]`, `geometry: {type, coordinates}`,
`confinanti: id[]`, `pm10`, `ariaNorm`. Nel file dei soli confini gli ultimi due campi
sono assenti. Le geometrie sono strutture GeoJSON in CRS metrico dichiarato da `meta`:
per una mappa che richiede GeoJSON RFC 7946 occorre riproiettarle in EPSG:4326.

## Verifica

```powershell
.venv/Scripts/python.exe -m mypy --ignore-missing-imports --check-untyped-defs scripts
.venv/Scripts/python.exe -m compileall -q scripts
```

I test automatici alle interfacce PM10/IDW e generazione JSON sono in attesa della
conferma delle interfacce richiesta dalla skill TDD. Il repository iniziale non aveva suite di test.

## Fonti

- ISTAT, [confini amministrativi](https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/).
- [Archivio ufficiale 2024 generalizzato](https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2024/Limiti01012024_g.zip).
- ISTAT, [variazioni amministrative](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/).

L'archivio originale e gli output dimostrativi sono esclusi da Git; il file comunale
elaborato è incluso, così il team può usarlo senza scaricare nuovamente i confini.
