import { ContactShadows, OrbitControls } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"
import type { Dotazioni } from "../types"
import { descriviCasa, type VistaCasa } from "./vista"

const LARGHEZZA = 4 // lungo X
const PROFONDITA = 3 // lungo Z
const ALTEZZA_MURI = 2.1
const ALTEZZA_TETTO = 1.25
const SEMILUNGHEZZA_FALDA = Math.hypot(PROFONDITA / 2 + 0.2, ALTEZZA_TETTO)
const ANGOLO_TETTO = Math.atan2(ALTEZZA_TETTO, PROFONDITA / 2 + 0.2)

// Fa comparire (e sparire) i figli con una piccola molla invece di un taglio netto.
function Apparizione({ visibile, children, posizione }: { visibile: boolean; children: ReactNode; posizione?: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  const scala = useRef(visibile ? 1 : 0)
  const velocita = useRef(0)
  useFrame((_, dt) => {
    const obiettivo = visibile ? 1 : 0
    const passo = Math.min(dt, 0.05)
    velocita.current += ((obiettivo - scala.current) * 180 - velocita.current * 14) * passo
    scala.current += velocita.current * passo
    if (Math.abs(obiettivo - scala.current) < 0.001 && Math.abs(velocita.current) < 0.01) scala.current = obiettivo
    const s = Math.max(scala.current, 0.0001)
    g.current?.scale.setScalar(s)
    if (g.current) g.current.visible = scala.current > 0.002
  })
  return <group ref={g} position={posizione} scale={visibile ? 1 : 0.0001}>{children}</group>
}

function texturaMattoni() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const x = c.getContext("2d")!
  x.fillStyle = "#c9b8a6"; x.fillRect(0, 0, 256, 256)
  const colori = ["#b4553c", "#a84a33", "#bd6247", "#a14430"]
  for (let r = 0; r < 12; r++) for (let k = 0; k < 6; k++) {
    x.fillStyle = colori[(r * 7 + k * 3) % colori.length]!
    const dx = (r % 2) * 21
    x.fillRect(k * 42.6 - dx + 2, r * 21.3 + 2, 38.6, 17.3)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.repeat.set(2, 1)
  return t
}

const COLORE_RIVESTIMENTO = { mattone: "#ffffff", intonaco: "#eadfc8", cappotto: "#fbfbf8" } as const
const SPESSORE_RIVESTIMENTO = { mattone: -0.02, intonaco: 0.015, cappotto: 0.09 } as const

function Pareti({ rivestimento }: { rivestimento: VistaCasa["rivestimento"] }) {
  const tex = useMemo(texturaMattoni, [])
  const strato = useRef<THREE.Mesh>(null)
  const matStrato = useRef<THREE.MeshStandardMaterial>(null)
  const spessore = useRef(SPESSORE_RIVESTIMENTO[rivestimento])
  const colore = useMemo(() => new THREE.Color(COLORE_RIVESTIMENTO[rivestimento]), [])
  useFrame((_, dt) => {
    const f = 1 - Math.exp(-6 * Math.min(dt, 0.05))
    spessore.current += (SPESSORE_RIVESTIMENTO[rivestimento] - spessore.current) * f
    colore.lerp(new THREE.Color(COLORE_RIVESTIMENTO[rivestimento]), f)
    strato.current?.scale.set(
      1 + (2 * spessore.current) / LARGHEZZA, 1 + (2 * spessore.current) / ALTEZZA_MURI, 1 + (2 * spessore.current) / PROFONDITA,
    )
    matStrato.current?.color.copy(colore)
  })
  return (
    <>
      <mesh position={[0, ALTEZZA_MURI / 2, 0]} castShadow>
        <boxGeometry args={[LARGHEZZA, ALTEZZA_MURI, PROFONDITA]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <mesh ref={strato} position={[0, ALTEZZA_MURI / 2, 0]} castShadow>
        <boxGeometry args={[LARGHEZZA, ALTEZZA_MURI, PROFONDITA]} />
        <meshStandardMaterial ref={matStrato} color={COLORE_RIVESTIMENTO[rivestimento]} roughness={0.95} />
      </mesh>
    </>
  )
}

function Tetto() {
  const geo = useMemo(() => {
    const mezza = PROFONDITA / 2 + 0.2
    const forma = new THREE.Shape([new THREE.Vector2(-mezza, 0), new THREE.Vector2(mezza, 0), new THREE.Vector2(0, ALTEZZA_TETTO)])
    const g = new THREE.ExtrudeGeometry(forma, { depth: LARGHEZZA + 0.5, bevelEnabled: false })
    g.translate(0, 0, -(LARGHEZZA + 0.5) / 2)
    g.rotateY(Math.PI / 2) // il colmo corre lungo X
    return g
  }, [])
  return (
    <mesh geometry={geo} position={[0, ALTEZZA_MURI, 0]} castShadow>
      <meshStandardMaterial color="#9c4a35" roughness={0.8} flatShading />
    </mesh>
  )
}

// Un punto sulla falda anteriore (verso +z): s = distanza dalla gronda lungo la falda, x = posizione sul colmo.
function suFalda(x: number, s: number, fuori = 0.05): { posizione: [number, number, number] } {
  const mezza = PROFONDITA / 2 + 0.2
  const dirZ = -mezza / SEMILUNGHEZZA_FALDA, dirY = ALTEZZA_TETTO / SEMILUNGHEZZA_FALDA
  const nz = dirY, ny = mezza / SEMILUNGHEZZA_FALDA // normale uscente
  return { posizione: [x, ALTEZZA_MURI + dirY * s + ny * fuori, mezza + dirZ * s + nz * fuori] }
}

function PannelliFV() {
  const pezzi = [] as ReactNode[]
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const { posizione } = suFalda(0.35 + c * 0.82, 0.38 + r * 0.6)
    pezzi.push(
      <group key={`${r}${c}`} position={posizione} rotation={[ANGOLO_TETTO, 0, 0]}>
        <mesh castShadow><boxGeometry args={[0.76, 0.05, 0.54]} /><meshStandardMaterial color="#1b3a6b" metalness={0.6} roughness={0.25} /></mesh>
        <mesh position={[0, 0.03, 0]}><boxGeometry args={[0.7, 0.005, 0.48]} /><meshStandardMaterial color="#274f8f" metalness={0.5} roughness={0.2} emissive="#16335f" emissiveIntensity={0.35} /></mesh>
      </group>,
    )
  }
  return <>{pezzi}</>
}

function SolareTermico() {
  const { posizione } = suFalda(-1.1, 0.55)
  const serbatoio = suFalda(-1.1, 1.18, 0.14)
  return (
    <>
      <group position={posizione} rotation={[ANGOLO_TETTO, 0, 0]}>
        <mesh castShadow><boxGeometry args={[1.05, 0.06, 0.8]} /><meshStandardMaterial color="#23707a" metalness={0.4} roughness={0.3} /></mesh>
        {[-0.35, -0.12, 0.12, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.04, 0]}><boxGeometry args={[0.05, 0.02, 0.72]} /><meshStandardMaterial color="#e0a23a" /></mesh>
        ))}
      </group>
      <mesh position={serbatoio.posizione} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.8, 16]} /><meshStandardMaterial color="#e8ecef" metalness={0.3} roughness={0.4} />
      </mesh>
    </>
  )
}

