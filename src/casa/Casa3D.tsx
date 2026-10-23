import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"
import type { Alimentazione, Classe, Dotazioni } from "../types"
import { meteoDaClasse, type Meteo } from "./meteo"
import { descriviCasa, type VistaCasa } from "./vista"
import { punteggioCasa } from "../engine"

// Volume principale, ala laterale (garage) e tetto.
const W = 3.6, D = 3, H = 2.1
const ALA = { w: 1.7, d: 2.4, h: 1.45, x: -2.65 }
const ALTEZZA_TETTO = 1.25
const MEZZA = D / 2 + 0.22
const LUNGHEZZA_FALDA = Math.hypot(MEZZA, ALTEZZA_TETTO)
const ANGOLO_TETTO = Math.atan2(ALTEZZA_TETTO, MEZZA)

// ───────────────────────── texture procedurali (una sola volta) ─────────────────────────
function canvasTexture(disegna: (x: CanvasRenderingContext2D) => void, ripeti: [number, number]) {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  disegna(c.getContext("2d")!)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.repeat.set(...ripeti)
  return t
}
const texMattoni = () => canvasTexture((x) => {
  x.fillStyle = "#cdbfae"; x.fillRect(0, 0, 256, 256)
  const col = ["#b4553c", "#a84a33", "#bd6247", "#a14430", "#b65a41"]
  for (let r = 0; r < 12; r++) for (let k = 0; k < 7; k++) {
    x.fillStyle = col[(r * 7 + k * 3) % col.length]!
    x.fillRect(k * 37 - (r % 2) * 18 + 2, r * 21.3 + 2, 33, 17.5)
  }
}, [2, 1])
const texIntonaco = () => canvasTexture((x) => {
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2200; i++) {
    const v = 232 + Math.random() * 23
    x.fillStyle = `rgb(${v},${v},${v - 3})`
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
}, [3, 2])
const texTegole = () => canvasTexture((x) => {
  x.fillStyle = "#6e2f20"; x.fillRect(0, 0, 256, 256)
  for (let r = 0; r < 10; r++) for (let k = 0; k < 9; k++) {
    const l = 38 + ((r * 5 + k * 3) % 4) * 5
    x.fillStyle = `hsl(14,52%,${l}%)`
    x.beginPath()
    x.roundRect(k * 28.4 - (r % 2) * 14 + 1, r * 25.6 + 1, 26.4, 23.6, [3, 3, 11, 11])
    x.fill()
  }
}, [2, 1.4])
const texCelle = () => canvasTexture((x) => {
  x.fillStyle = "#16346a"; x.fillRect(0, 0, 256, 256)
  x.strokeStyle = "#5f86c4"; x.lineWidth = 2
  for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke() }
  x.strokeStyle = "#9fb8e0"; x.lineWidth = 1
  for (let i = 16; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke() }
}, [1, 1])

// ───────────────────────── animazione di comparsa ─────────────────────────
function Apparizione({ visibile, children }: { visibile: boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const scala = useRef(visibile ? 1 : 0)
  const velocita = useRef(0)
  useFrame((_, dt) => {
    const obiettivo = visibile ? 1 : 0
    const passo = Math.min(dt, 0.05)
    velocita.current += ((obiettivo - scala.current) * 180 - velocita.current * 14) * passo
    scala.current += velocita.current * passo
    if (Math.abs(obiettivo - scala.current) < 0.001 && Math.abs(velocita.current) < 0.01) scala.current = obiettivo
    g.current?.scale.setScalar(Math.max(scala.current, 0.0001))
    if (g.current) g.current.visible = scala.current > 0.002
  })
  return <group ref={g} scale={visibile ? 1 : 0.0001}>{children}</group>
}

// ───────────────────────── struttura ─────────────────────────
const COLORE_RIV = { mattone: "#ffffff", intonaco: "#ece2cc", cappotto: "#fbfbf8" } as const
const SPESS_RIV = { mattone: -0.02, intonaco: 0.015, cappotto: 0.09 } as const

// Un volume di pareti: mattoni sotto, rivestimento sopra (sottile con intonaco, spesso col cappotto).
function Volume({ w, h, d, x, z = 0, rivestimento }: { w: number; h: number; d: number; x: number; z?: number; rivestimento: VistaCasa["rivestimento"] }) {
  const mattoni = useMemo(texMattoni, [])
  const grana = useMemo(texIntonaco, [])
  const strato = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const spessore = useRef(SPESS_RIV[rivestimento])
  const colore = useMemo(() => new THREE.Color(COLORE_RIV[rivestimento]), [])
  useFrame((_, dt) => {
    const f = 1 - Math.exp(-6 * Math.min(dt, 0.05))
    spessore.current += (SPESS_RIV[rivestimento] - spessore.current) * f
    colore.lerp(new THREE.Color(COLORE_RIV[rivestimento]), f)
    strato.current?.scale.set(1 + (2 * spessore.current) / w, 1 + (2 * spessore.current) / h, 1 + (2 * spessore.current) / d)
    mat.current?.color.copy(colore)
  })
  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow receiveShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial map={mattoni} roughness={0.9} /></mesh>
      <mesh ref={strato} castShadow receiveShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial ref={mat} map={grana} color={COLORE_RIV[rivestimento]} roughness={0.95} /></mesh>
      {/* zoccolo */}
      <mesh position={[0, -h / 2 + 0.07, 0]}><boxGeometry args={[w + 0.08 + SPESS_RIV[rivestimento] * 2, 0.14, d + 0.08 + SPESS_RIV[rivestimento] * 2]} /><meshStandardMaterial color="#8d8a85" roughness={1} /></mesh>
    </group>
  )
}

function Tetto() {
  const tegole = useMemo(texTegole, [])
  const geo = useMemo(() => {
    const forma = new THREE.Shape([new THREE.Vector2(-MEZZA, 0), new THREE.Vector2(MEZZA, 0), new THREE.Vector2(0, ALTEZZA_TETTO)])
    const g = new THREE.ExtrudeGeometry(forma, { depth: W + 0.6, bevelEnabled: false })
    g.translate(0, 0, -(W + 0.6) / 2)
    g.rotateY(Math.PI / 2)
    return g
  }, [])
  return (
    <group position={[0, H, 0]}>
      <mesh geometry={geo} castShadow receiveShadow><meshStandardMaterial map={tegole} roughness={0.75} /></mesh>
      <mesh position={[0, ALTEZZA_TETTO + 0.02, 0]} castShadow><boxGeometry args={[W + 0.66, 0.1, 0.22]} /><meshStandardMaterial color="#5a2418" roughness={0.7} /></mesh>
      {/* gronde */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.02, s * (MEZZA + 0.01)]}><boxGeometry args={[W + 0.62, 0.07, 0.07]} /><meshStandardMaterial color="#f1ece2" /></mesh>
      ))}
    </group>
  )
}

function TettoAla() {
  const tegole = useMemo(texTegole, [])
  const inclin = 0.16
  return (
    <group position={[ALA.x, ALA.h + 0.06, 0]} rotation={[inclin, 0, 0]}>
      <mesh castShadow receiveShadow><boxGeometry args={[ALA.w + 0.4, 0.14, ALA.d + 0.5]} /><meshStandardMaterial map={tegole} roughness={0.8} /></mesh>
    </group>
  )
}

