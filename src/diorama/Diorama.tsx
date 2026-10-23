import { useFrame, useThree } from "@react-three/fiber"
import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import { altezzaComune } from "../map/altezza"
import type { Proiezione } from "../map/scena"
import type { TipoInfra } from "../types"
import { Alberi } from "./AlberiScena"
import { azioneDaClic, type AzioneBuild } from "./build"
import { Nuvole } from "./Cielo"
import { Fauna } from "./Fauna"
import { CasaMesh, Infrastruttura, TrattoStradaleMesh } from "./Modelli"
import { misuraComune } from "./misura"
import { avanzaPreset, PRESET_PROVINCIA, type PresetVisivo } from "./preset"
import { sostenibilitaStato } from "../map/sostenibilita"
import {
  calcolaOstacoliCompleti,
  calcolaPosizioniCase,
  costruisciReteStradale,
} from "./strade"

const SPESSORE_TERRENO = 0.03
const ERBA_VIVA = new THREE.Color("#5f9e45")
const ERBA_SECCA = new THREE.Color("#a89a6a")

function eseguiAzione(a: AzioneBuild | null) {
  if (!a) return
  const st = store.getState()
  if (a.tipo === "aggiungi") st.aggiungiInfrastruttura(a.comune, a.tipologia, a.posizione)
  else st.rimuoviInfrastruttura(a.id)
}