function Fumo({ colore, quanto, ritmo }: { colore: string; quanto: number; ritmo: number }) {
  const sfere = useRef<(THREE.Mesh | null)[]>([])
  const N = 7
  useFrame(({ clock }) => {
    sfere.current.forEach((m, i) => {
      if (!m) return
      const t = ((clock.elapsedTime * ritmo + i / N) % 1)
      m.position.set(Math.sin(t * 5 + i) * 0.09 * t, t * 1.1, 0)
      m.scale.setScalar((0.07 + t * 0.2) * quanto)
      ;(m.material as THREE.MeshStandardMaterial).opacity = (1 - t) * 0.65
    })
  })
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { sfere.current[i] = m }}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={colore} transparent opacity={0.5} flatShading depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

function Camino({ tipo }: { tipo: "caldaia_condensazione" | "caldaia_tradizionale" }) {
  const scuro = tipo === "caldaia_tradizionale"
  return (
    <group position={[1.3, ALTEZZA_MURI + 0.55, -0.35]}>
      <mesh castShadow><boxGeometry args={[0.32, 1.0, 0.32]} /><meshStandardMaterial color={scuro ? "#6b4a3d" : "#b9bfc4"} roughness={0.8} /></mesh>
      <mesh position={[0, 0.54, 0]}><boxGeometry args={[0.42, 0.08, 0.42]} /><meshStandardMaterial color="#4a4a4a" /></mesh>
      <group position={[0, 0.6, 0]}>
        <Fumo colore={scuro ? "#3a3a3d" : "#f4f7f9"} quanto={scuro ? 1.3 : 0.8} ritmo={scuro ? 0.45 : 0.3} />
      </group>
    </group>
  )
}