// Punto sulla falda anteriore: x sul colmo, s = distanza dalla gronda lungo la falda.
function suFalda(x: number, s: number, fuori = 0.05): [number, number, number] {
  const dirZ = -MEZZA / LUNGHEZZA_FALDA, dirY = ALTEZZA_TETTO / LUNGHEZZA_FALDA
  return [x, H + dirY * s + (MEZZA / LUNGHEZZA_FALDA) * fuori, MEZZA + dirZ * s + dirY * fuori]
}

// ───────────────────────── infissi, porta e dettagli ─────────────────────────
function Finestra({ posizione, rotazione = 0, vetri, persiane = true }: { posizione: [number, number, number]; rotazione?: number; vetri: "semplici" | "doppi"; persiane?: boolean }) {
  const doppi = vetri === "doppi"
  const telaio = doppi ? "#2f3b45" : "#f1efe9"
  const sp = doppi ? 0.075 : 0.04
  return (
    <group position={posizione} rotation={[0, rotazione, 0]}>
      <mesh><boxGeometry args={[0.8, 0.74, sp]} /><meshStandardMaterial color={telaio} roughness={0.5} /></mesh>
      <mesh position={[0, 0, sp / 2 + 0.002]}>
        <planeGeometry args={[0.66, 0.6]} />
        <meshStandardMaterial color={doppi ? "#7fc4ea" : "#cfe6f1"} metalness={doppi ? 0.85 : 0.1} roughness={doppi ? 0.08 : 0.3} transparent opacity={doppi ? 0.92 : 0.72} emissive={doppi ? "#2b86b8" : "#000"} emissiveIntensity={doppi ? 0.25 : 0} />
      </mesh>
      <mesh position={[0, 0, sp / 2 + 0.006]}><boxGeometry args={[0.03, 0.6, 0.012]} /><meshStandardMaterial color={telaio} /></mesh>
      <mesh position={[0, 0, sp / 2 + 0.006]}><boxGeometry args={[0.66, 0.03, 0.012]} /><meshStandardMaterial color={telaio} /></mesh>
      {doppi && <mesh position={[0, 0, sp / 2 + 0.03]}><planeGeometry args={[0.66, 0.6]} /><meshStandardMaterial color="#9fd6f3" metalness={0.8} roughness={0.1} transparent opacity={0.3} /></mesh>}
      <mesh position={[0, -0.41, 0.07]}><boxGeometry args={[0.94, 0.05, 0.16]} /><meshStandardMaterial color="#d9d3c6" /></mesh>
      {persiane && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.5, 0, 0.045]} rotation={[0, -s * 0.5, 0]}><boxGeometry args={[0.24, 0.72, 0.03]} /><meshStandardMaterial color="#4d7a64" roughness={0.8} /></mesh>
      ))}
    </group>
  )
}

function Facciata({ rivestimento, vetri }: Pick<VistaCasa, "rivestimento" | "vetri">) {
  const s = SPESS_RIV[rivestimento]
  const z = D / 2 + s + 0.02
  const tettoia = H * 0.78
  return (
    <>
      <Finestra posizione={[-1.2, 1.3, z]} vetri={vetri} />
      <Finestra posizione={[1.2, 1.3, z]} vetri={vetri} />
      <Finestra posizione={[-0.7, 1.2, -z]} rotazione={Math.PI} vetri={vetri} />
      <Finestra posizione={[0.7, 1.2, -z]} rotazione={Math.PI} vetri={vetri} />
      <Finestra posizione={[W / 2 + s + 0.02, 1.3, -0.45]} rotazione={Math.PI / 2} vetri={vetri} />
      {/* porta con tettoia e gradino */}
      <group position={[0, 0, z]}>
        <mesh position={[0, 0.78, 0]}><boxGeometry args={[0.7, 1.56, 0.07]} /><meshStandardMaterial color="#5a3e2b" roughness={0.65} /></mesh>
        <mesh position={[0, 1.05, 0.04]}><boxGeometry args={[0.46, 0.5, 0.012]} /><meshStandardMaterial color="#6b4a35" /></mesh>
        <mesh position={[0.24, 0.8, 0.06]}><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color="#d6b25e" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, tettoia, 0.3]} rotation={[0.22, 0, 0]} castShadow><boxGeometry args={[1.25, 0.07, 0.75]} /><meshStandardMaterial color="#9c4a35" roughness={0.8} /></mesh>
        {[-0.55, 0.55].map((x) => <mesh key={x} position={[x, tettoia / 2 + 0.05, 0.6]}><cylinderGeometry args={[0.03, 0.03, tettoia - 0.1, 8]} /><meshStandardMaterial color="#f1ece2" /></mesh>)}
        <mesh position={[0, 0.05, 0.32]}><boxGeometry args={[1.0, 0.1, 0.45]} /><meshStandardMaterial color="#b9b3a8" roughness={1} /></mesh>
        <mesh position={[0.62, 1.45, 0.07]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#fff2b8" emissive="#ffe27a" emissiveIntensity={0.5} /></mesh>
      </group>
      {/* ala garage con portone */}
      <group position={[ALA.x + 0.0, 0, ALA.d / 2 + (s > 0 ? s : 0) + 0.02]}>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[1.15, 1.1, 0.06]} /><meshStandardMaterial color="#d8dcde" roughness={0.5} metalness={0.2} /></mesh>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((y) => <mesh key={y} position={[0, y, 0.035]}><boxGeometry args={[1.12, 0.012, 0.01]} /><meshStandardMaterial color="#9aa2a8" /></mesh>)}
      </group>
    </>
  )
}

// ───────────────────────── dotazioni ─────────────────────────
function PannelliFV() {
  const celle = useMemo(texCelle, [])
  const pezzi: ReactNode[] = []
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    pezzi.push(
      <group key={`${r}${c}`} position={suFalda(0.4 + c * 0.84, 0.4 + r * 0.62)} rotation={[ANGOLO_TETTO, 0, 0]}>
        <mesh castShadow><boxGeometry args={[0.8, 0.045, 0.58]} /><meshStandardMaterial color="#c9ced3" metalness={0.7} roughness={0.35} /></mesh>
        <mesh position={[0, 0.024, 0]}><boxGeometry args={[0.74, 0.004, 0.52]} /><meshStandardMaterial map={celle} metalness={0.55} roughness={0.2} emissive="#102a55" emissiveIntensity={0.4} /></mesh>
      </group>,
    )
  }
  return <>{pezzi}</>
}

function SolareTermico() {
  return (
    <>
      <group position={suFalda(-1.15, 0.55)} rotation={[ANGOLO_TETTO, 0, 0]}>
        <mesh castShadow><boxGeometry args={[1.05, 0.06, 0.8]} /><meshStandardMaterial color="#c9ced3" metalness={0.6} roughness={0.35} /></mesh>
        <mesh position={[0, 0.034, 0]}><boxGeometry args={[0.96, 0.006, 0.7]} /><meshStandardMaterial color="#1f5e68" metalness={0.5} roughness={0.25} /></mesh>
        {[-0.36, -0.12, 0.12, 0.36].map((x) => <mesh key={x} position={[x, 0.04, 0]}><boxGeometry args={[0.04, 0.01, 0.66]} /><meshStandardMaterial color="#e0a23a" /></mesh>)}
      </group>
      <mesh position={suFalda(-1.15, 1.2, 0.16)} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.85, 18]} /><meshStandardMaterial color="#eef1f3" metalness={0.3} roughness={0.35} />
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
      const t = (clock.elapsedTime * ritmo + i / N) % 1
      m.position.set(Math.sin(t * 5 + i) * 0.09 * t, t * 1.1, 0)
      m.scale.setScalar((0.07 + t * 0.2) * quanto)
      ;(m.material as THREE.MeshStandardMaterial).opacity = (1 - t) * 0.65
    })
  })
  return <>{Array.from({ length: N }, (_, i) => (
    <mesh key={i} ref={(m) => { sfere.current[i] = m }}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={colore} transparent opacity={0.5} depthWrite={false} /></mesh>
  ))}</>
}

