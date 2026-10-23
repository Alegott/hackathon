import { useEffect, useMemo, useRef, useState } from "react"
import { Map, NavigationControl, ScaleControl, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl"
import type { FeatureCollection, Point } from "geojson"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import "maplibre-gl/dist/maplibre-gl.css"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import { aCoordinateGeografiche, aCoordinateMetriche, CENTRI_PRINCIPALI, coloreIndice, confiniGeografici, estensioneGeografica } from "./territorio"
import { confineProvincia, esternoProvincia, preparaHabitat, ritagliaEdifici } from "./ecosistema"
import { EcosistemaLayer } from "./EcosistemaLayer"
import { assegnaComuni, atmosferaDaStato, coloriEdifici, creaTrovaComune, metriPerPixel, statoMedio } from "./vitaTerritorio"
import { azioneDaClic } from "../diorama/build"

setWorkerUrl(workerUrl)

export function MappaTerritorio({ apriDiorama }: { apriDiorama(): void }) {
  const contenitore = useRef<HTMLDivElement>(null)
  const mappa = useRef<Map | null>(null)
  const ecosistema = useRef<EcosistemaLayer | null>(null)
  const aggiornaHabitat = useRef<() => void>(() => {})
  const [pronta, setPronta] = useState(false)
  const [errore, setErrore] = useState(false)
  const [tridimensionale, setTridimensionale] = useState(true)
  const [mostraVita, setMostraVita] = useState(true)
  const [zoom, setZoom] = useState(9)
  const indici = useIndici()
  const vista = useApp((s) => s.vista)
  const selezionato = useApp((s) => s.comuneSelezionato)
  const sezione = useApp((s) => s.sezione)
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
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
        // I centri minori compaiono avvicinandosi; sotto, solo i riferimenti principali.
        if (layer.type === "symbol" && layer["source-layer"] === "place")
          map.setLayerZoomRange(layer.id, Math.max(layer.minzoom ?? 0, 11.5), layer.maxzoom ?? 24)
      }
      const primaEtichetta = map.getStyle().layers.find((l) => l.type === "symbol")?.id
      map.addSource("territorio-osm", { type: "vector", url: "https://tiles.openfreemap.org/planet" })
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
        if (map.getZoom() >= 13) {
          const edifici = map.querySourceFeatures("territorio-osm", { sourceLayer: "building" })
          ;(map.getSource("edifici-vicenza") as GeoJSONSource).setData(assegnaComuni(ritagliaEdifici(edifici), trovaComune))
        }
        const verdi: [number, number][] = []
        if (vista === "comune") {
          for (const layer of ["landuse", "landcover", "park"]) {
            const features = map.querySourceFeatures("territorio-osm", { sourceLayer: layer })
            for (const f of features) {
              if (!/park|wood|forest|grass|garden|recreation/.test(String(f.properties.class ?? f.properties.subclass ?? ""))) continue
              const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
                : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : []
              for (const polygon of rings) {
                const ring = polygon[0]
                if (!ring?.length) continue
                const x = ring.reduce((n, p) => n + p[0]!, 0) / ring.length
                const y = ring.reduce((n, p) => n + p[1]!, 0) / ring.length
                if (bounds.contains([x, y])) verdi.push([x, y])
              }
            }
          }
        }
        verdi.sort((a, b) => Math.hypot(a[0] - center.lng, a[1] - center.lat)
          - Math.hypot(b[0] - center.lng, b[1] - center.lat))
        const { clientWidth: w, clientHeight: h } = map.getContainer()
        const raggioVista = 0.5 * Math.hypot(w, h) * metriPerPixel(map.getZoom(), center.lat) * 0.6
        vita.aggiorna(preparaHabitat(dataset.comuni, indici, vista === "comune" ? selezionato : null,
          [center.lng, center.lat], verdi, raggioVista), vista === "comune")
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
      map.addLayer({
        id: "infrastrutture-vive", type: "circle", source: "infrastrutture-vive", minzoom: 12,
        paint: { "circle-radius": 7, "circle-color": ["match", ["get", "tipo"], "industria", "#c46455", "strada", "#8d8176", "#2a9674"],
          "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
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
      map.on("click", "indice-comuni", (e) => {
        const istat = e.features?.[0]?.properties?.istat
        const st = store.getState()
        if (st.modalita === "scenario" && st.strumento && st.comuneSelezionato) {
          const infra = map.queryRenderedFeatures(e.point, { layers: ["infrastrutture-vive"] })[0]
          const comune = dataset.comuni.find((c) => c.istat === st.comuneSelezionato) ?? null
          const azione = azioneDaClic({ modalita: st.modalita, strumento: st.strumento, comune,
            punto: aCoordinateMetriche([e.lngLat.lng, e.lngLat.lat]), infraColpitaId: infra?.properties.id })
          if (azione?.tipo === "aggiungi") st.aggiungiInfrastruttura(azione.comune, azione.tipologia, azione.posizione)
          if (azione?.tipo === "rimuovi") st.rimuoviInfrastruttura(azione.id)
          return
        }
        if (istat) { popup.remove(); store.getState().selezionaComune(istat) }
      })
      map.on("mousemove", "indice-comuni", (e) => {
        map.getCanvas().style.cursor = "pointer"
        const c = e.features?.[0]?.properties
        if (!c) return
        const indice = statoCorrente.current.indici[c.istat]
        const elemento = document.createElement("div")
        const nome = document.createElement("strong")
        nome.textContent = c.nome
        elemento.append(nome, document.createTextNode(` · ${Math.round(indice?.totale ?? 0)}/100`))
        popup.setLngLat(e.lngLat).setDOMContent(elemento).addTo(map)
      })
      map.on("mouseleave", "indice-comuni", () => { map.getCanvas().style.cursor = ""; popup.remove() })
      map.on("zoomend", () => setZoom(map.getZoom()))
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
    aggiornaHabitat.current()
  }, [pronta, indici, selezionato])

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
    const rimosse = new Set(modalita === "scenario" ? scenario.rimozioni : [])
    const infra = [...dataset.infrastrutture.filter((i) => !rimosse.has(i.id)),
      ...(modalita === "scenario" ? scenario.aggiunte : [])]
    const data: FeatureCollection<Point> = { type: "FeatureCollection", features: infra
      .filter((i) => i.comune === selezionato)
      .map((i) => ({ type: "Feature", properties: { id: i.id, tipo: i.tipo },
        geometry: { type: "Point", coordinates: aCoordinateGeografiche(i.posizione) } })) }
    ;(map.getSource("infrastrutture-vive") as GeoJSONSource).setData(data)
  }, [pronta, modalita, scenario, selezionato])

  useEffect(() => { if (sezione === "mappa") mappa.current?.resize() }, [sezione])

  const cambiaDimensione = () => {
    const nuovo = !tridimensionale
    setTridimensionale(nuovo)
    mappa.current?.easeTo({ pitch: nuovo ? 58 : 0, duration: 700 })
  }

  return (
    <div className="territorio">
      <div ref={contenitore} className="territorio-canvas" aria-label="Mappa geografica 3D della provincia di Vicenza" />
      <div className="territorio-intro">
        <span className="territorio-eyebrow">PROVINCIA DI VICENZA · 114 COMUNI</span>
        <h2>{vista === "provincia" ? "Un territorio che respira." : dataset.comuni.find((c) => c.istat === selezionato)?.nome}</h2>
        <p>{zoom < 13 ? "I colori raccontano l’ambiente. La vita cambia insieme a lui." : "Aria, verde e fauna: il tuo comune prende vita."}</p>
      </div>
      <div className="territorio-controlli" aria-label="Aspetto della mappa">
        <button disabled={!pronta} aria-pressed={tridimensionale} onClick={cambiaDimensione}>{tridimensionale ? "◈ 3D" : "◇ 2D"}</button>
        <button disabled={!pronta} aria-pressed={mostraVita} onClick={() => setMostraVita(!mostraVita)}>❧ Alberi e fauna</button>
        <button aria-pressed={modalita === "scenario"} onClick={() => store.getState().setModalita(modalita === "scenario" ? "realta" : "scenario")}>✧ {modalita === "scenario" ? "Scenario attivo" : "Crea uno scenario"}</button>
      </div>
      {!pronta && !errore && <div className="territorio-avviso" role="status">Caricamento del territorio…</div>}
      {errore && <div className="territorio-avviso" role="alert">La cartografia online non è disponibile. <button onClick={apriDiorama}>Apri la mappa offline</button></div>}
      <div className="territorio-aiuto">Trascina per esplorare · Rotella per zoomare · Tasto destro per ruotare</div>
    </div>
  )
}