function PompaDiCalore() {
  const ventola = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ventola.current) ventola.current.rotation.z += dt * 9 })
  return (
    <group position={[LARGHEZZA / 2 + 0.55, 0.38, 0.35]}>
      <mesh castShadow><boxGeometry args={[0.5, 0.76, 0.95]} /><meshStandardMaterial color="#e6eaed" roughness={0.5} metalness={0.2} /></mesh>
      <group position={[0.26, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh><ringGeometry args={[0.2, 0.28, 24]} /><meshStandardMaterial color="#2d3a44" side={THREE.DoubleSide} /></mesh>
        <group ref={ventola}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0.005]}>
              <boxGeometry args={[0.04, 0.4, 0.01]} /><meshStandardMaterial color="#546e7a" />
            </mesh>
          ))}
        </group>
      </group>
      <mesh position={[-0.25, 0.1, 0.5]}><cylinderGeometry args={[0.035, 0.035, 0.5, 8]} /><meshStandardMaterial color="#b0b6bb" /></mesh>
      <mesh position={[0.26, 0.3, -0.32]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#35c46a" emissive="#35c46a" emissiveIntensity={1} /></mesh>
    </group>
  )
}

function Finestra({ posizione, rotazione = 0, vetri }: { posizione: [number, number, number]; rotazione?: number; vetri: "semplici" | "doppi" }) {
  const doppi = vetri === "doppi"
  const telaio = doppi ? "#2f3b45" : "#f1efe9"
  const sp = doppi ? 0.07 : 0.035
  return (
    <group position={posizione} rotation={[0, rotazione, 0]}>
      <mesh><boxGeometry args={[0.8, 0.72, sp]} /><meshStandardMaterial color={telaio} roughness={0.5} /></mesh>
      <mesh position={[0, 0, sp / 2 + 0.002]}>
        <planeGeometry args={[0.66, 0.58]} />
        <meshStandardMaterial color={doppi ? "#7fc4ea" : "#cfe6f1"} metalness={doppi ? 0.85 : 0.1} roughness={doppi ? 0.08 : 0.3} transparent opacity={doppi ? 0.92 : 0.7} emissive={doppi ? "#2b86b8" : "#000000"} emissiveIntensity={doppi ? 0.25 : 0} />
      </mesh>
      <mesh position={[0, 0, sp / 2 + 0.004]}><boxGeometry args={[0.03, 0.58, 0.01]} /><meshStandardMaterial color={telaio} /></mesh>
      {doppi && <mesh position={[0, 0, sp / 2 + 0.03]}><planeGeometry args={[0.66, 0.58]} /><meshStandardMaterial color="#9fd6f3" metalness={0.8} roughness={0.1} transparent opacity={0.35} /></mesh>}
    </group>
  )
}