function Camino({ tipo }: { tipo: "caldaia_condensazione" | "caldaia_tradizionale" }) {
  const scuro = tipo === "caldaia_tradizionale"
  return (
    <group position={[1.15, H + 0.62, -0.35]}>
      <mesh castShadow><boxGeometry args={[0.34, 1.05, 0.34]} /><meshStandardMaterial color={scuro ? "#7a5646" : "#b9bfc4"} roughness={0.85} /></mesh>
      <mesh position={[0, 0.56, 0]}><boxGeometry args={[0.46, 0.08, 0.46]} /><meshStandardMaterial color="#4a4a4a" /></mesh>
      <group position={[0, 0.62, 0]}><Fumo colore={scuro ? "#3a3a3d" : "#f4f7f9"} quanto={scuro ? 1.3 : 0.8} ritmo={scuro ? 0.45 : 0.3} /></group>
    </group>
  )
}

function PompaDiCalore() {
  const ventola = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ventola.current) ventola.current.rotation.z += dt * 9 })
  return (
    <group position={[W / 2 + 0.6, 0.4, 0.4]}>
      <mesh castShadow><boxGeometry args={[0.52, 0.8, 0.98]} /><meshStandardMaterial color="#e6eaed" roughness={0.5} metalness={0.2} /></mesh>
      <mesh position={[0.27, 0, 0]}><boxGeometry args={[0.02, 0.7, 0.88]} /><meshStandardMaterial color="#c9d0d5" /></mesh>
      <group position={[0.285, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh><ringGeometry args={[0.2, 0.3, 28]} /><meshStandardMaterial color="#2d3a44" side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 0, -0.004]}><circleGeometry args={[0.2, 24]} /><meshStandardMaterial color="#1c252c" side={THREE.DoubleSide} /></mesh>
        <group ref={ventola}>
          {[0, 1, 2, 3, 4].map((i) => <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 5]} position={[0, 0, 0.006]}><boxGeometry args={[0.07, 0.38, 0.012]} /><meshStandardMaterial color="#6d8795" /></mesh>)}
        </group>
      </group>
      <mesh position={[-0.28, 0.12, 0.55]}><cylinderGeometry args={[0.035, 0.035, 0.55, 8]} /><meshStandardMaterial color="#b0b6bb" /></mesh>
      <mesh position={[0.27, 0.32, -0.38]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#35c46a" emissive="#35c46a" emissiveIntensity={1} /></mesh>
    </group>
  )
}

function BombolaGas() {
  return (
    <group position={[-3.25, 0, 1.55]}>
      <mesh position={[0, 0.36, 0]} castShadow><cylinderGeometry args={[0.17, 0.17, 0.72, 16]} /><meshStandardMaterial color="#d9532e" roughness={0.4} metalness={0.25} /></mesh>
      <mesh position={[0, 0.76, 0]}><sphereGeometry args={[0.1, 12, 12]} /><meshStandardMaterial color="#d9532e" metalness={0.25} roughness={0.4} /></mesh>
      <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.035, 0.035, 0.1, 8]} /><meshStandardMaterial color="#9aa1a6" metalness={0.7} /></mesh>
      <mesh position={[0.1, 0.5, 0.15]}><cylinderGeometry args={[0.012, 0.012, 0.5, 6]} /><meshStandardMaterial color="#222" /></mesh>
    </group>
  )
}

function PianoInduzione() {
  const anelli = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    anelli.current?.children.forEach((m, i) => {
      ;((m as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + 0.5 * Math.sin(clock.elapsedTime * 2 + i * 1.5)
    })
  })
  return (
    <group position={[-3.25, 0, 1.55]}>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.7, 0.6, 0.5]} /><meshStandardMaterial color="#d8dde1" roughness={0.6} /></mesh>
      <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.72, 0.04, 0.52]} /><meshStandardMaterial color="#14181c" metalness={0.5} roughness={0.15} /></mesh>
      <group ref={anelli} position={[0, 0.645, 0]}>
        {[-0.17, 0.17].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.07, 0.11, 28]} /><meshStandardMaterial color="#4fc3f7" emissive="#29b6f6" emissiveIntensity={1} side={THREE.DoubleSide} /></mesh>
        ))}
      </group>
    </group>
  )
}

// ───────────────────────── auto: tre forme, colore e fumo secondo la classe ─────────────────────────
// Stesso linguaggio per tutte (profilo curvo estruso, bordi smussati, dettagli veri), ma tre auto diverse:
// A–B compatta moderna e filante, C–D berlina a tre volumi, E–G vecchia utilitaria squadrata.
type FormaAuto = "moderna" | "normale" | "vecchia"
const FORMA_AUTO: Record<Classe, FormaAuto> = { A: "moderna", B: "moderna", C: "normale", D: "normale", E: "vecchia", F: "vecchia", G: "vecchia" }
const STILE_AUTO: Record<Classe, { colore: string; metallo: number; ruvido: number; fumo: { colore: string; quanto: number; ritmo: number } | null }> = {
  A: { colore: "#e9f5f1", metallo: 0.6, ruvido: 0.2, fumo: null },
  B: { colore: "#2e9e6b", metallo: 0.6, ruvido: 0.22, fumo: { colore: "#eef1f3", quanto: 0.3, ritmo: 0.3 } },
  C: { colore: "#2f6fc4", metallo: 0.5, ruvido: 0.3, fumo: { colore: "#dde1e4", quanto: 0.45, ritmo: 0.32 } },
  D: { colore: "#8a96a3", metallo: 0.45, ruvido: 0.38, fumo: { colore: "#b9bfc4", quanto: 0.6, ritmo: 0.35 } },
  E: { colore: "#c9a45c", metallo: 0.15, ruvido: 0.6, fumo: { colore: "#8f9499", quanto: 0.8, ritmo: 0.4 } },
  F: { colore: "#9b5a3c", metallo: 0.1, ruvido: 0.72, fumo: { colore: "#5f6368", quanto: 1.0, ritmo: 0.45 } },
  G: { colore: "#6f6a52", metallo: 0.05, ruvido: 0.88, fumo: { colore: "#38383b", quanto: 1.3, ritmo: 0.5 } },
}
const PLASTICA = "#24292e", CROMO = "#d5dade"

// Profilo laterale (x = lunghezza, y = altezza) estruso sulla larghezza con bordi smussati:
// resta morbido e stilizzato ma ha cofano, passaruota e abitacolo come un'auto vera.
function estrudiProfilo(disegna: (s: THREE.Shape) => void, larghezza: number, smusso: number) {
  const s = new THREE.Shape()
  disegna(s)
  const g = new THREE.ExtrudeGeometry(s, { depth: larghezza, bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 5, curveSegments: 20 })
  g.translate(0, 0, -larghezza / 2)
  g.rotateY(-Math.PI / 2) // la lunghezza passa sull'asse z: il muso guarda +z
  g.computeVertexNormals()
  return g
}

