import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import type { Comune, StatoComune } from "../types"
import { Diorama } from "../diorama/Diorama"
import { misuraComune } from "../diorama/misura"
import { altezzaComune } from "./altezza"
import { coloreFascia } from "./fasce"
import { creaProiezione, type Proiezione } from "./scena"

const DIMENSIONE = 24
const DISTANZA_PROVINCIA = DIMENSIONE * 1.3
const DIREZIONE_CAMERA = new THREE.Vector3(0, 0.8, 0.6).normalize()

type Hover = { istat: string; x: number; y: number } | null

function creaGeometria(c: Comune, p: Proiezione, altezza: number): {
  estrusioni: THREE.BufferGeometry[]
  bordi: THREE.BufferGeometry[]
} {
  const estrusioni: THREE.BufferGeometry[] = []
  const bordi: THREE.BufferGeometry[] = []

  for (const anello of c.geometria) {
    const pts2d = anello.map((pt) => {
      const [x, z] = p.aScena(pt)
      return new THREE.Vector2(x, -z)
    })
    const forma = new THREE.Shape(pts2d)
    estrusioni.push(
      new THREE.ExtrudeGeometry(forma, {
        depth: altezza,
        bevelEnabled: false,
      }),
    )

    // Segmenti del confine geografico lungo il perimetro superiore del comune
    const puntiBordo: THREE.Vector3[] = []
    for (let i = 0; i < pts2d.length; i++) {
      const a = pts2d[i]!
      const b = pts2d[(i + 1) % pts2d.length]!
      puntiBordo.push(new THREE.Vector3(a.x, a.y, altezza + 0.004))
      puntiBordo.push(new THREE.Vector3(b.x, b.y, altezza + 0.004))
    }
    const geomBordo = new THREE.BufferGeometry().setFromPoints(puntiBordo)
    bordi.push(geomBordo)
  }

  return { estrusioni, bordi }
}

// Base cartografica 3D della Provincia di Vicenza con tavola topografica e reticolo geografico
function BaseGeograficaVicenza({ attenuata }: { attenuata: boolean }) {
  return (
    <group position={[0, -0.02, 0]}>
      {/* Tavola topografica di supporto */}
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[DIMENSIONE * 0.76, DIMENSIONE * 0.8, 0.24, 48]} />
        <meshStandardMaterial
          color="#cbd5e1"
          roughness={0.88}
          transparent={attenuata}
          opacity={attenuata ? 0.25 : 0.85}
        />
      </mesh>
      {/* Anello bussola / cornice cartografica */}
      <mesh position={[0, -0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DIMENSIONE * 0.72, DIMENSIONE * 0.755, 64]} />
        <meshStandardMaterial
          color="#64748b"
          roughness={0.7}
          transparent={attenuata}
          opacity={attenuata ? 0.2 : 0.65}
        />
      </mesh>
    </group>
  )
}

function ComuneMesh({
  comune,
  stato,
  proiezione,
  selezionato,
  inHover,
  attenuato,
  onHover,
}: {
  comune: Comune
  stato: StatoComune
  proiezione: Proiezione
  selezionato: boolean
  inHover: boolean
  attenuato: boolean
  onHover: (h: Hover) => void
}) {
  const altezza = altezzaComune(stato.totale)
  const { estrusioni, bordi } = useMemo(
    () => creaGeometria(comune, proiezione, altezza),
    [comune, proiezione, altezza],
  )
  useEffect(
    () => () => {
      estrusioni.forEach((g) => g.dispose())
      bordi.forEach((b) => b.dispose())
    },
    [estrusioni, bordi],
  )

  const coloreBase = coloreFascia(stato.fascia)

  // Sfumatura orografica realistica (Prealpi / Altopiano a nord più roccioso-fresco, pianura a sud)
  const colore = useMemo(() => {
    const [, zCentro] = proiezione.aScena(comune.centroide)
    const fattoreNord = THREE.MathUtils.clamp(-zCentro / (DIMENSIONE * 0.5), -0.5, 0.5)
    const c = new THREE.Color(coloreBase)
    c.offsetHSL(0, 0.03, fattoreNord * 0.045)
    return c
  }, [coloreBase, comune.centroide, proiezione])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {estrusioni.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          onPointerMove={(e) => {
            e.stopPropagation()
            if (selezionato && store.getState().vista === "comune") return onHover(null)
            onHover({ istat: comune.istat, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation()
            const st = store.getState()
            if (st.vista === "comune" && st.modalita === "scenario" && st.strumento !== null) return
            st.selezionaComune(comune.istat)
          }}
        >
          <meshStandardMaterial
            color={colore}
            roughness={0.72}
            metalness={0.06}
            transparent={attenuato}
            opacity={attenuato ? 0.28 : 1}
            emissive={selezionato || inHover ? colore : "#000000"}
            emissiveIntensity={selezionato ? 0.35 : inHover ? 0.22 : 0}
          />
        </mesh>
      ))}
      {/* Confini geografici reali dei comuni vicentini */}
      {bordi.map((b, i) => (
        <lineSegments key={`b-${i}`} geometry={b}>
          <lineBasicMaterial
            color={selezionato || inHover ? "#ffffff" : "#1e293b"}
            transparent
            opacity={attenuato ? 0.15 : selezionato || inHover ? 0.95 : 0.42}
          />
        </lineSegments>
      ))}
    </group>
  )
}