function Facciata({ rivestimento, vetri }: Pick<VistaCasa, "rivestimento" | "vetri">) {
  const z = PROFONDITA / 2 + SPESSORE_RIVESTIMENTO[rivestimento] + 0.02
  return (
    <>
      <Finestra posizione={[-1.2, 1.25, z]} vetri={vetri} />
      <Finestra posizione={[1.2, 1.25, z]} vetri={vetri} />
      <Finestra posizione={[0, 1.2, -z]} rotazione={Math.PI} vetri={vetri} />
      <Finestra posizione={[LARGHEZZA / 2 + SPESSORE_RIVESTIMENTO[rivestimento] + 0.02, 1.25, -0.5]} rotazione={Math.PI / 2} vetri={vetri} />
      <group position={[0, 0.78, z]}>
        <mesh><boxGeometry args={[0.62, 1.5, 0.06]} /><meshStandardMaterial color="#5a3e2b" roughness={0.7} /></mesh>
        <mesh position={[0.2, 0, 0.04]}><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color="#d6b25e" metalness={0.8} roughness={0.3} /></mesh>
      </group>
    </>
  )
}

function BombolaGas() {
  return (
    <group position={[-LARGHEZZA / 2 - 0.4, 0, 0.7]}>
      <mesh position={[0, 0.34, 0]} castShadow><cylinderGeometry args={[0.17, 0.17, 0.68, 14]} /><meshStandardMaterial color="#d9532e" roughness={0.45} metalness={0.2} /></mesh>
      <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.1, 10, 10]} /><meshStandardMaterial color="#d9532e" /></mesh>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.035, 0.035, 0.1, 8]} /><meshStandardMaterial color="#9aa1a6" metalness={0.7} /></mesh>
    </group>
  )
}

function PianoInduzione() {
  const anelli = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    anelli.current?.children.forEach((m, i) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.7 + 0.5 * Math.sin(clock.elapsedTime * 2 + i * 1.5)
    })
  })
  return (
    <group position={[-LARGHEZZA / 2 - 0.45, 0, 0.7]}>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.7, 0.6, 0.5]} /><meshStandardMaterial color="#d8dde1" roughness={0.6} /></mesh>
      <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.72, 0.04, 0.52]} /><meshStandardMaterial color="#14181c" metalness={0.5} roughness={0.15} /></mesh>
      <group ref={anelli} position={[0, 0.65, 0]}>
        {[-0.17, 0.17].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.11, 24]} /><meshStandardMaterial color="#4fc3f7" emissive="#29b6f6" emissiveIntensity={1} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Auto() {
  const ruote = [[-0.42, 0.55], [0.42, 0.55], [-0.42, -0.55], [0.42, -0.55]] as const
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.8, 0.28, 1.5]} /><meshStandardMaterial color="#2f7bd6" metalness={0.5} roughness={0.3} /></mesh>
      <mesh position={[0, 0.54, -0.05]}><boxGeometry args={[0.68, 0.24, 0.8]} /><meshStandardMaterial color="#8ec5f2" metalness={0.7} roughness={0.15} /></mesh>
      {ruote.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.16, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.16, 0.16, 0.1, 14]} /><meshStandardMaterial color="#1c1f22" /></mesh>
      ))}
    </group>
  )
}

function ColonninaEV() {
  const led = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = led.current?.material as THREE.MeshStandardMaterial | undefined
    if (m) m.emissiveIntensity = 0.8 + 0.7 * Math.sin(clock.elapsedTime * 3)
  })
  return (
    <group position={[1.1, 0, PROFONDITA / 2 + 1.1]} rotation={[0, 0.1, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.24, 1.1, 0.2]} /><meshStandardMaterial color="#f4f6f8" roughness={0.4} /></mesh>
      <mesh position={[0, 0.85, 0.105]}><boxGeometry args={[0.16, 0.22, 0.01]} /><meshStandardMaterial color="#12161a" /></mesh>
      <mesh ref={led} position={[0, 0.98, 0.112]}><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color="#3fd0ff" emissive="#3fd0ff" emissiveIntensity={1} /></mesh>
      <mesh position={[0.35, 0.3, 0.1]} rotation={[0, 0, Math.PI / 2.4]}><torusGeometry args={[0.4, 0.014, 6, 20, Math.PI / 1.4]} /><meshStandardMaterial color="#222" /></mesh>
      <group position={[1.1, 0, 0.3]} rotation={[0, Math.PI / 2 + 0.1, 0]}><Auto /></group>
    </group>
  )
}