// Fondo della scocca con i due passaruota incavati, da dietro verso il muso.
function fondoConPassaruota(s: THREE.Shape, xRetro: number, xMuso: number, y: number, zRuota: number, rRuota: number, rArco: number) {
  s.moveTo(xRetro, y)
  s.lineTo(-zRuota - rArco, y)
  s.absarc(-zRuota, rRuota, rArco, Math.PI, 0, true)
  s.lineTo(zRuota - rArco, y)
  s.absarc(zRuota, rRuota, rArco, Math.PI, 0, true)
  s.lineTo(xMuso, y)
}

type Cerchio = "aero" | "razze" | "coppa" | "acciaio"

// Pneumatico con fianco arrotondato e cerchio a scelta: aero (elettrica), razze, coppa in plastica, acciaio nudo.
function Ruota({ r, lato, cerchio }: { r: number; lato: 1 | -1; cerchio: Cerchio }) {
  const colore = { aero: "#e6eaed", razze: "#b7bec4", coppa: "#c3c8cc", acciaio: "#3a3f44" }[cerchio]
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[r, r, 0.1, 24]} /><meshStandardMaterial color="#17191b" roughness={0.95} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, lato * 0.05, 0]}><torusGeometry args={[r - 0.012, 0.014, 8, 24]} /><meshStandardMaterial color="#232629" roughness={0.9} /></mesh>
      <group position={[0, lato * 0.052, 0]}>
        <mesh><cylinderGeometry args={[r * (cerchio === "acciaio" ? 0.55 : 0.66), r * (cerchio === "acciaio" ? 0.55 : 0.66), 0.012, 24]} /><meshStandardMaterial color={colore} metalness={cerchio === "coppa" ? 0.3 : 0.8} roughness={cerchio === "acciaio" ? 0.6 : 0.28} /></mesh>
        {cerchio === "aero" && <mesh position={[0, lato * 0.007, 0]}><cylinderGeometry args={[r * 0.4, r * 0.4, 0.006, 24]} /><meshStandardMaterial color="#2a3238" metalness={0.6} roughness={0.3} /></mesh>}
        {cerchio === "razze" && [0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]} position={[0, lato * 0.008, 0]}>
            <boxGeometry args={[0.022, 0.006, r * 1.2]} /><meshStandardMaterial color="#5d666d" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        {cerchio === "coppa" && Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 4, 0]} position={[Math.cos((i * Math.PI) / 4) * r * 0.45, lato * 0.007, -Math.sin((i * Math.PI) / 4) * r * 0.45]}>
            <boxGeometry args={[0.035, 0.006, 0.014]} /><meshStandardMaterial color="#4a5157" />
          </mesh>
        ))}
        {cerchio === "acciaio" && [0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * r * 0.32, lato * 0.007, Math.sin((i * Math.PI) / 2) * r * 0.32]}>
            <cylinderGeometry args={[0.012, 0.012, 0.006, 8]} /><meshStandardMaterial color="#14171a" />
          </mesh>
        ))}
        <mesh position={[0, lato * 0.012, 0]}><cylinderGeometry args={[0.02, 0.02, 0.008, 10]} /><meshStandardMaterial color="#9aa3a9" metalness={0.9} /></mesh>
      </group>
    </group>
  )
}

function QuattroRuote({ x, z, r, cerchio }: { x: number; z: number; r: number; cerchio: Cerchio }) {
  return (
    <>
      {([-1, 1] as const).flatMap((lato) => [-z, z].map((pz) => (
        <group key={`${lato}${pz}`} position={[lato * x, r, pz]}><Ruota r={r} lato={lato} cerchio={cerchio} /></group>
      )))}
    </>
  )
}

// ── A–B: compatta moderna, filante ──
const MOD = { r: 0.16, z: 0.56 }
const geoScoccaModerna = () => estrudiProfilo((s) => {
  fondoConPassaruota(s, -0.84, 0.82, 0.13, MOD.z, MOD.r, 0.2)
  s.quadraticCurveTo(0.9, 0.13, 0.9, 0.24)
  s.quadraticCurveTo(0.9, 0.36, 0.76, 0.39)
  s.quadraticCurveTo(0.55, 0.45, 0.36, 0.46)
  s.lineTo(-0.66, 0.47)
  s.quadraticCurveTo(-0.86, 0.46, -0.88, 0.36)
  s.lineTo(-0.88, 0.22)
  s.quadraticCurveTo(-0.88, 0.13, -0.84, 0.13)
}, 0.74, 0.05)
const geoAbitacoloModerna = () => estrudiProfilo((s) => {
  s.moveTo(0.4, 0.45)
  s.quadraticCurveTo(0.22, 0.6, 0.04, 0.665)
  s.lineTo(-0.4, 0.675)
  s.quadraticCurveTo(-0.6, 0.64, -0.7, 0.46)
  s.lineTo(0.4, 0.45)
}, 0.6, 0.04)

const COLORE_MODERNA: Partial<Record<Alimentazione, string>> = { elettrico: "#eef4f2", ibrido: "#1f8a70", gpl: "#2f5fa8" }