// Atmosfera + diorama del comune selezionato: terreno geografico, rete stradale continua,
// centro abitato con case 3D, boschi/fiori glTF, infrastrutture e fauna con collision avoidance.
export function Diorama({ proiezione }: { proiezione: Proiezione }) {
  const vista = useApp((s) => s.vista)
  const istat = useApp((s) => s.comuneSelezionato)
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
  const casaUtente = useApp((s) => s.casaUtente)
  const indici = useIndici()
  const scena = useThree((s) => s.scene)

  const comune = useMemo(() => dataset.comuni.find((c) => c.istat === istat) ?? null, [istat])
  const misura = useMemo(() => (comune ? misuraComune(comune, proiezione) : null), [comune, proiezione])
  const stato = istat ? indici[istat] : undefined
  const attivo = vista === "comune" && !!comune && !!stato && !!misura

  const obiettivo = attivo && stato ? sostenibilitaStato(stato) : PRESET_PROVINCIA
  const corrente = useRef<PresetVisivo>(PRESET_PROVINCIA)
  const dimensioneRif = misura?.dimensione ?? 1000
  const materialeTerreno = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((_, dt) => {
    corrente.current = avanzaPreset(corrente.current, obiettivo, Math.min(dt, 0.1))
    const p = corrente.current
    const colore = new THREE.Color(p.cielo[0], p.cielo[1], p.cielo[2])
    scena.background = colore
    scena.fog =
      p.nebbia > 0.001
        ? new THREE.Fog(
            colore,
            0.1,
            THREE.MathUtils.lerp(dimensioneRif * 12, dimensioneRif * 1.6, p.nebbia),
          )
        : null
    materialeTerreno.current?.color.lerpColors(ERBA_VIVA, ERBA_SECCA, 1 - p.fogliame)
  })

  const geometriaTerreno = useMemo(() => {
    if (!misura || misura.anello.length < 3) return null
    const forma = new THREE.Shape(misura.anello.map(([x, z]) => new THREE.Vector2(x, -z)))
    return new THREE.ExtrudeGeometry(forma, {
      depth: SPESSORE_TERRENO,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    })
  }, [misura])
  useEffect(() => () => geometriaTerreno?.dispose(), [geometriaTerreno])

  // Infrastrutture mostrate: reali (meno le rimosse) e aggiunte, solo in modalità scenario per le modifiche.
  const infra = useMemo(() => {
    if (!comune || !misura) return []
    const rimosse = new Set(modalita === "scenario" ? scenario.rimozioni : [])
    const reali = dataset.infrastrutture
      .filter((i) => i.comune === comune.istat && !rimosse.has(i.id))
      .map((i) => ({ id: i.id, tipo: i.tipo, posizione: i.posizione }))
    const aggiunte =
      modalita === "scenario"
        ? scenario.aggiunte
            .filter((a) => a.comune === comune.istat)
            .map((a) => ({ id: a.id, tipo: a.tipo, posizione: a.posizione }))
        : []
    return [...reali, ...aggiunte].map((i) => ({ ...i, scena: proiezione.aScena(i.posizione) }))
  }, [comune, misura, modalita, scenario, proiezione])

  const s = (misura?.dimensione ?? 1) * 0.05

  // Costruisce tracciati continui e realistici per strade e piste ciclabili
  const trattiStradali = useMemo(
    () =>
      misura
        ? costruisciReteStradale({
            infra,
            anello: misura.anello,
            centro: misura.centro,
            dimensione: misura.dimensione,
            s,
          })
        : [],
    [infra, misura, s],
  )

  const seme = useMemo(
    () => [...(istat ?? "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7),
    [istat],
  )

  // Posizioni delle case (abitazioni residenziali del comune + eventuale casaUtente)
  const caseDiorama = useMemo(() => {
    if (!comune || !misura) return []
    const caseComune = dataset.caseSeed.filter((c) => c.comune === comune.istat)
    const utenteNelComune = casaUtente && casaUtente.comune === comune.istat ? casaUtente : null
    const pctFV =
      modalita === "scenario" &&
      scenario.macro &&
      (scenario.macro.ambito === "provincia" || scenario.macro.ambito === comune.istat)
        ? scenario.macro.pctFV
        : 0
    return calcolaPosizioniCase({
      anello: misura.anello,
      infra,
      trattiStradali,
      caseComune,
      casaUtente: utenteNelComune,
      pctFV,
      seme,
      s,
      dimensione: misura.dimensione,
    })
  }, [comune, misura, infra, trattiStradali, casaUtente, modalita, scenario.macro, seme, s])

  // Ostacoli completi: includono tutte le infrastrutture, le case residenziali e l'intero corridoio stradale
  const ostacoli = useMemo(
    () =>
      misura
        ? calcolaOstacoliCompleti(infra, trattiStradali, misura.dimensione, s, caseDiorama)
        : [],
    [infra, trattiStradali, misura, s, caseDiorama],
  )

  if (!attivo || !comune || !misura || !stato) return null
  const y = altezzaComune(stato.totale) + SPESSORE_TERRENO

  const clic = (e: ThreeEvent<MouseEvent>, infraColpitaId?: string) => {
    e.stopPropagation()
    const st = store.getState()
    const punto = proiezione.daScena([e.point.x, e.point.z])
    eseguiAzione(
      azioneDaClic({
        modalita: st.modalita,
        strumento: st.strumento,
        comune,
        punto,
        infraColpitaId,
      }),
    )
  }

  return (
    <group>
      {geometriaTerreno && (
        <mesh
          geometry={geometriaTerreno}
          position={[0, y - SPESSORE_TERRENO, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => clic(e)}
        >
          <meshStandardMaterial ref={materialeTerreno} color="#5f9e45" roughness={0.85} />
        </mesh>
      )}
      {/* Nastri stradali e ciclabili continui */}
      {trattiStradali.map((tratto) => (
        <TrattoStradaleMesh
          key={`tratto-${tratto.tipo}-${tratto.id}`}
          tratto={tratto}
          y={y}
          s={s}
          onClick={(e) => clic(e, tratto.id)}
        />
      ))}
      {/* Case ed edifici residenziali del comune */}
      {caseDiorama.map((casa) => (
        <CasaMesh key={`casa-${casa.id}`} casa={casa} y={y} s={s} />
      ))}
      <Alberi anello={misura.anello} seme={seme} ostacoli={ostacoli} y={y} s={s} preset={corrente} />
      <Fauna
        anello={misura.anello}
        centro={misura.centro}
        dimensione={misura.dimensione}
        y={y}
        preset={corrente}
        ostacoli={ostacoli}
        totale={stato.totale}
        aria={stato.aria}
        infrastrutture={stato.infrastrutture}
        scenario={stato.scenario}
      />
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
