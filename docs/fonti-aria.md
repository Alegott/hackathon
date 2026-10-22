# Fonti aria — Dev 1

Verifica del 22 ottobre 2026. Il CSV reale iniziale non era presente: `data/examples/` contiene esempi sintetici, ora corredati di date dimostrative. I dati reali sono stati recuperati da ARPAV; nessun valore giornaliero è stato inventato.

## PM10 reale

[ARPAV: PM10 open data](https://www.arpa.veneto.it/dati-ambientali/open-data/atmosfera/pm10) pubblica medie annuali per stazione, comune e provincia dal 2002 al 2025, con licenza CC BY 4.0 e aggiornamento del dato 11 agosto 2026. Il [CSV originale](https://www.arpa.veneto.it/dati-ambientali/open-data/file-e-allegati/qualita-aria/polveri-pm10_trend.csv/@@download/file) è conservato in `data/raw/arpav-pm10.csv`, con hash SHA-256 nella provenance `data/aria.source.json`.

È stato selezionato il 2025, ultimo anno solare completo pubblicato. Per Vicenza contiene cinque medie valide: Schio IT0663A 21, Bassano IT1065A 20, VI Quartiere Italia IT1177A 27, VI San Felice IT1838A 28, VI Ferrovieri IT1905A 28 µg/m³. Le colonne sorgente comprendono provincia, comune, codice EOI, nome e tipologia stazione, numero di superamenti e media annuale per anno. L'inquinante di questo prodotto è esclusivamente PM10; le coordinate provengono dal registro seguente.

`data/aria.csv` usa le colonne `centralina,data,inquinante,valore,risoluzione`: `data=2025-12-31` identifica la fine del periodo di riferimento, **non una misura giornaliera**; `risoluzione=annual_mean` identifica la media ufficiale già aggregata. L'intervallo effettivo è 2025-01-01 / 2025-12-31. Non è possibile ricostruire numerosità giornaliera o copertura dai soli aggregati.

[ARPAV: dati parametro](https://www.arpa.veneto.it/dati-ambientali/dati-storici/aria/dati-parametro) rende disponibili le serie storiche dal 2010 tramite richiesta con invio email, per intervalli fino a dodici mesi; PM10 è una media giornaliera. Non è stata inviata alcuna richiesta a terzi. L'uso delle medie annuali ufficiali soddisfa il valore medio annuo richiesto evitando una ricostruzione artificiale della serie.

## Coordinate

Il [catalogo ufficiale ARPAV](https://opendata.arpa.veneto.it/dataset/pm10) collega la rete di monitoraggio al [geoportale ARPAV](https://gaia.arpa.veneto.it/maps/268/view). La [scheda RNDT del registro](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=arpa_ve%3Ac0201093_StazAriaLoc) identifica il layer `geonode:v_rete_aria`.

Il download usa il [servizio WFS ARPAV in EPSG:4326](https://gaia.arpa.veneto.it/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=geonode:v_rete_aria&outputFormat=application/json&srsName=EPSG:4326). L'originale è `data/raw/arpav-stations.json`; `data/centraline.csv` contiene i cinque punti uniti tramite codice EOI. Sono verificati tipo geometrico Point, provincia VI e intervalli plausibili di longitudine/latitudine. Il registro è quello attuale: eventuali spostamenti storici delle stazioni non sono stati verificati indipendentemente.

## Riproduzione

Eseguire `.venv/Scripts/python.exe scripts/download_air.py` per scaricare nuovamente entrambe le fonti e generare CSV e provenance; aggiungere `--offline` per rigenerare dagli originali conservati. La selezione dell'anno esclude l'anno corrente incompleto. I conteggi sono stazioni utilizzate (cinque), non misure giornaliere.

Le assunzioni Q31–Q33 non sono consultabili perché non è presente una SPEC con quelle domande nel repository; le scelte esplicite da condividere sono anno solare completo, PM10 esclusivo e medie ARPAV già aggregate.