// Elettrica: niente griglia né scarico, barra LED continua, cerchi aero, presa di ricarica illuminata.
function AutoModerna({ classe, alimentazione }: { classe: Classe; alimentazione: Alimentazione }) {
  const st = STILE_AUTO[classe]
  const elettrica = alimentazione === "elettrico"
  const scocca = useMemo(geoScoccaModerna, [])
  const abitacolo = useMemo(geoAbitacoloModerna, [])
  const vernice = <meshStandardMaterial color={COLORE_MODERNA[alimentazione] ?? st.colore} metalness={0.55} roughness={0.22} />
  const alone = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => { if (alone.current) alone.current.emissiveIntensity = 0.9 + 0.5 * Math.sin(clock.elapsedTime * 2.2) })
  return (
    <group>
      <mesh geometry={scocca} castShadow receiveShadow>{vernice}</mesh>
      <mesh geometry={abitacolo} castShadow><meshStandardMaterial color="#1b2731" metalness={0.9} roughness={0.08} /></mesh>
      {/* tetto e montanti in tinta */}
      <RoundedBox args={[0.7, 0.035, 0.46]} radius={0.015} smoothness={3} position={[0, 0.72, -0.17]} castShadow>{vernice}</RoundedBox>
      <mesh position={[0, 0.58, -0.16]}><boxGeometry args={[0.69, 0.24, 0.05]} />{vernice}</mesh>
      {/* passaruota in plastica scura */}
      {[-1, 1].flatMap((lato) => [-MOD.z, MOD.z].map((z) => (
        <mesh key={`${lato}${z}`} position={[lato * 0.425, MOD.r, z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.215, 0.018, 6, 20, Math.PI]} /><meshStandardMaterial color={PLASTICA} roughness={0.9} />
        </mesh>
      )))}
      {/* specchietti e maniglie */}
      {[-1, 1].map((lato) => (
        <group key={lato}>
          <RoundedBox args={[0.1, 0.06, 0.09]} radius={0.02} smoothness={3} position={[lato * 0.45, 0.5, 0.32]}>{vernice}</RoundedBox>
          {[0.08, -0.36].map((z) => <mesh key={z} position={[lato * 0.427, 0.41, z]}><boxGeometry args={[0.012, 0.018, 0.08]} /><meshStandardMaterial color={CROMO} metalness={0.9} roughness={0.2} /></mesh>)}
        </group>
      ))}
      {/* fari: affilati, inclinati verso l'interno */}
      {[-1, 1].map((lato) => (
        <RoundedBox key={lato} args={[0.2, 0.045, 0.06]} radius={0.015} smoothness={3} position={[lato * 0.27, 0.36, 0.905]} rotation={[0, 0, lato * -0.12]}>
          <meshStandardMaterial color="#f4fbff" emissive="#d9f3ff" emissiveIntensity={1.1} />
        </RoundedBox>
      ))}
      {elettrica ? (
        <>
          <mesh position={[0, 0.405, 0.885]}><boxGeometry args={[0.36, 0.014, 0.02]} /><meshStandardMaterial color="#e8fbff" emissive="#9be7ff" emissiveIntensity={1.6} /></mesh>
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.7, 1.4]} /><meshStandardMaterial ref={alone} color="#3fd0ff" emissive="#3fd0ff" transparent opacity={0.22} depthWrite={false} /></mesh>
          <mesh position={[-0.428, 0.4, -0.62]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.035, 16]} /><meshStandardMaterial color="#35c46a" emissive="#35c46a" emissiveIntensity={1.3} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0.39, -0.93]}><boxGeometry args={[0.7, 0.03, 0.02]} /><meshStandardMaterial color="#ff5a5a" emissive="#ff2d2d" emissiveIntensity={0.9} /></mesh>
        </>
      ) : (
        <>
          <RoundedBox args={[0.4, 0.09, 0.04]} radius={0.02} smoothness={3} position={[0, 0.25, 0.95]}><meshStandardMaterial color={PLASTICA} roughness={0.6} /></RoundedBox>
          {[0.23, 0.27].map((y) => <mesh key={y} position={[0, y, 0.972]}><boxGeometry args={[0.36, 0.008, 0.005]} /><meshStandardMaterial color={CROMO} metalness={0.9} roughness={0.2} /></mesh>)}
          {[-1, 1].map((lato) => <mesh key={lato} position={[lato * 0.29, 0.38, -0.93]}><boxGeometry args={[0.2, 0.04, 0.02]} /><meshStandardMaterial color="#ff5a5a" emissive="#ff2d2d" emissiveIntensity={0.8} /></mesh>)}
          {alimentazione === "ibrido" && <mesh position={[0.3, 0.44, 0.79]}><boxGeometry args={[0.07, 0.015, 0.03]} /><meshStandardMaterial color="#4fa3ff" emissive="#4fa3ff" emissiveIntensity={0.8} /></mesh>}
          <mesh position={[0.24, 0.11, -0.92]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.028, 0.028, 0.08, 10]} /><meshStandardMaterial color="#8a9096" metalness={0.8} roughness={0.3} /></mesh>
          {st.fumo && <group position={[0.24, 0.11, -0.98]}><Fumo {...st.fumo} /></group>}
        </>
      )}
      {/* paraurti in plastica opaca */}
      {[-1, 1].map((v) => <RoundedBox key={v} args={[0.78, 0.05, 0.05]} radius={0.02} smoothness={3} position={[0, 0.13, v * 0.94]}><meshStandardMaterial color={PLASTICA} roughness={0.85} /></RoundedBox>)}
      <QuattroRuote x={0.36} z={MOD.z} r={MOD.r} cerchio={elettrica ? "aero" : "razze"} />
    </group>
  )
}

// ── C–D: berlina a tre volumi, più alta e composta ──
const BER = { r: 0.155, z: 0.6 }
const geoScoccaBerlina = () => estrudiProfilo((s) => {
  fondoConPassaruota(s, -0.9, 0.86, 0.13, BER.z, BER.r, 0.19)
  s.quadraticCurveTo(0.94, 0.13, 0.94, 0.22)
  s.lineTo(0.94, 0.33)
  s.quadraticCurveTo(0.93, 0.42, 0.82, 0.43)
  s.quadraticCurveTo(0.6, 0.46, 0.34, 0.48)
  s.lineTo(-0.62, 0.49)
  s.lineTo(-0.9, 0.49) // coda: il baule è un volume a sé
  s.quadraticCurveTo(-0.96, 0.48, -0.96, 0.4)
  s.lineTo(-0.96, 0.2)
  s.quadraticCurveTo(-0.96, 0.13, -0.9, 0.13)
}, 0.72, 0.05)
const geoAbitacoloBerlina = () => estrudiProfilo((s) => {
  s.moveTo(0.36, 0.47)
  s.quadraticCurveTo(0.24, 0.6, 0.12, 0.69)
  s.lineTo(-0.36, 0.7)
  s.quadraticCurveTo(-0.5, 0.67, -0.6, 0.49)
  s.lineTo(0.36, 0.47)
}, 0.62, 0.035)

function AutoNormale({ classe }: { classe: Classe }) {
  const st = STILE_AUTO[classe]
  const scocca = useMemo(geoScoccaBerlina, [])
  const abitacolo = useMemo(geoAbitacoloBerlina, [])
  const vernice = <meshStandardMaterial color={st.colore} metalness={st.metallo} roughness={st.ruvido} />
  return (
    <group>
      <mesh geometry={scocca} castShadow receiveShadow>{vernice}</mesh>
      <mesh geometry={abitacolo} castShadow><meshStandardMaterial color="#2c3e4c" metalness={0.75} roughness={0.12} /></mesh>
      <RoundedBox args={[0.7, 0.035, 0.46]} radius={0.015} smoothness={3} position={[0, 0.74, -0.12]} castShadow>{vernice}</RoundedBox>
      <mesh position={[0, 0.6, -0.12]}><boxGeometry args={[0.7, 0.22, 0.05]} />{vernice}</mesh>
      {/* modanatura laterale, maniglie e specchietti neri */}
      {[-1, 1].map((lato) => (
        <group key={lato}>
          <mesh position={[lato * 0.412, 0.3, -0.02]}><boxGeometry args={[0.012, 0.035, 1.05]} /><meshStandardMaterial color={PLASTICA} roughness={0.8} /></mesh>
          {[0.1, -0.32].map((z) => <mesh key={z} position={[lato * 0.414, 0.42, z]}><boxGeometry args={[0.012, 0.02, 0.07]} /><meshStandardMaterial color={PLASTICA} /></mesh>)}
          <RoundedBox args={[0.09, 0.06, 0.08]} radius={0.015} smoothness={3} position={[lato * 0.44, 0.52, 0.3]}><meshStandardMaterial color={PLASTICA} roughness={0.7} /></RoundedBox>
        </group>
      ))}
      {/* muso: griglia ampia con cornice cromata, fari rettangolari e frecce arancioni */}
      <RoundedBox args={[0.42, 0.1, 0.03]} radius={0.012} smoothness={3} position={[0, 0.3, 0.985]}><meshStandardMaterial color={CROMO} metalness={0.9} roughness={0.2} /></RoundedBox>
      <mesh position={[0, 0.3, 1.0]}><boxGeometry args={[0.38, 0.07, 0.01]} /><meshStandardMaterial color="#1a1d20" /></mesh>
      {[-1, 1].map((lato) => (
        <group key={lato}>
          <RoundedBox args={[0.17, 0.07, 0.04]} radius={0.012} smoothness={3} position={[lato * 0.3, 0.34, 0.975]}><meshStandardMaterial color="#f6f9fb" emissive="#fff2c4" emissiveIntensity={0.7} /></RoundedBox>
          <mesh position={[lato * 0.41, 0.34, 0.96]}><boxGeometry args={[0.04, 0.05, 0.03]} /><meshStandardMaterial color="#ffa53a" emissive="#ff8a00" emissiveIntensity={0.4} /></mesh>
          {/* fanali posteriori grandi */}
          <RoundedBox args={[0.22, 0.08, 0.03]} radius={0.012} smoothness={3} position={[lato * 0.27, 0.4, -1.005]}><meshStandardMaterial color="#d93a3a" emissive="#b81d1d" emissiveIntensity={0.6} /></RoundedBox>
        </group>
      ))}
      {/* targa e paraurti */}
      <mesh position={[0, 0.27, -1.012]}><boxGeometry args={[0.2, 0.06, 0.006]} /><meshStandardMaterial color="#f2f2f2" /></mesh>
      {[-1, 1].map((v) => <RoundedBox key={v} args={[0.8, 0.07, 0.06]} radius={0.025} smoothness={3} position={[0, 0.15, v * 0.99]}><meshStandardMaterial color="#4a5157" roughness={0.75} /></RoundedBox>)}
      <mesh position={[0.24, 0.1, -0.99]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.026, 0.026, 0.08, 10]} /><meshStandardMaterial color="#6b7177" metalness={0.7} roughness={0.35} /></mesh>
      {st.fumo && <group position={[0.24, 0.1, -1.05]}><Fumo {...st.fumo} /></group>}
      <QuattroRuote x={0.35} z={BER.z} r={BER.r} cerchio="coppa" />
    </group>
  )
}

