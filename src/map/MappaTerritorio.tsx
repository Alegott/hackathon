import { convertFilter } from "@maplibre/maplibre-gl-style-spec"
import type { DragEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Map, NavigationControl, ScaleControl, Popup, setWorkerUrl, type GeoJSONSource, type ExpressionSpecification } from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import "maplibre-gl/dist/maplibre-gl.css"
import { store, storeTempo, useApp, useIndici, useTempo } from "../app/useApp"
import { dataset } from "../data/dataset"
import { aCoordinateGeografiche, aCoordinateMetriche, CENTRI_PRINCIPALI, coloreIndice, confiniGeografici, estensioneGeografica } from "./territorio"
import { confineProvincia, esternoProvincia, preparaHabitat, ritagliaEdifici } from "./ecosistema"
import { EcosistemaLayer } from "./EcosistemaLayer"
import { creaVincoliHabitat } from "./vincoliHabitat"
import { assegnaComuni, atmosferaDaStato, coloriEdifici, creaTrovaComune, metriPerPixel, statoMedio } from "./vitaTerritorio"
import { azioneDaClic } from "../diorama/build"
import { ScenarioLayer, type BozzaTracciato, type OggettoScenario } from "./ScenarioLayer"
import { areaLibera, aPiano, edificiDaGeometrie, INGOMBRO_OGGETTO, percorsoLibero, type Edificio } from "./ostacoli"
import { SchedaImpatto } from "./SchedaImpatto"
import { INDUSTRIE, STRADE } from "../engine/costanti"
import { èTracciabile, semplifica, pulisciTracciato, terminaTracciato, TIPI_TRASCINABILI } from "./tracciato"
import type { Aggiunta, TipoIndustria, TipoInfra } from "../types"
import { descriviLivelli, livelliZona } from "../audio/paesaggio"
import { PaesaggioSonoro } from "../audio/PaesaggioSonoro"

setWorkerUrl(workerUrl)

