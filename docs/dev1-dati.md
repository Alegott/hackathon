# Dev 1 — dati aria e comuni

## Consegna completata

- `dataset.mock.json`: cinque comuni interamente fittizi, compatibili con il contratto A.
- `dataset.json`: parte **meta + comuni** del contratto A, 114 comuni con PM10 e ariaNorm reali interpolati.
- `data/comuni.vicenza.json`: confini reali, centroidi e adiacenze per Dev 2.
- `data/aria.csv`, `data/centraline.csv`, `data/aria.source.json`: input reali ARPAV e provenienza.
- `scripts/validate_dataset.py`: controlli ripetibili sulla consegna.

Le sezioni `infrastrutture` e `caseSeed` restano di competenza Dev 2 e devono essere unite a questo output.
Gli orari originali di consegna non sono attestabili dai file: questa nota registra lo stato attuale.

## Verifica Q31–Q33 e scelta della fonte

Il CSV originale dell'hackathon non è presente. `data/examples/` contiene soltanto esempi sintetici.
Per completare la consegna è stata scaricata una fonte primaria alternativa: **medie annuali ufficiali
ARPAV**, ultimo anno completo pubblicato **2025**, cinque centraline della provincia di Vicenza.

| Codice EOI | Centralina | PM10 medio 2025 µg/m³ |
|---|---|---:|
| IT0663A | Schio | 21 |
| IT1065A | Bassano del Grappa | 20 |
| IT1177A | VI - Quartiere Italia | 27 |
| IT1838A | VI - S. Felice | 28 |
| IT1905A | VI - Ferrovieri | 28 |

Le coordinate WGS84 provengono dall'anagrafica ufficiale ARPAV, unite per codice EOI.
Il CSV normalizzato contiene `centralina,data,inquinante,valore,risoluzione`.
`data=2025-12-31` indica la fine del periodo della **media annuale**, non una misura giornaliera.
Non si ricostruiscono serie giornaliere. Il file scelto contiene PM10; la disponibilità uniforme
di NO2 nel CSV originale non è verificabile, quindi non si introduce un indice composito.
Fonti, limiti e collegamenti ufficiali sono in [fonti-aria.md](fonti-aria.md).

## Riproduzione

Dalla radice, con le dipendenze di `requirements-dev.txt` installate:

```powershell
.venv/Scripts/python.exe scripts/download_air.py
.venv/Scripts/python.exe scripts/download_boundaries.py
.venv/Scripts/python.exe scripts/prepare_boundaries.py
.venv/Scripts/python.exe scripts/generate_mock.py
.venv/Scripts/python.exe scripts/build_dataset.py --measurements data/aria.csv --stations data/centraline.csv --value-col valore --pollutant-col inquinante
.venv/Scripts/python.exe scripts/validate_dataset.py dataset.json
.venv/Scripts/python.exe scripts/validate_dataset.py dataset.mock.json --expected 5
.venv/Scripts/python.exe -m mypy --ignore-missing-imports --check-untyped-defs scripts
.venv/Scripts/python.exe -m compileall -q scripts
```

Per riusare gli scaricamenti ARPAV senza rete: `scripts/download_air.py --offline`.
Lo script confini usa l'archivio ISTAT al **1 gennaio 2024**, che fornisce i 114 comuni richiesti;
questa è una fotografia storica dichiarata e non un'affermazione sul numero attuale dei comuni.

## Algoritmo e schema

- Selezione dell'ultimo anno solare presente nelle righe PM10; le altre annualità sono escluse e conteggiate.
- Media aritmetica delle osservazioni valide per centralina. Per input `annual_mean` è ammessa una sola riga
  per centralina nell'anno selezionato: si usa direttamente la media pubblicata da ARPAV.
- Date obbligatorie, formato predefinito ISO; opzioni `--date-col`, `--date-format` per altre colonne.
  Le righe mancanti sono conteggiate; valori negativi o non finiti causano errore.
- Tutte le centraline misurate devono avere coordinate. Non sono escluse silenziosamente.
- Poligoni e centraline proiettati in **EPSG:32632**, coordinate `[x,y]` in metri.
- Centroidi e adiacenze calcolati sui poligoni originali, prima della semplificazione a 50 metri.
  Adiacenza = confine condiviso di lunghezza positiva; il contatto in un punto non conta.
- IDW con tutte le cinque centraline, potenza 2. Se un centroide coincide con una centralina,
  si usano soltanto i valori coincidenti; `nCentraline` riflette le centraline effettivamente usate.
- `ariaNorm = clamp((50 - pm10) / 35 * 100, 0, 100)`; arrotondamento a sei decimali.
- Campi contratto A: `istat`, `nome`, `geometria`, `centroide`, `confinanti`, `ariaNorm`, `pm10`, `nCentraline`.
  Alias aggiuntivi `id` e `geometry` conservano la compatibilità con gli output precedenti.
  `geometria` contiene gli anelli esterni dei poligoni; `geometry` conserva anche i fori.
- `meta` include `periodoAria`, `inquinante`, `generatoIl`, risoluzione temporale, medie per centralina,
  conteggi, CRS e provenienza con URL e SHA-256 delle fonti originali.
- La semplificazione indipendente può introdurre piccole divergenze tra lati condivisi:
  per lo spillover usare `confinanti`. I centroidi geometrici possono cadere fuori dai poligoni concavi.

## Esito dei controlli

Dataset reale: **114 comuni**, **zero senza confinanti**, grafo connesso e adiacenze simmetriche;
ariaNorm **63,860078–85,115913**, cinque centraline usate per ciascun comune.
Sono stati controllati validità geometrica, codici univoci, coordinate finite, normalizzazione e contratto.
Verificati inoltre selezione dell'ultimo anno PM10, esclusione dei valori mancanti, rifiuto di CSV senza
periodo, IDW a distanza zero ed equidistante, soglie 15/32,5/50. Mypy e compilazione Python passano.

Le stime sono interpolazioni delle medie di stazione: non sono misure comunali né un modello fisico
di dispersione. Il range deriva dai valori ufficiali e non è stato alterato per creare contrasti visivi.