// ── E–G: vecchia utilitaria squadrata (linee quasi dritte, vetri alti), sempre più malconcia ──
const VEC = { r: 0.15, z: 0.54 }
const geoScoccaVecchia = () => estrudiProfilo((s) => {
  fondoConPassaruota(s, -0.84, 0.86, 0.14, VEC.z, VEC.r, 0.18)
  s.quadraticCurveTo(0.88, 0.14, 0.88, 0.17)
  s.lineTo(0.88, 0.42)
  s.lineTo(0.4, 0.46)
  s.lineTo(-0.8, 0.48)
  s.lineTo(-0.85, 0.46)
  s.lineTo(-0.86, 0.17)
  s.quadraticCurveTo(-0.86, 0.14, -0.84, 0.14)
}, 0.74, 0.025)
const geoAbitacoloVecchia = () => estrudiProfilo((s) => {
  s.moveTo(0.42, 0.46)
  s.lineTo(0.2, 0.75)
  s.lineTo(-0.7, 0.77)
  s.lineTo(-0.8, 0.47)
  s.lineTo(0.42, 0.46)
}, 0.68, 0.02)

function AutoVecchia({ classe }: { classe: Classe }) {
  const st = STILE_AUTO[classe]
  const scocca = useMemo(geoScoccaVecchia, [])
  const abitacolo = useMemo(geoAbitacoloVecchia, [])
  const vernice = <meshStandardMaterial color={st.colore} metalness={st.metallo} roughness={st.ruvido} />
  const ruggine = classe === "E" ? 1 : classe === "F" ? 3 : 5
  const macchie = [[1, 0.3, 0.42], [-1, 0.24, -0.3], [1, 0.22, -0.48], [-1, 0.34, 0.6], [1, 0.4, -0.05]] as const
  const fari = classe === "E" ? "quadrati" : "tondi"
  return (
    <group rotation={[0, 0, classe === "G" ? 0.035 : 0]}>
      <mesh geometry={scocca} castShadow receiveShadow>{vernice}</mesh>
      <mesh geometry={abitacolo} castShadow><meshStandardMaterial color="#9fbcc2" metalness={0.35} roughness={0.25} /></mesh>
      {/* tetto e montanti sottili, montante posteriore largo */}
      <mesh position={[0, 0.785, -0.25]}><boxGeometry args={[0.72, 0.03, 0.9]} />{vernice}</mesh>
      <mesh position={[0, 0.62, -0.12]}><boxGeometry args={[0.73, 0.3, 0.035]} />{vernice}</mesh>
      <mesh position={[0, 0.62, -0.66]}><boxGeometry args={[0.73, 0.3, 0.1]} />{vernice}</mesh>
      {/* E: portapacchi; F: portiera di un altro colore; G: inclinata e senza una coppa */}
      {classe === "E" && [-0.45, -0.05].map((z) => <mesh key={z} position={[0, 0.83, z]}><boxGeometry args={[0.74, 0.025, 0.03]} /><meshStandardMaterial color="#2a2d30" metalness={0.5} /></mesh>)}
      {classe === "F" && <mesh position={[0.395, 0.31, 0.12]}><boxGeometry args={[0.01, 0.28, 0.42]} /><meshStandardMaterial color="#d8cfb8" roughness={0.8} /></mesh>}
      {macchie.slice(0, ruggine).map(([lato, y, z], i) => (
        <mesh key={i} position={[lato * 0.398, y, z]} rotation={[0, (lato * Math.PI) / 2, 0]}>
          <circleGeometry args={[0.05 + i * 0.012, 7]} /><meshStandardMaterial color="#7a3b1c" roughness={1} />
        </mesh>
      ))}
      {/* fari, griglia a listelli, frecce, antenna */}
      {[-1, 1].map((lato) => (
        <group key={lato}>
          {fari === "tondi" ? (
            <mesh position={[lato * 0.27, 0.33, 0.9]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.065, 0.065, 0.03, 18]} /><meshStandardMaterial color="#fff3c4" emissive="#ffe08a" emissiveIntensity={0.35} /></mesh>
          ) : (
            <mesh position={[lato * 0.27, 0.33, 0.9]}><boxGeometry args={[0.15, 0.11, 0.03]} /><meshStandardMaterial color="#fff3c4" emissive="#ffe08a" emissiveIntensity={0.35} /></mesh>
          )}
          <mesh position={[lato * 0.37, 0.24, 0.9]}><boxGeometry args={[0.05, 0.04, 0.02]} /><meshStandardMaterial color="#ffa53a" emissive="#ff8a00" emissiveIntensity={0.3} /></mesh>
          <mesh position={[lato * 0.29, 0.38, -0.893]}><boxGeometry args={[0.16, 0.12, 0.02]} /><meshStandardMaterial color="#b83030" emissive="#8a1a1a" emissiveIntensity={0.4} /></mesh>
          <mesh position={[lato * 0.405, 0.5, 0.36]}><boxGeometry args={[0.04, 0.05, 0.05]} /><meshStandardMaterial color={CROMO} metalness={0.8} roughness={0.3} /></mesh>
        </group>
      ))}
      {[0.3, 0.34, 0.38].map((y) => <mesh key={y} position={[0, y, 0.9]}><boxGeometry args={[0.3, 0.012, 0.02]} /><meshStandardMaterial color="#1a1d20" /></mesh>)}
      <mesh position={[0.3, 0.97, 0.05]} rotation={[-0.25, 0, 0]}><cylinderGeometry args={[0.005, 0.005, 0.42, 5]} /><meshStandardMaterial color="#222" /></mesh>
      {/* paraurti cromati sporgenti */}
      {[-1, 1].map((v) => <RoundedBox key={v} args={[0.82, 0.06, 0.06]} radius={0.02} smoothness={3} position={[0, 0.19, v * 0.9]}><meshStandardMaterial color={CROMO} metalness={classe === "G" ? 0.4 : 0.9} roughness={classe === "G" ? 0.6 : 0.25} /></RoundedBox>)}
      <mesh position={[0.25, 0.12, -0.88]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.12, 8]} /><meshStandardMaterial color="#3b3b3b" metalness={0.5} /></mesh>
      {st.fumo && <group position={[0.25, 0.12, -0.96]}><Fumo {...st.fumo} /></group>}
      <QuattroRuote x={0.34} z={VEC.z} r={VEC.r} cerchio={classe === "E" ? "coppa" : "acciaio"} />
    </group>
  )
}