function Albero({ posizione, scala = 1 }: { posizione: [number, number, number]; scala?: number }) {
  return (
    <group position={posizione} scale={scala}>
      <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.07, 0.1, 0.6, 6]} /><meshStandardMaterial color="#6d4c41" /></mesh>
      <mesh position={[0, 0.95, 0]} castShadow><coneGeometry args={[0.42, 1.0, 7]} /><meshStandardMaterial color="#3f8f4a" flatShading /></mesh>
      <mesh position={[0, 1.4, 0]} castShadow><coneGeometry args={[0.3, 0.7, 7]} /><meshStandardMaterial color="#4aa055" flatShading /></mesh>
    </group>
  )
}

function Scena({ vista }: { vista: VistaCasa }) {
  const casa = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (casa.current) casa.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.04 })
  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#dff1ff", "#6c8f5a", 0.45]} />
      <directionalLight position={[6, 9, 5]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <group ref={casa}>
        {/* piattaforma a diorama */}
        <mesh position={[0, -0.18, 0]} receiveShadow><cylinderGeometry args={[5.2, 5.4, 0.36, 48]} /><meshStandardMaterial color="#6fae5a" roughness={1} flatShading /></mesh>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[5.4, 4.9, 0.3, 48]} /><meshStandardMaterial color="#8a6a4f" roughness={1} flatShading /></mesh>
        <mesh position={[0, 0.005, PROFONDITA / 2 + 1.25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[3.4, 2.2]} /><meshStandardMaterial color="#cfc8bb" roughness={1} /></mesh>
        <Albero posizione={[-3.4, 0, -1.6]} scala={1.2} />
        <Albero posizione={[3.6, 0, -2.2]} />
        <Albero posizione={[-3.8, 0, 2.2]} scala={0.9} />

        <Pareti rivestimento={vista.rivestimento} />
        <Tetto />
        <Facciata rivestimento={vista.rivestimento} vetri={vista.vetri} />

        <Apparizione visibile={vista.pannelliFV}><PannelliFV /></Apparizione>
        <Apparizione visibile={vista.collettoreSolare}><SolareTermico /></Apparizione>
        <Apparizione visibile={vista.impiantoTermico === "pompa_calore"}><PompaDiCalore /></Apparizione>
        <Apparizione visibile={vista.impiantoTermico === "caldaia_condensazione"}><Camino tipo="caldaia_condensazione" /></Apparizione>
        <Apparizione visibile={vista.impiantoTermico === "caldaia_tradizionale"}><Camino tipo="caldaia_tradizionale" /></Apparizione>
        <Apparizione visibile={vista.cottura === "gas"}><BombolaGas /></Apparizione>
        <Apparizione visibile={vista.cottura === "induzione"}><PianoInduzione /></Apparizione>
        <Apparizione visibile={vista.colonnina}><ColonninaEV /></Apparizione>
      </group>
      <ContactShadows position={[0, -0.66, 0]} opacity={0.35} scale={14} blur={2.4} far={2.2} />
    </>
  )
}

export function Casa3D({ dotazioni }: { dotazioni: Dotazioni }) {
  const vista = useMemo(() => descriviCasa(dotazioni), [dotazioni])
  return (
    <Canvas shadows camera={{ position: [7.5, 5.2, 8.5], fov: 38 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
      <Scena vista={vista} />
      <OrbitControls autoRotate autoRotateSpeed={1.1} enablePan={false} minDistance={7} maxDistance={17} minPolarAngle={0.5} maxPolarAngle={Math.PI / 2.1} target={[0, 1, 0]} />
    </Canvas>
  )
}