// Zoom animato verso il comune selezionato (o ritorno alla provincia)
function RigCamera({ proiezione }: { proiezione: Proiezione }) {
  const vista = useApp((s) => s.vista)
  const selezionato = useApp((s) => s.comuneSelezionato)
  const controlli = useThree((s) => s.controls) as { target: THREE.Vector3; update(): void } | null
  const camera = useThree((s) => s.camera)
  const fine = useRef(0)
  const mira = useRef({ target: new THREE.Vector3(), distanza: DISTANZA_PROVINCIA })

  useEffect(() => {
    const c = dataset.comuni.find((x) => x.istat === selezionato)
    if (vista === "comune" && c) {
      const [x, z] = proiezione.aScena(c.centroide)
      const dim = misuraComune(c, proiezione).dimensione
      mira.current = { target: new THREE.Vector3(x, 0, z), distanza: Math.max(dim * 1.7, 2.5) }
    } else {
      mira.current = { target: new THREE.Vector3(0, 0, 0), distanza: DISTANZA_PROVINCIA }
    }
    fine.current = performance.now() + 1400
  }, [vista, selezionato, proiezione])

  useFrame(() => {
    if (!controlli || performance.now() > fine.current) return
    const { target, distanza } = mira.current
    controlli.target.lerp(target, 0.08)
    camera.position.lerp(target.clone().addScaledVector(DIREZIONE_CAMERA, distanza), 0.08)
    controlli.update()
  })
  return null
}

export function Provincia() {
  const indici = useIndici()
  const selezionato = useApp((s) => s.comuneSelezionato)
  const vista = useApp((s) => s.vista)
  const proiezione = useMemo(() => creaProiezione(dataset.comuni, DIMENSIONE), [])
  const [hover, setHover] = useState<Hover>(null)
  const comuneHover = hover && dataset.comuni.find((c) => c.istat === hover.istat)
  const statoHover = hover && indici[hover.istat]

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{
          position: DIREZIONE_CAMERA.clone().multiplyScalar(DISTANZA_PROVINCIA).toArray(),
          fov: 45,
          near: 0.1,
          far: 500,
        }}
        style={{ background: "var(--sfondo-mappa)" }}
        onPointerMissed={() => setHover(null)}
      >
        <hemisphereLight args={["#f0f7ff", "#3a4f41", 0.65]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[12, 24, 10]} intensity={1.35} />
        <directionalLight position={[-10, 12, -8]} intensity={0.35} />
        <OrbitControls
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI / 2.15}
          minDistance={1.8}
          maxDistance={60}
        />
        <RigCamera proiezione={proiezione} />
        <BaseGeograficaVicenza attenuata={vista === "comune"} />
        <Diorama proiezione={proiezione} />
        {dataset.comuni.map((c) => {
          const stato = indici[c.istat]
          if (!stato) return null
          return (
            <ComuneMesh
              key={c.istat}
              comune={c}
              stato={stato}
              proiezione={proiezione}
              selezionato={selezionato === c.istat}
              inHover={hover?.istat === c.istat}
              attenuato={vista === "comune" && selezionato !== c.istat}
              onHover={setHover}
            />
          )
        })}
      </Canvas>
      {hover && comuneHover && statoHover && (
        <div
          style={{
            position: "fixed",
            left: hover.x + 14,
            top: hover.y + 14,
            pointerEvents: "none",
            background: "rgba(15, 23, 42, 0.94)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{comuneHover.nome}</div>
          <div style={{ opacity: 0.9, fontSize: 12 }}>
            Indice <strong>{Math.round(statoHover.totale)}</strong>/100 ({statoHover.fascia}) · PM10{" "}
            {comuneHover.pm10.toFixed(1)} µg/m³
          </div>
        </div>
      )}
    </div>
  )
}