// Posto auto nel vialetto, accanto alla colonnina.
function Auto({ auto }: { auto: VistaCasa["auto"] }) {
  const forma = auto ? FORMA_AUTO[auto.classe] : null
  const classe = auto?.classe ?? "C"
  return (
    <group position={[2.32, 0, D / 2 + 1.33]} rotation={[0, Math.PI / 2 + 0.2, 0]}>
      <Apparizione visibile={forma === "moderna"}><AutoModerna classe={classe} alimentazione={auto?.alimentazione ?? "elettrico"} /></Apparizione>
      <Apparizione visibile={forma === "normale"}><AutoNormale classe={classe} /></Apparizione>
      <Apparizione visibile={forma === "vecchia"}><AutoVecchia classe={classe} /></Apparizione>
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
    <group position={[1.15, 0, D / 2 + 1.15]} rotation={[0, 0.1, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.24, 1.1, 0.2]} /><meshStandardMaterial color="#f4f6f8" roughness={0.4} /></mesh>
      <mesh position={[0, 0.85, 0.105]}><boxGeometry args={[0.16, 0.22, 0.01]} /><meshStandardMaterial color="#12161a" /></mesh>
      <mesh ref={led} position={[0, 0.98, 0.112]}><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color="#3fd0ff" emissive="#3fd0ff" emissiveIntensity={1} /></mesh>
      <mesh position={[0.36, 0.3, 0.1]} rotation={[0, 0, Math.PI / 2.4]}><torusGeometry args={[0.4, 0.014, 6, 20, Math.PI / 1.4]} /><meshStandardMaterial color="#222" /></mesh>
    </group>
  )
}

// ───────────────────────── giardino ─────────────────────────
const Latifoglia = ({ posizione, scala = 1, colore = "#4f9a4e" }: { posizione: [number, number, number]; scala?: number; colore?: string }) => (
  <group position={posizione} scale={scala}>
    <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 0.8, 6]} /><meshStandardMaterial color="#6d4c41" /></mesh>
    <mesh position={[0, 1.2, 0]} castShadow><icosahedronGeometry args={[0.62, 1]} /><meshStandardMaterial color={colore} flatShading /></mesh>
    <mesh position={[0.3, 1.0, 0.15]} castShadow><icosahedronGeometry args={[0.38, 1]} /><meshStandardMaterial color={colore} flatShading /></mesh>
  </group>
)
const Abete = ({ posizione, scala = 1 }: { posizione: [number, number, number]; scala?: number }) => (
  <group position={posizione} scale={scala}>
    <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.07, 0.1, 0.6, 6]} /><meshStandardMaterial color="#6d4c41" /></mesh>
    {[[0.95, 0.5, 1.0], [1.4, 0.38, 0.8], [1.8, 0.26, 0.6]].map(([y, r, h]) => (
      <mesh key={y} position={[0, y!, 0]} castShadow><coneGeometry args={[r!, h!, 8]} /><meshStandardMaterial color="#2f7d4a" flatShading /></mesh>
    ))}
  </group>
)
const Siepe = ({ x, z }: { x: number; z: number }) => (
  <mesh position={[x, 0.22, z]} scale={[1, 0.8, 0.9]} castShadow><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color="#3d8a47" flatShading /></mesh>
)

function Giardino() {
  const sassi = [0, 1, 2, 3, 4, 5].map((i) => ({ z: D / 2 + 0.7 + i * 0.5, x: Math.sin(i * 1.7) * 0.07 }))
  const fiori = [[-1.4, 2.1, "#f06292"], [-1.15, 2.2, "#ffd54f"], [-0.95, 2.05, "#ffffff"], [-1.55, 2.25, "#ffd54f"], [1.2, 1.95, "#f06292"]] as const
  const staccionata = Array.from({ length: 6 }, (_, i) => ({ x: -4.0 + i * 0.52, z: 2.5 + i * 0.22 }))
  return (
    <>
      {sassi.map((s, i) => (
        <mesh key={i} position={[s.x, 0.02, s.z]} rotation={[0, i * 0.3, 0]} receiveShadow><boxGeometry args={[0.7, 0.04, 0.36]} /><meshStandardMaterial color="#c9c2b5" roughness={1} /></mesh>
      ))}
      <Siepe x={-1.55} z={1.95} /><Siepe x={-1.1} z={1.95} /><Siepe x={-0.75} z={1.95} />
      {fiori.map(([x, z, c], i) => <mesh key={i} position={[x, 0.08, z]}><icosahedronGeometry args={[0.055, 0]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.15} flatShading /></mesh>)}
      {staccionata.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.07, 0.4, 0.07]} /><meshStandardMaterial color="#e9e2d0" /></mesh>
          {i < 5 && <mesh position={[0.26, 0.28, 0.11]} rotation={[0, -0.41, 0]}><boxGeometry args={[0.6, 0.05, 0.03]} /><meshStandardMaterial color="#e9e2d0" /></mesh>}
        </group>
      ))}
      {/* cassetta della posta */}
      <group position={[0.75, 0, D / 2 + 1.5]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.05, 0.6, 0.05]} /><meshStandardMaterial color="#6d4c41" /></mesh>
        <mesh position={[0, 0.65, 0]} castShadow><boxGeometry args={[0.22, 0.16, 0.14]} /><meshStandardMaterial color="#c0392b" /></mesh>
      </group>
      <Latifoglia posizione={[-3.7, 0, -1.9]} scala={1.25} />
      <Abete posizione={[3.7, 0, -2.2]} scala={1.1} />
      <Latifoglia posizione={[4.0, 0, 1.9]} scala={0.8} colore="#7bb04f" />
      <Abete posizione={[-4.1, 0, 0.9]} scala={0.8} />
    </>
  )
}

// ───────────────────────── atmosfera legata alla classe ─────────────────────────
const METEO = {
  sereno: { alto: "#7cc3fa", basso: "#eaf6ff", sole: 1.9, ambiente: 0.7, nuvole: 3, grigio: 0, sfera: 1, nebbia: 0 },
  velato: { alto: "#b4c4d2", basso: "#e6eaee", sole: 1.25, ambiente: 0.85, nuvole: 5, grigio: 0.35, sfera: 0.25, nebbia: 0.004 },
  grigio: { alto: "#7e8791", basso: "#c4c8cc", sole: 0.75, ambiente: 1.0, nuvole: 8, grigio: 0.85, sfera: 0, nebbia: 0.012 },
} as const
const N_NUVOLE = 8