export function MappaTerritorio({ apriDiorama }: { apriDiorama(): void }) {
  const contenitore = useRef<HTMLDivElement>(null)
  const mappa = useRef<Map | null>(null)
  const ecosistema = useRef<EcosistemaLayer | null>(null)
  const aggiornaHabitat = useRef<() => void>(() => {})
  const scenarioLayer = useRef<ScenarioLayer | null>(null)
  const appenaDisegnato = useRef(false)
  const [avviso, setAvviso] = useState<string | null>(null)
  const timerAvviso = useRef(0)
  const mostraAvviso = (testo: string) => {
    setAvviso(testo)
    window.clearTimeout(timerAvviso.current)
    timerAvviso.current = window.setTimeout(() => setAvviso(null), 2600)
  }
  const [scheda, setScheda] = useState<{ id: string; x: number; y: number } | null>(null)
  const mappaApi = useRef<{
    puntoOk(tipo: string, punto: [number, number]): boolean
    puoTracciare(punto: [number, number], ultimo?: [number, number]): boolean
  } | null>(null)
  const cacheEdifici = useRef<{ chiave: string; edifici: Edificio[]; origine: { lon: number; lat: number } } | null>(null)
  const aggiornaScenario = useRef<() => void>(() => {})
  // Oggetto dello scenario che l'utente sta spostando: posizione provvisoria fino al rilascio.
  // Gesto a mano libera per tracciare una strada tenendo premuto il tasto sinistro.
  const disegnando = useRef<{ base: [number, number][]; campioni: [number, number][]; ultimoPx: [number, number] } | null>(null)
  const trascinando = useRef<{ id: string; lonlat: [number, number]; inizioPx: [number, number]; mosso: boolean } | null>(null)
  const [pronta, setPronta] = useState(false)
  const [errore, setErrore] = useState(false)
  const [tridimensionale, setTridimensionale] = useState(true)
  const [mostraVita, setMostraVita] = useState(true)
  const [zoom, setZoom] = useState(9)
  // Paesaggio sonoro: segue il comune al centro della mappa (o quello aperto), altrimenti la provincia.
  const [suoni, setSuoni] = useState(false)
  const audio = useRef<PaesaggioSonoro | null>(null)
  const [comuneCentro, setComuneCentro] = useState<string | null>(null)
  const indici = useIndici()
  const vista = useApp((s) => s.vista)
  const selezionato = useApp((s) => s.comuneSelezionato)
  const sezione = useApp((s) => s.sezione)
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
  const strumento = useApp((s) => s.strumento)
  const bozzaStrada = useApp((s) => s.bozzaStrada)
  const tipoStrada = useApp((s) => s.tipoStrada)
  const tempoAttivo = useTempo((s) => s.attivo)
  const inRiproduzione = useTempo((s) => s.inRiproduzione)
  const annoTempo = useTempo((s) => Math.floor(s.anno + 1e-6))
  const pianoTempo = useTempo((s) => s.piano)
  const annoHabitat = useRef<number | null>(null)
  const confini = useMemo(() => confiniGeografici(dataset.comuni), [])
  const estensione = useMemo(() => estensioneGeografica(confini), [confini])
  const statoCorrente = useRef({ indici, selezionato, vista, mostraVita })
  statoCorrente.current = { indici, selezionato, vista, mostraVita }
  const trovaComune = useMemo(() => creaTrovaComune(dataset.comuni), [])
  // Cielo, foschia e nuvole seguono l'indice del comune aperto, o la media dell'intera provincia.
  const statoAtmosfera = vista === "comune" && selezionato ? indici[selezionato] : statoMedio(indici)
  const atmosferaCorrente = atmosferaDaStato(statoAtmosfera ?? null)
  const chiaveCielo = JSON.stringify(atmosferaCorrente.sky)

  useEffect(() => {
    if (!contenitore.current) return
    let map: Map
    try {
      map = new Map({
        container: contenitore.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        bounds: estensione,
        fitBoundsOptions: { padding: 70, pitch: 40, bearing: -12 },
        maxPitch: 65, minZoom: 8, maxZoom: 19,
        maxBounds: [[estensione[0][0] - .5, estensione[0][1] - .5], [estensione[1][0] + .5, estensione[1][1] + .5]],
        canvasContextAttributes: { antialias: true },
        attributionControl: { compact: true },
      })
    } catch {
      setErrore(true)
      return
    }
    mappa.current = map
    if (import.meta.env.DEV) Object.assign(window, { __mappaTerritorio: map })
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right")
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right")
    const popup = new Popup({ closeButton: false, closeOnClick: true, offset: 14, className: "territorio-popup" })
    let timerHabitat = 0
    const timeout = window.setTimeout(() => { if (!map.isStyleLoaded()) setErrore(true) }, 20000)
    map.on("load", () => {
      window.clearTimeout(timeout)
      // Colori chiari e saturi: cartografia leggibile e volumi color sabbia.
      for (const layer of map.getStyle().layers) {
        if (layer.type === "fill-extrusion") map.setLayoutProperty(layer.id, "visibility", "none")
        if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", "#edf1df")
        if (layer.type === "fill") {
          if (/water/.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", "#9ad9e8")
          else if (/park|wood|forest/.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", "#acd69d")
          else if (/residential/.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", "#f3eee0")
        }
        // Fuori provincia restano strade e nomi dei centri abitati.
        // Il filtro evita il posizionamento dei simboli e testi superflui.
        if ((layer.type === "symbol" && layer["source-layer"] !== "place") ||
            (layer.type === "line" && !/transportation|waterway/.test(layer["source-layer"] ?? ""))) {
          const interno: ExpressionSpecification = ["within", confineProvincia.geometry]
          map.setFilter(layer.id, layer.filter ? ["all", convertFilter(layer.filter), interno] : interno)
        }
        // I centri minori compaiono avvicinandosi; sotto, solo i riferimenti principali.
        if (layer.type === "symbol" && layer["source-layer"] === "place")
          map.setLayerZoomRange(layer.id, Math.max(layer.minzoom ?? 0, 11.5), layer.maxzoom ?? 24)
      }
      const primaEtichetta = map.getStyle().layers.find((l) => l.type === "symbol")?.id
      map.addSource("territorio-osm", { type: "vector", url: "https://tiles.openfreemap.org/planet" })
      // Manteniamo attivi anche acqua e corsi d'acqua nella sorgente interrogata per gli spawn.
      map.addLayer({ id: "habitat-acqua", type: "fill", source: "territorio-osm", "source-layer": "water",
        paint: { "fill-opacity": 0 } }, primaEtichetta)
      map.addLayer({ id: "habitat-corsi-acqua", type: "line", source: "territorio-osm", "source-layer": "waterway",
        paint: { "line-opacity": 0 } }, primaEtichetta)
      map.addSource("comuni-vicenza", { type: "geojson", data: confini })
      map.addSource("provincia-vicenza", { type: "geojson", data: confineProvincia })
      map.addSource("esterno-provincia", { type: "geojson", data: esternoProvincia })
      map.addSource("infrastrutture-vive", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addSource("edifici-vicenza", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addSource("rilievo", {
        type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: 14,
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen · EU-DEM / Copernicus EU · SRTM / USGS</a>',
      })
      map.addLayer({
        id: "rilievo-ombre", type: "hillshade", source: "rilievo",
        paint: { "hillshade-exaggeration": 0.22, "hillshade-shadow-color": "#657d68", "hillshade-highlight-color": "#ffffed" },
      }, primaEtichetta)
      map.addLayer({
        id: "indice-comuni", type: "fill", source: "comuni-vicenza",
        paint: { "fill-color": ["coalesce", ["feature-state", "colore"], "#9cc9a7"], "fill-opacity": .38,
          "fill-color-transition": { duration: 900 } },
      }, primaEtichetta)
      map.addLayer({
        id: "bordo-provincia", type: "line", source: "provincia-vicenza",
        paint: { "line-color": "#ffffff", "line-width": 4, "line-opacity": .95 },
      }, primaEtichetta)
      map.addLayer({
        id: "confini-comuni", type: "line", source: "comuni-vicenza",
        paint: { "line-color": "#608b79", "line-opacity": 0.45, "line-width": 1, "line-dasharray": [3, 3] },
      }, primaEtichetta)
      map.addLayer({
        id: "comune-selezionato", type: "line", source: "comuni-vicenza",
        paint: {
          "line-color": "#168568",
          "line-width": ["case", ["boolean", ["feature-state", "selezionato"], false], 3, 0],
        },
      }, primaEtichetta)
      map.addLayer({
        id: "edifici-da-ritagliare", type: "fill", source: "territorio-osm", "source-layer": "building", minzoom: 13,
        paint: { "fill-opacity": 0 },
      }, primaEtichetta)
      map.addLayer({
        id: "edifici-reali-3d", type: "fill-extrusion", source: "edifici-vicenza", minzoom: 13,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 8],
            0, "#e9d9bd", 20, "#d6bfa0", 55, "#c7b0a2"],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.97,
          "fill-extrusion-color-transition": { duration: 900 },
        },
      }, primaEtichetta)
      const vita = new EcosistemaLayer()
      ecosistema.current = vita
      map.addLayer(vita, primaEtichetta)
      map.addLayer({ id: "esterno-provincia", type: "fill", source: "esterno-provincia",
        paint: { "fill-color": "#dfe7e2", "fill-opacity": .72 } }, primaEtichetta)
      aggiornaHabitat.current = () => {
        if (map.isMoving()) return
        const { indici, selezionato, vista } = statoCorrente.current
        const bounds = map.getBounds()
        const center = map.getCenter()
        const edifici = map.querySourceFeatures("territorio-osm", { sourceLayer: "building" })
        // Includiamo anche le tile della cartografia visibile: possono essere più dettagliate
        // o già caricate mentre la sorgente del livello 3D sta ancora completando lo zoom.
        const sorgenti = Object.entries(map.getStyle().sources).filter(([, s]) => s.type === "vector").map(([id]) => id)
        const vincoli = (sourceLayer: string) => sorgenti.flatMap((id) => map.querySourceFeatures(id, { sourceLayer }))
        const terrenoLibero = creaVincoliHabitat(vincoli("building"), vincoli("water"), vincoli("waterway"))
        if (map.getZoom() >= 13) {
          ;(map.getSource("edifici-vicenza") as GeoJSONSource).setData(assegnaComuni(ritagliaEdifici(edifici), trovaComune))
        }
        const stradeFauna = vincoli("transportation").filter((f) =>
          !/motorway|trunk|rail|ferry/.test(String(f.properties.class ?? "")) && !f.properties.brunnel)
          .flatMap((f) => f.geometry.type === "LineString" ? [f.geometry.coordinates]
            : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [])
          .map((linea) => linea.map((p): [number, number] => [p[0]!, p[1]!]))
        const verdi: [number, number][] = []
        const areeVerdi: [number, number][][][] = []
        if (vista === "comune") {
          for (const layer of ["landuse", "landcover", "park"]) {
            const features = map.querySourceFeatures("territorio-osm", { sourceLayer: layer })
            for (const f of features) {
              if (!/park|wood|forest|grass|garden|recreation/.test(String(f.properties.class ?? f.properties.subclass ?? ""))) continue
              const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
                : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : []
              for (const polygon of rings) {
                areeVerdi.push(polygon.map((ring) => ring.map((p): [number, number] => [p[0]!, p[1]!])) )
                const ring = polygon[0]
                if (!ring?.length) continue
                const x = ring.reduce((n, p) => n + p[0]!, 0) / ring.length
                const y = ring.reduce((n, p) => n + p[1]!, 0) / ring.length
                if (bounds.contains([x, y])) verdi.push([x, y])
              }
            }
          }
        }
        vita.setPercorsiFauna(stradeFauna, areeVerdi)
        vita.setPercorsiTraffico(vincoli("transportation").filter((f) =>
          /^(primary|secondary|tertiary|minor|service|residential|unclassified)$/.test(String(f.properties.class ?? ""))
          && !f.properties.brunnel)
          .flatMap((f) => f.geometry.type === "LineString" ? [f.geometry.coordinates]
            : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [])
          .map((linea) => linea.map((p): [number, number] => [p[0]!, p[1]!])) )
        verdi.sort((a, b) => Math.hypot(a[0] - center.lng, a[1] - center.lat)
          - Math.hypot(b[0] - center.lng, b[1] - center.lat))
        const { clientWidth: w, clientHeight: h } = map.getContainer()
        const raggioVista = 0.5 * Math.hypot(w, h) * metriPerPixel(map.getZoom(), center.lat) * 0.6
        vita.aggiorna(preparaHabitat(dataset.comuni, indici, vista === "comune" ? selezionato : null,
          [center.lng, center.lat], verdi, raggioVista, [], terrenoLibero), vista === "comune", terrenoLibero)
      }
      map.on("moveend", () => {
        window.clearTimeout(timerHabitat)
        timerHabitat = window.setTimeout(() => aggiornaHabitat.current(), 120)
      })
      map.on("sourcedata", (e) => {
        if (e.sourceId !== "territorio-osm" || !e.isSourceLoaded || map.isMoving()) return
        window.clearTimeout(timerHabitat)
        timerHabitat = window.setTimeout(() => aggiornaHabitat.current(), 400)
      })
      const scenarioVivo = new ScenarioLayer()
      scenarioLayer.current = scenarioVivo
      map.addLayer(scenarioVivo, primaEtichetta)
      // Maniglie e zone sensibili sopra i modelli 3D: servono a rimuovere e trascinare gli oggetti.
      map.addLayer({
        id: "infrastrutture-aree", type: "fill", source: "infrastrutture-vive", minzoom: 10,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#ffffff", "fill-opacity": 0 },
      })
      map.addLayer({
        id: "infrastrutture-linee", type: "line", source: "infrastrutture-vive", minzoom: 10,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-width": 18, "line-color": "#ffffff", "line-opacity": 0 },
      })
      // Presa compatta: a zoom ravvicinato non deve coprire gli oggetti vicini.
      const raggioPresa: ExpressionSpecification = ["interpolate", ["exponential", 2], ["zoom"],
        10, ["*", ["match", ["get", "tipo"], "nucleare", 1.5, "colonnine", 0.7, "strada", 0.4, 1], 45 / 2 ** 5.5],
        15.5, ["*", ["match", ["get", "tipo"], "nucleare", 1.5, "colonnine", 0.7, "strada", 0.4, 1], 20],
        19, ["*", ["match", ["get", "tipo"], "nucleare", 1.5, "colonnine", 0.7, "strada", 0.4, 1], 24]]
      map.addLayer({
        id: "infrastrutture-vive", type: "circle", source: "infrastrutture-vive", minzoom: 10,
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": raggioPresa, "circle-color": ["match", ["get", "tipo"], "industria", "#c46455", "nucleare", "#3fbf7f", "strada", "#8d8176", "#2a9674"],
          "circle-opacity": 0, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff", "circle-stroke-opacity": 0 },
      })
      map.addLayer({
        id: "centri-principali", type: "symbol", source: "territorio-osm", "source-layer": "place", maxzoom: 11.5,
        filter: ["in", ["get", "name"], ["literal", CENTRI_PRINCIPALI]],
        layout: {
          "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"],
          "text-size": ["case", ["==", ["get", "name"], "Vicenza"], 19, 14],
          "text-anchor": "bottom", "text-offset": [0, -0.4], "text-padding": 8,
          "text-allow-overlap": false, "symbol-sort-key": ["case", ["==", ["get", "name"], "Vicenza"], 0, 1],
        },
        paint: { "text-color": "#244b42", "text-halo-color": "#ffffff", "text-halo-width": 2.5 },
      })
      // Edifici visibili (vettoriali OSM) nel piano locale; si ricalcolano quando la vista cambia.
      const edificiVisibili = () => {
        const c = map.getCenter()
        const chiave = `${map.getZoom().toFixed(1)}|${c.lng.toFixed(3)}|${c.lat.toFixed(3)}`
        if (cacheEdifici.current?.chiave === chiave) return cacheEdifici.current
        const origine = { lon: c.lng, lat: c.lat }
        const geometrie = map.querySourceFeatures("territorio-osm", { sourceLayer: "building" }).map((f) => f.geometry)
        cacheEdifici.current = { chiave, origine, edifici: edificiDaGeometrie(geometrie, origine) }
        return cacheEdifici.current
      }
      const MSG_EDIFICI = "Non puoi costruire sopra gli edifici."
      const MSG_ZOOM = "Avvicinati ancora: per controllare gli edifici serve uno zoom maggiore."
      // Semilarghezza (m) del tracciato in corso: strada per tipo, pista ciclabile stretta, parco quasi nulla.
      const semi = () => {
        const st = store.getState()
        return st.strumento === "strada" ? STRADE[st.tipoStrada].larghezza / 2 : st.strumento === "ciclabile" ? 2.5 : 0.5
      }
      const inPiano = (punti: [number, number][]) => {
        const { origine } = edificiVisibili()
        return punti.map((p) => aPiano(aCoordinateGeografiche(p), origine))
      }
      // Vero se il tracciato (metri UTM) non tocca edifici.
      const tratteggioLibero = (punti: [number, number][]) =>
        percorsoLibero(inPiano(punti), edificiVisibili().edifici, semi())
      const parcoLibero = (contorno: [number, number][]) => areaLibera(inPiano(contorno), edificiVisibili().edifici)
      // Oggetto puntuale: ha un ingombro e non può stare sopra un edificio (richiede lo zoom per vederli).
      const puntoOk = (tipo: string, punto: [number, number]) => {
        if (map.getZoom() < 13) { mostraAvviso(MSG_ZOOM); return false }
        const raggio = INGOMBRO_OGGETTO[tipo] ?? 10
        const ok = percorsoLibero(inPiano([punto]), edificiVisibili().edifici, raggio)
        if (!ok) mostraAvviso(MSG_EDIFICI)
        return ok
      }
      const puoTracciare = (punto: [number, number], ultimo?: [number, number]) => {
        if (map.getZoom() < 13) { mostraAvviso(MSG_ZOOM); return false }
        if (!tratteggioLibero(ultimo ? [ultimo, punto] : [punto])) { mostraAvviso(MSG_EDIFICI); return false }
        return true
      }
      mappaApi.current = { puntoOk, puoTracciare }
      map.on("click", "indice-comuni", (e) => {
        const istat = e.features?.[0]?.properties?.istat
        const st = store.getState()
        if (trascinando.current?.mosso || disegnando.current === null && appenaDisegnato.current) return
        if (st.modalita === "scenario") {
          const lonlat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
          const punto = aCoordinateMetriche(lonlat)
          if (èTracciabile(st.strumento)) {
            if (puoTracciare(punto, st.bozzaStrada.at(-1))) st.aggiungiPuntoStrada(punto)
            return
          }
          const infra = map.queryRenderedFeatures(e.point,
            { layers: ["infrastrutture-vive", "infrastrutture-linee", "infrastrutture-aree"] })[0]
          // Un clic su un oggetto ne apre la scheda di impatto (a meno che si stia rimuovendo).
          if (infra && st.strumento !== "rimuovi") {
            setScheda({ id: String(infra.properties.id), x: e.point.x, y: e.point.y })
            return
          }
          setScheda(null)
          if (st.strumento) {
            const comune = dataset.comuni.find((c) => c.istat === trovaComune(lonlat)) ?? null
            const azione = azioneDaClic({ modalita: st.modalita, strumento: st.strumento, comune,
              punto, infraColpitaId: infra?.properties.id })
            if (azione?.tipo === "aggiungi" && puntoOk(azione.tipologia, azione.posizione))
              st.aggiungiInfrastruttura(azione.comune, azione.tipologia, azione.posizione)
            if (azione?.tipo === "rimuovi") st.rimuoviInfrastruttura(azione.id)
            return
          }
        }
        if (istat) { popup.remove(); store.getState().selezionaComune(istat) }
      })
      // Doppio clic: conclude la strada che si sta tracciando.
      map.on("dblclick", (e) => {
        const st = store.getState()
        if (st.modalita !== "scenario" || !èTracciabile(st.strumento)) return
        e.preventDefault()
        st.annullaUltimoPuntoStrada()
        terminaTracciato(store.getState(), trovaComune)
      })
      // Strada a mano libera: tasto sinistro premuto e movimento; al rilascio il gesto diventa una curva pulita.
      map.on("mousedown", (e) => {
        const st = store.getState()
        if (st.modalita !== "scenario" || !èTracciabile(st.strumento) || e.originalEvent.button !== 0) return
        if (!trovaComune([e.lngLat.lng, e.lngLat.lat])) return
        if (!puoTracciare(aCoordinateMetriche([e.lngLat.lng, e.lngLat.lat]))) return
        e.preventDefault()
        map.dragPan.disable()
        const inizio = aCoordinateMetriche([e.lngLat.lng, e.lngLat.lat])
        disegnando.current = { base: st.bozzaStrada, campioni: [inizio], ultimoPx: [e.point.x, e.point.y] }
        const finisci = () => {
          const d = disegnando.current
          document.removeEventListener("mouseup", finisci)
          map.dragPan.enable()
          if (!d) return
          disegnando.current = null
          if (d.campioni.length > 2) {
            appenaDisegnato.current = true
            window.setTimeout(() => { appenaDisegnato.current = false }, 100)
            const s = store.getState()
            // La curva addolcita può tagliare un angolo: se tocca un edificio si ripiega sul gesto originale.
            const curva = pulisciTracciato(d.campioni)
            const valido = (c: [number, number][]) => s.strumento === "parco" ? parcoLibero(c) : tratteggioLibero(c)
            const scelta = [curva, semplifica(d.campioni, 8), d.campioni].find(valido)
            if (!scelta) { mostraAvviso(MSG_EDIFICI); s.annullaBozzaStrada(); return }
            s.setBozzaStrada([...d.base, ...scelta])
            terminaTracciato(store.getState(), trovaComune)
          }
        }
        document.addEventListener("mouseup", finisci)
      })
      map.on("mousemove", (e) => {
        const d = disegnando.current
        if (!d || Math.hypot(e.point.x - d.ultimoPx[0], e.point.y - d.ultimoPx[1]) < 6) return
        const nuovo = aCoordinateMetriche([e.lngLat.lng, e.lngLat.lat])
        const prec = d.campioni.at(-1)!
        if (!tratteggioLibero([prec, nuovo])) { mostraAvviso(MSG_EDIFICI); return }
        d.ultimoPx = [e.point.x, e.point.y]
        d.campioni.push(nuovo)
        store.getState().setBozzaStrada([...d.base, ...d.campioni])
      })
      // Trascinamento di un oggetto già piazzato per cambiarne la posizione.
      map.on("mousedown", "infrastrutture-vive", (e) => {
        const st = store.getState()
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (e.originalEvent.button !== 0 || st.modalita !== "scenario" || st.strumento === "rimuovi" || èTracciabile(st.strumento)) return
        if (!id || !st.scenario.aggiunte.some((a) => a.id === id && !a.strada && !a.ciclabile && !a.parco)) return
        e.preventDefault()
        map.dragPan.disable()
        trascinando.current = { id, lonlat: [e.lngLat.lng, e.lngLat.lat], inizioPx: [e.point.x, e.point.y], mosso: false }
        const rilascia = () => {
          const t = trascinando.current
          map.dragPan.enable()
          document.removeEventListener("mouseup", rilascia)
          if (t?.mosso) {
            const comune = trovaComune(t.lonlat)
            const tipo = store.getState().scenario.aggiunte.find((a) => a.id === t.id)?.tipo ?? ""
            const punto = aCoordinateMetriche(t.lonlat)
            if (comune && puntoOk(tipo, punto)) store.getState().spostaInfrastruttura(t.id, comune, punto)
            window.setTimeout(() => { trascinando.current = null; aggiornaScenario.current() }, 50)
          } else trascinando.current = null
          aggiornaScenario.current()
        }
        document.addEventListener("mouseup", rilascia)
      })
      map.on("mousemove", (e) => {
        const t = trascinando.current
        if (!t) return
        // Il tremolio del mouse durante un clic non deve impedire l'apertura della scheda.
        if (!t.mosso && Math.hypot(e.point.x - t.inizioPx[0], e.point.y - t.inizioPx[1]) < 6) return
        t.lonlat = [e.lngLat.lng, e.lngLat.lat]
        t.mosso = true
        map.getCanvas().style.cursor = "grabbing"
        aggiornaScenario.current()
      })
      map.on("mouseenter", "infrastrutture-vive", () => {
        if (store.getState().modalita === "scenario" && !trascinando.current) map.getCanvas().style.cursor = "grab"
      })
      map.on("mouseleave", "infrastrutture-vive", () => { if (!trascinando.current) map.getCanvas().style.cursor = "" })
      map.on("mousemove", "indice-comuni", (e) => {
        const costruisce = store.getState().modalita === "scenario" && store.getState().strumento
        if (!trascinando.current) map.getCanvas().style.cursor = costruisce ? "crosshair" : "pointer"
        const c = e.features?.[0]?.properties
        if (!c || costruisce) { popup.remove(); return }
        const indice = statoCorrente.current.indici[c.istat]
        const elemento = document.createElement("div")
        const nome = document.createElement("strong")
        nome.textContent = c.nome
        elemento.append(nome, document.createTextNode(` · ${Math.round(indice?.totale ?? 0)}/100`))
        popup.setLngLat(e.lngLat).setDOMContent(elemento).addTo(map)
      })
      map.on("mouseleave", "indice-comuni", () => { map.getCanvas().style.cursor = ""; popup.remove() })
      map.on("movestart", () => setScheda(null))
      map.on("zoomend", () => setZoom(map.getZoom()))
      map.on("moveend", () => {
        const c = map.getCenter()
        setComuneCentro(map.getZoom() >= 11 ? trovaComune([c.lng, c.lat]) : null)
      })
      setPronta(true)
      setErrore(false)
    })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(contenitore.current)
    return () => {
      window.clearTimeout(timeout)
      window.clearTimeout(timerHabitat)
      observer.disconnect()
      popup.remove()
      map.remove()
      mappa.current = null
      ecosistema.current = null
      scenarioLayer.current = null
      if (import.meta.env.DEV) Object.assign(window, { __mappaTerritorio: undefined })
    }
  }, [confini, estensione])

  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map) return
    for (const comune of dataset.comuni)
      map.setFeatureState({ source: "comuni-vicenza", id: comune.istat }, {
        colore: coloreIndice(indici[comune.istat]), selezionato: comune.istat === selezionato,
      })
    // Ogni edificio ha il colore della fascia del proprio comune, su tutta la mappa.
    map.setPaintProperty("edifici-reali-3d", "fill-extrusion-color", coloriEdifici(indici, "#c5cdb7") as never)
    // In riproduzione la macchina del tempo cambia gli indici più volte all'anno: alberi e fauna
    // (costosi da rigenerare) si aggiornano solo al cambio d'anno.
    const t = storeTempo.getState()
    const anno = t.attivo ? Math.floor(t.anno + 1e-6) : null
    if (t.inRiproduzione && anno === annoHabitat.current) return
    annoHabitat.current = anno
    aggiornaHabitat.current()
  }, [pronta, indici, selezionato])

  // Aprendo la macchina del tempo la provincia si inquadra sopra la barra; chiudendola si torna alla vista solita.
  const tempoPrima = useRef(false)
  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map || vista !== "provincia" || tempoPrima.current === tempoAttivo) return
    tempoPrima.current = tempoAttivo
    map.fitBounds(estensione, tempoAttivo
      ? { padding: { top: 110, bottom: 330, left: 60, right: 60 }, pitch: tridimensionale ? 45 : 0, bearing: -12, duration: 1200 }
      : { padding: 70, pitch: tridimensionale ? 40 : 0, bearing: -12, duration: 1200 })
  }, [pronta, tempoAttivo, vista, estensione, tridimensionale])

  // Riproduzione della macchina del tempo: a vista provincia la camera ruota lentamente.
  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map || !inRiproduzione || vista !== "provincia") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const { anno, piano } = storeTempo.getState()
    const durata = Math.max(1000, (piano.annoFine - anno) * 800)
    map.easeTo({ bearing: map.getBearing() + 28, pitch: tridimensionale ? 52 : 0, duration: durata, easing: (x) => x })
    return () => { map.stop() }
  }, [pronta, inRiproduzione, vista, tridimensionale])

  useEffect(() => {
    if (pronta) mappa.current?.setSky(JSON.parse(chiaveCielo))
  }, [pronta, chiaveCielo])

  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map) return
    const comune = dataset.comuni.find((c) => c.istat === selezionato)
    if (vista === "comune" && comune) {
      const centroAbitato = map.querySourceFeatures("territorio-osm", {
        sourceLayer: "place", filter: ["==", ["get", "name"], comune.nome],
      }).find((f) => f.geometry.type === "Point")
      const centro = centroAbitato?.geometry.type === "Point"
        ? centroAbitato.geometry.coordinates as [number, number] : aCoordinateGeografiche(comune.centroide)
      map.flyTo({ center: centro, zoom: 15.5,
        pitch: tridimensionale ? 58 : 0, bearing: -18, duration: 1800,
        padding: { top: 40, bottom: 40, left: 30, right: window.innerWidth > 900 ? 360 : 30 } })
    } else {
      map.fitBounds(estensione, { padding: 70, pitch: tridimensionale ? 40 : 0, bearing: -12, duration: 1400 })
    }
  }, [pronta, selezionato, vista, estensione])

  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map) return
    ecosistema.current?.setAttivo(mostraVita && sezione === "mappa")
  }, [pronta, mostraVita, sezione])

  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map) return
    aggiornaScenario.current = () => {
      const st = store.getState()
      const inScenario = st.modalita === "scenario"
      const rimosse = new Set(inScenario ? st.scenario.rimozioni : [])
      const spostato = trascinando.current
      // Le infrastrutture reali si vedono nel comune aperto; quelle aggiunte ovunque, insieme alle opere
      // costruite fino all'anno mostrato dalla macchina del tempo.
      const t = storeTempo.getState()
      const opereTempo = t.attivo ? t.fotogrammi[Math.floor(t.anno + 1e-6) - t.piano.annoInizio]?.aggiunte ?? [] : []
      const infra = [...dataset.infrastrutture.filter((i) => !rimosse.has(i.id) && i.comune === st.comuneSelezionato),
        ...(inScenario ? st.scenario.aggiunte : []), ...opereTempo]
      const idsTempo = new Set(opereTempo.map((o) => o.id))
      const oggetti: OggettoScenario[] = infra.map((i) => {
        const x = i as Partial<Aggiunta>
        return { id: i.id, tipo: i.tipo,
          lonlat: spostato?.id === i.id ? spostato.lonlat : aCoordinateGeografiche(i.posizione),
          ...(x.strada ? { linea: { stile: x.strada.tipo, punti: x.strada.tracciato.map(aCoordinateGeografiche) } } : {}),
          ...(x.ciclabile ? { linea: { stile: "ciclabile" as const, punti: x.ciclabile.tracciato.map(aCoordinateGeografiche) } } : {}),
          ...(x.parco ? { area: x.parco.contorno.map(aCoordinateGeografiche) } : {}),
          ...(x.industria ? { industria: x.industria } : {}),
          ...(idsTempo.has(i.id) ? { evidenza: true } : {}) }
      })
      const features: FeatureCollection["features"] = oggetti.map((o) => ({
        type: "Feature", properties: { id: o.id, tipo: o.tipo },
        geometry: o.linea ? { type: "LineString", coordinates: o.linea.punti }
          : o.area ? { type: "Polygon", coordinates: [[...o.area, o.area[0]!]] }
          : { type: "Point", coordinates: o.lonlat } }))
      ;(map.getSource("infrastrutture-vive") as GeoJSONSource).setData({ type: "FeatureCollection", features })
      ecosistema.current?.setStrade(oggetti.filter((o) => o.linea && (inScenario || t.attivo)).map((o) => ({
        punti: o.linea!.punti, semi: (o.linea!.stile === "ciclabile" ? 5 : STRADE[o.linea!.stile].larghezza) / 2 })))
      const stile = st.strumento === "strada" ? st.tipoStrada : st.strumento
      scenarioLayer.current?.imposta(oggetti, inScenario && èTracciabile(st.strumento) && st.bozzaStrada.length && stile
        ? { stile: stile as BozzaTracciato["stile"], punti: st.bozzaStrada.map(aCoordinateGeografiche) } : null)
    }
    aggiornaScenario.current()
    // Le maniglie compaiono solo costruendo uno scenario.
    const attive = modalita === "scenario"
    map.setPaintProperty("infrastrutture-vive", "circle-stroke-opacity", attive ? 0.4 : 0)
    map.setPaintProperty("infrastrutture-vive", "circle-opacity", attive ? 0.06 : 0)
    map.setPaintProperty("infrastrutture-linee", "line-opacity", attive ? 0.04 : 0)
    map.setPaintProperty("infrastrutture-aree", "fill-opacity", attive ? 0.03 : 0)
  }, [pronta, modalita, scenario, selezionato, bozzaStrada, tipoStrada, strumento, tempoAttivo, annoTempo, pianoTempo])

  useEffect(() => {
    const map = mappa.current
    if (!pronta || !map) return
    if (modalita === "scenario" && èTracciabile(strumento)) map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()
    map.getCanvas().style.cursor = modalita === "scenario" && strumento ? "crosshair" : ""
  }, [pronta, modalita, strumento])

  const rilascia = (e: DragEvent) => {
    const map = mappa.current
    const tipo = e.dataTransfer.getData("application/x-infra") as TipoInfra
    const st = store.getState()
    if (!map || st.modalita !== "scenario" || !(TIPI_TRASCINABILI as readonly string[]).includes(tipo)) return
    e.preventDefault()
    const r = map.getContainer().getBoundingClientRect()
    const g = map.unproject([e.clientX - r.left, e.clientY - r.top])
    const lonlat: [number, number] = [g.lng, g.lat]
    const comune = trovaComune(lonlat)
    if (!comune) return
    const punto = aCoordinateMetriche(lonlat)
    if (èTracciabile(tipo)) {
      if (!mappaApi.current?.puoTracciare(punto)) return
      st.setStrumento(tipo)
      st.aggiungiPuntoStrada(punto)
    } else if (mappaApi.current?.puntoOk(tipo, punto)) {
      const variante = e.dataTransfer.getData("application/x-variante")
      if (tipo === "industria" && variante in INDUSTRIE) st.setTipoIndustria(variante as TipoIndustria)
      st.aggiungiInfrastruttura(comune, tipo, punto)
    }
  }

  useEffect(() => { if (sezione === "mappa") mappa.current?.resize() }, [sezione])

  const comuneAscolto = vista === "comune" && selezionato ? selezionato : comuneCentro
  const zonaSonora = useMemo(() => {
    if (!comuneAscolto) return { nome: "Provincia di Vicenza", livelli: livelliZona({ stato: statoMedio(indici), industrie: 0, strade: 0.5 }) }
    const rimosse = new Set(modalita === "scenario" ? scenario.rimozioni : [])
    const presenti = [
      ...dataset.infrastrutture.filter((i) => !rimosse.has(i.id)),
      ...(modalita === "scenario" ? scenario.aggiunte : []),
    ].filter((i) => i.comune === comuneAscolto)
    const conta = (tipo: TipoInfra) => presenti.filter((i) => i.tipo === tipo).length
    return {
      nome: dataset.comuni.find((c) => c.istat === comuneAscolto)?.nome ?? "",
      livelli: livelliZona({ stato: indici[comuneAscolto] ?? null, industrie: conta("industria"), strade: conta("strada") }),
    }
  }, [comuneAscolto, indici, modalita, scenario])

  useEffect(() => { if (suoni) audio.current?.imposta(zonaSonora.livelli) }, [suoni, zonaSonora])
  useEffect(() => () => { audio.current?.chiudi(); audio.current = null }, [])

  const cambiaSuoni = () => {
    if (suoni) {
      audio.current?.chiudi()
      audio.current = null
      setSuoni(false)
      return
    }
    // L'AudioContext nasce dentro il clic: i browser bloccano l'audio senza un gesto dell'utente.
    audio.current = new PaesaggioSonoro()
    audio.current.imposta(zonaSonora.livelli)
    void audio.current.riprendi()
    setSuoni(true)
  }

  const cambiaDimensione = () => {
    const nuovo = !tridimensionale
    setTridimensionale(nuovo)
    mappa.current?.easeTo({ pitch: nuovo ? 58 : 0, duration: 700 })
  }

  return (
    <div className="territorio" onDragOver={(e) => { if (modalita === "scenario") e.preventDefault() }} onDrop={rilascia}>
      <div ref={contenitore} className="territorio-canvas" aria-label="Mappa geografica 3D della provincia di Vicenza" />
      <div className="territorio-testata">
      <div className="territorio-intro">
        <span className="territorio-eyebrow">PROVINCIA DI VICENZA · 114 COMUNI</span>
        {tempoAttivo ? <>
          <h2>{vista === "provincia" ? "Vicenza" : dataset.comuni.find((c) => c.istat === selezionato)?.nome} nel {annoTempo}</h2>
          <p>{pianoTempo.nome}: {pianoTempo.descrizione.toLowerCase()}.</p>
        </> : <>
          <h2>{vista === "provincia" ? "Un territorio che respira." : dataset.comuni.find((c) => c.istat === selezionato)?.nome}</h2>
          <p>{zoom < 13 ? "I colori raccontano l’ambiente. La vita cambia insieme a lui." : "Aria, verde e fauna: il tuo comune prende vita."}</p>
        </>}
      </div>
      <div className="territorio-controlli" aria-label="Aspetto della mappa">
        <button disabled={!pronta} aria-pressed={tridimensionale} onClick={cambiaDimensione}>{tridimensionale ? "◈ 3D" : "◇ 2D"}</button>
        <button disabled={!pronta} aria-pressed={mostraVita} onClick={() => setMostraVita(!mostraVita)}>❧ Alberi e fauna</button>
        <button aria-pressed={suoni} onClick={cambiaSuoni}>{suoni ? "🔊 Suoni" : "🔈 Suoni"}</button>
        <button aria-pressed={modalita === "scenario"} onClick={() => store.getState().setModalita(modalita === "scenario" ? "realta" : "scenario")}>✧ {modalita === "scenario" ? "Scenario attivo" : "Crea uno scenario"}</button>
        {suoni && <span className="territorio-ascolto" role="status">In ascolto: <b>{zonaSonora.nome}</b> · {descriviLivelli(zonaSonora.livelli)}</span>}
      </div>
      </div>
      {scheda && modalita === "scenario" && (
        <SchedaImpatto id={scheda.id} x={scheda.x} y={scheda.y} larghezza={contenitore.current?.clientWidth ?? 800}
          altezza={contenitore.current?.clientHeight ?? 600} onChiudi={() => setScheda(null)} />
      )}
      {avviso && <div className="territorio-nota" role="status">{avviso}</div>}
      {!pronta && !errore && <div className="territorio-avviso" role="status">Caricamento del territorio…</div>}
      {errore && <div className="territorio-avviso" role="alert">La cartografia online non è disponibile. <button onClick={apriDiorama}>Apri la mappa offline</button></div>}
      <div className="territorio-aiuto">Trascina per esplorare · Rotella per zoomare · Tasto destro per ruotare</div>
    </div>
  )
}
