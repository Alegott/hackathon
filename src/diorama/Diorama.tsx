import { useFrame, useThree } from "@react-three/fiber"
import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import { altezzaComune } from "../map/altezza"
import type { Proiezione } from "../map/scena"
import type { TipoInfra } from "../types"
import { Alberi } from "./Alberi"
import { azioneDaClic, type AzioneBuild } from "./build"
import { Nuvole } from "./Cielo"
import { Fauna } from "./Fauna"
import { Infrastruttura } from "./Modelli"
import { misuraComune } from "./misura"
import { avanzaPreset, PRESET_PROVINCIA, presetFascia, type PresetVisivo } from "./preset"

const SPESSORE_TERRENO = 0.03
const ERBA_VIVA = new THREE.Color("#6aa84f")
const ERBA_SECCA = new THREE.Color("#a89a6a")

function eseguiAzione(a: AzioneBuild | null) {
  if (!a) return
  const st = store.getState()
  if (a.tipo === "aggiungi") st.aggiungiInfrastruttura(a.comune, a.tipologia, a.posizione)
  else st.rimuoviInfrastruttura(a.id)
}

// Atmosfera + diorama del comune selezionato. Il preset visivo corrente insegue quello della
// fascia (o quello neutro della provincia) con una transizione morbida: cielo, nebbia, alberi,
// nuvole e fauna ne dipendono tutti, quindi cambiano insieme.
export function Diorama({ proiezione }: { proiezione: Proiezione }) {
  const vista = useApp((s) => s.vista)
  const istat = useApp((s) => s.comuneSelezionato)
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
  const indici = useIndici()
  const scena = useThree((s) => s.scene)

  const comune = useMemo(() => dataset.comuni.find((c) => c.istat === istat) ?? null, [istat])
  const misura = useMemo(() => (comune ? misuraComune(comune, proiezione) : null), [comune, proiezione])
  const stato = istat ? indici[istat] : undefined
  const attivo = vista === "comune" && !!comune && !!stato && !!misura

  const obiettivo = attivo && stato ? presetFascia(stato.fascia) : PRESET_PROVINCIA
  const corrente = useRef<PresetVisivo>(PRESET_PROVINCIA)
  const dimensioneRif = misura?.dimensione ?? 1000
  const materialeTerreno = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((_, dt) => {
    corrente.current = avanzaPreset(corrente.current, obiettivo, Math.min(dt, 0.1))
    const p = corrente.current
    const colore = new THREE.Color(p.cielo[0], p.cielo[1], p.cielo[2])
    scena.background = colore
    scena.fog = p.nebbia > 0.001 ? new THREE.Fog(colore, 0.1, THREE.MathUtils.lerp(dimensioneRif * 12, dimensioneRif * 1.6, p.nebbia)) : null
    materialeTerreno.current?.color.lerpColors(ERBA_VIVA, ERBA_SECCA, 1 - p.fogliame)
  })

  const geometriaTerreno = useMemo(() => {
    if (!misura || misura.anello.length < 3) return null
    // Come per i comuni: la y della shape diventa −z dopo la rotazione −90° attorno a X.
    const forma = new THREE.Shape(misura.anello.map(([x, z]) => new THREE.Vector2(x, -z)))
    return new THREE.ExtrudeGeometry(forma, { depth: SPESSORE_TERRENO, bevelEnabled: false })
  }, [misura])
  useEffect(() => () => geometriaTerreno?.dispose(), [geometriaTerreno])

  // Infrastrutture mostrate: reali (meno le rimosse) e aggiunte, solo in modalità scenario per le modifiche.
  const infra = useMemo(() => {
    if (!comune || !misura) return []
    const rimosse = new Set(modalita === "scenario" ? scenario.rimozioni : [])
    const reali = dataset.infrastrutture
      .filter((i) => i.comune === comune.istat && !rimosse.has(i.id))
      .map((i) => ({ id: i.id, tipo: i.tipo, posizione: i.posizione }))
    const aggiunte = modalita === "scenario"
      ? scenario.aggiunte.filter((a) => a.comune === comune.istat).map((a) => ({ id: a.id, tipo: a.tipo, posizione: a.posizione }))
      : []
    return [...reali, ...aggiunte].map((i) => ({ ...i, scena: proiezione.aScena(i.posizione) }))
  }, [comune, misura, modalita, scenario, proiezione])

  const seme = useMemo(() => [...(istat ?? "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), [istat])
  const ostacoli = useMemo(
    () => (misura ? infra.map((i) => ({ posizione: i.scena, raggio: misura.dimensione * 0.1 })) : []),
    [infra, misura],
  )

  if (!attivo || !comune || !misura || !stato) return null
  const y = altezzaComune(stato.totale) + SPESSORE_TERRENO
  const s = misura.dimensione * 0.05

  const clic = (e: ThreeEvent<MouseEvent>, infraColpitaId?: string) => {
    e.stopPropagation()
    const st = store.getState()
    const punto = proiezione.daScena([e.point.x, e.point.z])
    eseguiAzione(azioneDaClic({ modalita: st.modalita, strumento: st.strumento, comune, punto, infraColpitaId }))
  }

  return (
    <group>
      {geometriaTerreno && (
        <mesh geometry={geometriaTerreno} position={[0, y - SPESSORE_TERRENO, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => clic(e)}>
          <meshStandardMaterial ref={materialeTerreno} color="#6aa84f" flatShading />
        </mesh>
      )}
      <Alberi anello={misura.anello} seme={seme} ostacoli={ostacoli} y={y} s={s} preset={corrente} />
      <Fauna anello={misura.anello} centro={misura.centro} dimensione={misura.dimensione} y={y} preset={corrente} />
      <Nuvole centro={misura.centro} dimensione={misura.dimensione} y={y} preset={corrente} />
      {infra.map((i) => (
        <Infrastruttura
          key={i.id}
          tipo={i.tipo as TipoInfra}
          posizione={[i.scena[0], y, i.scena[1]]}
          s={s}
          onClick={(e) => clic(e, i.id)}
        />
      ))}
    </group>
  )
}