function Atmosfera({ meteo }: { meteo: Meteo }) {
  const scena = useThree((s) => s.scene)
  const cupola = useRef<THREE.ShaderMaterial>(null)
  const sole = useRef<THREE.DirectionalLight>(null)
  const ambiente = useRef<THREE.AmbientLight>(null)
  const sfera = useRef<THREE.Group>(null)
  const nuvole = useRef<(THREE.Group | null)[]>([])
  const matNuvola = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, transparent: true, opacity: 0.94, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.4 }), [])
  const uniformi = useMemo(() => ({ alto: { value: new THREE.Color(METEO[meteo].alto) }, basso: { value: new THREE.Color(METEO[meteo].basso) } }), [])
  const stato = useRef({ sole: METEO[meteo].sole, ambiente: METEO[meteo].ambiente, nuvole: METEO[meteo].nuvole, grigio: METEO[meteo].grigio, sfera: METEO[meteo].sfera, nebbia: METEO[meteo].nebbia })
  const pos = useMemo(() => Array.from({ length: N_NUVOLE }, (_, i) => ({ a: (i / N_NUVOLE) * Math.PI * 2, r: 8 + (i % 3) * 1.8, h: 5.5 + (i % 4) * 0.8, v: 0.03 + 0.01 * (i % 3) })), [])
  const BIANCO = useMemo(() => new THREE.Color("#ffffff"), [])
  const SCURO = useMemo(() => new THREE.Color("#5d6166"), [])

  useFrame(({ clock }, dt) => {
    const m = METEO[meteo], s = stato.current
    const f = 1 - Math.exp(-2.2 * Math.min(dt, 0.05))
    s.sole += (m.sole - s.sole) * f; s.ambiente += (m.ambiente - s.ambiente) * f; s.nuvole += (m.nuvole - s.nuvole) * f
    s.grigio += (m.grigio - s.grigio) * f; s.sfera += (m.sfera - s.sfera) * f; s.nebbia += (m.nebbia - s.nebbia) * f
    uniformi.alto.value.lerp(new THREE.Color(m.alto), f); uniformi.basso.value.lerp(new THREE.Color(m.basso), f)
    if (sole.current) sole.current.intensity = s.sole
    if (ambiente.current) ambiente.current.intensity = s.ambiente
    if (sfera.current) { sfera.current.visible = s.sfera > 0.02; sfera.current.scale.setScalar(0.6 + s.sfera * 0.4) }
    matNuvola.color.lerpColors(BIANCO, SCURO, s.grigio); matNuvola.emissive.lerpColors(BIANCO, new THREE.Color("#000"), s.grigio)
    const n = Math.round(s.nuvole)
    pos.forEach((p, i) => {
      const g = nuvole.current[i]
      if (!g) return
      g.visible = i < n
      const a = p.a + clock.elapsedTime * p.v
      g.position.set(Math.cos(a) * p.r, p.h, Math.sin(a) * p.r)
    })
    scena.fog = s.nebbia > 0.0015 ? new THREE.FogExp2(uniformi.basso.value.clone(), s.nebbia) : null
  })

  return (
    <>
      <mesh>
        <sphereGeometry args={[60, 24, 16]} />
        <shaderMaterial ref={cupola} side={THREE.BackSide} depthWrite={false} fog={false} uniforms={uniformi}
          vertexShader="varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} "
          fragmentShader="uniform vec3 alto; uniform vec3 basso; varying float h; void main(){ gl_FragColor = vec4(mix(basso, alto, smoothstep(-0.05, 0.75, h)), 1.0);} " />
      </mesh>
      <ambientLight ref={ambiente} intensity={0.7} />
      <hemisphereLight args={["#dff1ff", "#6c8f5a", 0.4]} />
      <directionalLight ref={sole} position={[7, 10, 6]} intensity={1.8} color="#fff4e0" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.0004} />
      <group ref={sfera} position={[26, 30, 18]}>
        <mesh><sphereGeometry args={[2.6, 20, 14]} /><meshBasicMaterial color="#fff6cf" fog={false} /></mesh>
        <mesh><sphereGeometry args={[4.2, 20, 14]} /><meshBasicMaterial color="#fff2b0" transparent opacity={0.28} fog={false} depthWrite={false} /></mesh>
      </group>
      {pos.map((_, i) => (
        <group key={i} ref={(g) => { nuvole.current[i] = g }} visible={false}>
          {([[-1, 0, 0, 1], [0, 0.35, 0, 1.3], [1.1, 0, 0.2, 0.9]] as const).map(([x, y, z, k], j) => (
            <mesh key={j} position={[x * 0.9, y * 0.9, z * 0.9]} scale={[1.4, 0.7, 1]} material={matNuvola}><icosahedronGeometry args={[0.9 * k, 1]} /></mesh>
          ))}
        </group>
      ))}
    </>
  )
}

// ───────────────────────── scena ─────────────────────────
function Scena({ vista, meteo }: { vista: VistaCasa; meteo: Meteo }) {
  const casa = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (casa.current) casa.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.04 })
  return (
    <>
      <Atmosfera meteo={meteo} />
      <group ref={casa}>
        <mesh position={[0, -0.18, 0]} receiveShadow><cylinderGeometry args={[5.2, 5.4, 0.36, 56]} /><meshStandardMaterial color="#6fae5a" roughness={1} flatShading /></mesh>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[5.4, 4.8, 0.3, 56]} /><meshStandardMaterial color="#8a6a4f" roughness={1} flatShading /></mesh>
        <Giardino />

        <Volume w={W} h={H} d={D} x={0} rivestimento={vista.rivestimento} />
        <Volume w={ALA.w} h={ALA.h} d={ALA.d} x={ALA.x} rivestimento={vista.rivestimento} />
        <Tetto />
        <TettoAla />
        <Facciata rivestimento={vista.rivestimento} vetri={vista.vetri} />

        <Apparizione visibile={vista.pannelliFV}><PannelliFV /></Apparizione>
        <Apparizione visibile={vista.collettoreSolare}><SolareTermico /></Apparizione>
        <Apparizione visibile={vista.impiantoTermico === "pompa_calore"}><PompaDiCalore /></Apparizione>
        <Apparizione visibile={vista.impiantoTermico === "caldaia_condensazione"}><Camino tipo="caldaia_condensazione" /></Apparizione>
        <Apparizione visibile={vista.impiantoTermico === "caldaia_tradizionale"}><Camino tipo="caldaia_tradizionale" /></Apparizione>
        <Apparizione visibile={vista.cottura === "gas"}><BombolaGas /></Apparizione>
        <Apparizione visibile={vista.cottura === "induzione"}><PianoInduzione /></Apparizione>
        <Apparizione visibile={vista.colonnina}><ColonninaEV /></Apparizione>
        <Auto auto={vista.auto} />
      </group>
      <ContactShadows position={[0, -0.66, 0]} opacity={0.35} scale={14} blur={2.4} far={2.2} />
    </>
  )
}

export function Casa3D({ dotazioni }: { dotazioni: Dotazioni }) {
  const vista = useMemo(() => descriviCasa(dotazioni), [dotazioni])
  const meteo = meteoDaClasse(punteggioCasa(dotazioni).classe)
  return (
    <Canvas shadows camera={{ position: [7.8, 5.4, 9], fov: 38 }} gl={{ antialias: true }}>
      <Scena vista={vista} meteo={meteo} />
      <OrbitControls autoRotate autoRotateSpeed={1.1} enablePan={false} minDistance={7} maxDistance={18} minPolarAngle={0.5} maxPolarAngle={Math.PI / 2.1} target={[-0.4, 1, 0.2]} />
    </Canvas>
  )
}
