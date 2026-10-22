import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import {
  CATALOGO_MODELLI_3D,
  creaIstanzaAnimata,
  useModelloGLTF,
  type IstanzaAnimata,
} from "./modelli3d"
import { posizioniAlberi, type Ostacolo } from "./posizioniAlberi"
import type { Punto } from "./geometria"
import type { PresetVisivo } from "./preset"
import { avanzaAnimaleEvitandoOstacoli, scegliWaypointSicuro } from "./strade"

const UCCELLI_MAX = 12
const ANIMALI_MAX = 8
const RARI_TERRA_MAX = 3 // Gallo Cedrone, Lince Alpina, Salamandra Nera di Aurora

export { SPECIE_RARE_VICENZA, calcolaSpawnSpecieRare, type InfoSpecieRara } from "./specie"
import { calcolaSpawnSpecieRare } from "./specie"

type StatoErrante = {
  x: number
  z: number
  targetX: number
  targetZ: number
  angolo: number
  pausa: number
  fasePasso: number
  velocita: number
}

// Modello 3D procedurale articolato di fallback per Capriolo / Cervo
function ModelloCapriolo({
  s,
  zampeRef,
  colloRef,
}: {
  s: number
  zampeRef: (el: THREE.Group | null, idx: number) => void
  colloRef: (el: THREE.Group | null) => void
}) {
  return (
    <group>
      <mesh position={[0, 0.44 * s, 0]} scale={[1.35, 0.72, 0.65]}>
        <dodecahedronGeometry args={[0.34 * s, 1]} />
        <meshStandardMaterial color="#8d5524" roughness={0.85} />
      </mesh>
      <mesh position={[-0.42 * s, 0.46 * s, 0]}>
        <sphereGeometry args={[0.12 * s, 8, 8]} />
        <meshStandardMaterial color="#f5ebe0" roughness={0.9} />
      </mesh>
      <group ref={colloRef} position={[0.34 * s, 0.54 * s, 0]}>
        <mesh position={[0.08 * s, 0.16 * s, 0]} rotation={[0, 0, -0.45]}>
          <cylinderGeometry args={[0.08 * s, 0.12 * s, 0.36 * s, 8]} />
          <meshStandardMaterial color="#8d5524" roughness={0.85} />
        </mesh>
        <mesh position={[0.2 * s, 0.32 * s, 0]} scale={[1.3, 0.85, 0.8]}>
          <dodecahedronGeometry args={[0.12 * s, 1]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.85} />
        </mesh>
        <mesh position={[0.33 * s, 0.3 * s, 0]}>
          <sphereGeometry args={[0.04 * s, 6, 6]} />
          <meshStandardMaterial color="#1f1f1f" />
        </mesh>
        <mesh position={[0.14 * s, 0.43 * s, 0.08 * s]} rotation={[0.3, 0, 0.2]}>
          <coneGeometry args={[0.04 * s, 0.13 * s, 6]} />
          <meshStandardMaterial color="#7f4f24" />
        </mesh>
        <mesh position={[0.14 * s, 0.43 * s, -0.08 * s]} rotation={[-0.3, 0, 0.2]}>
          <coneGeometry args={[0.04 * s, 0.13 * s, 6]} />
          <meshStandardMaterial color="#7f4f24" />
        </mesh>
        <mesh position={[0.16 * s, 0.48 * s, 0.05 * s]} rotation={[0.2, 0, -0.2]}>
          <cylinderGeometry args={[0.012 * s, 0.02 * s, 0.22 * s, 5]} />
          <meshStandardMaterial color="#d7ccc8" />
        </mesh>
        <mesh position={[0.16 * s, 0.48 * s, -0.05 * s]} rotation={[-0.2, 0, -0.2]}>
          <cylinderGeometry args={[0.012 * s, 0.02 * s, 0.22 * s, 5]} />
          <meshStandardMaterial color="#d7ccc8" />
        </mesh>
      </group>
      {(
        [
          [0.26, 0.12],
          [0.26, -0.12],
          [-0.26, 0.12],
          [-0.26, -0.12],
        ] as const
      ).map(([lx, lz], idx) => (
        <group
          key={idx}
          ref={(el) => zampeRef(el, idx)}
          position={[lx * s, 0.34 * s, lz * s]}
        >
          <mesh position={[0, -0.17 * s, 0]}>
            <cylinderGeometry args={[0.038 * s, 0.028 * s, 0.34 * s, 6]} />
            <meshStandardMaterial color="#6f4518" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Modello 3D procedurale articolato di fallback per Volpe Rossa / Lupo
function ModelloVolpe({
  s,
  zampeRef,
  colloRef,
}: {
  s: number
  zampeRef: (el: THREE.Group | null, idx: number) => void
  colloRef: (el: THREE.Group | null) => void
}) {
  return (
    <group>
      <mesh position={[0, 0.28 * s, 0]} scale={[1.45, 0.65, 0.6]}>
        <dodecahedronGeometry args={[0.26 * s, 1]} />
        <meshStandardMaterial color="#c85a17" roughness={0.8} />
      </mesh>
      <group position={[-0.36 * s, 0.28 * s, 0]} rotation={[0, 0, 0.4]}>
        <mesh position={[-0.14 * s, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.09 * s, 0.32 * s, 8]} />
          <meshStandardMaterial color="#b34700" />
        </mesh>
        <mesh position={[-0.3 * s, 0, 0]}>
          <sphereGeometry args={[0.055 * s, 8, 8]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
      </group>
      <group ref={colloRef} position={[0.3 * s, 0.34 * s, 0]}>
        <mesh position={[0.08 * s, 0.06 * s, 0]}>
          <dodecahedronGeometry args={[0.12 * s, 1]} />
          <meshStandardMaterial color="#c85a17" />
        </mesh>
        <mesh position={[0.22 * s, 0.03 * s, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.055 * s, 0.16 * s, 7]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        <mesh position={[0.06 * s, 0.17 * s, 0.06 * s]}>
          <coneGeometry args={[0.04 * s, 0.11 * s, 5]} />
          <meshStandardMaterial color="#2b1d0e" />
        </mesh>
        <mesh position={[0.06 * s, 0.17 * s, -0.06 * s]}>
          <coneGeometry args={[0.04 * s, 0.11 * s, 5]} />
          <meshStandardMaterial color="#2b1d0e" />
        </mesh>
      </group>
      {(
        [
          [0.2, 0.09],
          [0.2, -0.09],
          [-0.2, 0.09],
          [-0.2, -0.09],
        ] as const
      ).map(([lx, lz], idx) => (
        <group
          key={idx}
          ref={(el) => zampeRef(el, idx)}
          position={[lx * s, 0.22 * s, lz * s]}
        >
          <mesh position={[0, -0.11 * s, 0]}>
            <cylinderGeometry args={[0.03 * s, 0.022 * s, 0.22 * s, 6]} />
            <meshStandardMaterial color="#2b1d0e" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// SPECIE RARA 1: Gallo Cedrone (Tetrao urogallus) con zampe, collo e coda a ventaglio animati
function ModelloGalloCedrone({
  s,
  zampeRef,
  colloRef,
  codaRef,
}: {
  s: number
  zampeRef: (el: THREE.Group | null, idx: number) => void
  colloRef: (el: THREE.Group | null) => void
  codaRef: (el: THREE.Group | null) => void
}) {
  return (
    <group>
      {/* Corpo robusto */}
      <mesh position={[0, 0.34 * s, 0]} scale={[1.25, 0.95, 0.85]}>
        <dodecahedronGeometry args={[0.26 * s, 1]} />
        <meshStandardMaterial color="#263238" roughness={0.65} />
      </mesh>
      {/* Petto verde metallico */}
      <mesh position={[0.18 * s, 0.36 * s, 0]}>
        <sphereGeometry args={[0.18 * s, 10, 10]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.4} />
      </mesh>
      {/* Grande coda a ventaglio rialzata e animata */}
      <group ref={codaRef} position={[-0.24 * s, 0.42 * s, 0]}>
        <mesh position={[-0.06 * s, 0.06 * s, 0]} rotation={[0, 0, -0.5]} scale={[0.25, 1.1, 1.35]}>
          <cylinderGeometry args={[0.28 * s, 0.06 * s, 0.36 * s, 10]} />
          <meshStandardMaterial color="#1c2529" />
        </mesh>
      </group>
      {/* Gruppo collo, testa e caruncola rossa animati */}
      <group ref={colloRef} position={[0.22 * s, 0.44 * s, 0]}>
        <mesh position={[0.04 * s, 0.12 * s, 0]}>
          <cylinderGeometry args={[0.07 * s, 0.1 * s, 0.28 * s, 8]} />
          <meshStandardMaterial color="#263238" />
        </mesh>
        <mesh position={[0.08 * s, 0.24 * s, 0]}>
          <sphereGeometry args={[0.09 * s, 8, 8]} />
          <meshStandardMaterial color="#d32f2f" emissive="#b71c1c" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.18 * s, 0.22 * s, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.035 * s, 0.1 * s, 6]} />
          <meshStandardMaterial color="#fff9c4" />
        </mesh>
      </group>
      {/* 2 zampe articolate per la camminata */}
      {([0.09, -0.09] as const).map((lz, idx) => (
        <group key={idx} ref={(el) => zampeRef(el, idx)} position={[0.02 * s, 0.22 * s, lz * s]}>
          <mesh position={[0, -0.11 * s, 0]}>
            <cylinderGeometry args={[0.032 * s, 0.024 * s, 0.22 * s, 6]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// SPECIE RARA 2 (fallback procedurale se GLTF non è carico): Lince Alpina (Lynx lynx)
function ModelloLince({ s }: { s: number }) {
  return (
    <group>
      <mesh position={[0, 0.38 * s, 0]} scale={[1.4, 0.78, 0.68]}>
        <dodecahedronGeometry args={[0.3 * s, 1]} />
        <meshStandardMaterial color="#d4a373" roughness={0.75} />
      </mesh>
      <mesh position={[0.38 * s, 0.52 * s, 0]}>
        <sphereGeometry args={[0.14 * s, 10, 10]} />
        <meshStandardMaterial color="#d4a373" />
      </mesh>
      <mesh position={[0.38 * s, 0.68 * s, 0.08 * s]}>
        <coneGeometry args={[0.04 * s, 0.14 * s, 5]} />
        <meshStandardMaterial color="#1b1b1b" />
      </mesh>
      <mesh position={[0.38 * s, 0.68 * s, -0.08 * s]}>
        <coneGeometry args={[0.04 * s, 0.14 * s, 5]} />
        <meshStandardMaterial color="#1b1b1b" />
      </mesh>
    </group>
  )
}

// SPECIE RARA 3: Salamandra Nera di Aurora (Salamandra atra aurorae) con coda e zampe animate
function ModelloSalamandraAurora({
  s,
  zampeRef,
  codaRef,
}: {
  s: number
  zampeRef: (el: THREE.Group | null, idx: number) => void
  codaRef: (el: THREE.Group | null) => void
}) {
  return (
    <group>
      <mesh position={[0, 0.1 * s, 0]} scale={[1.8, 0.45, 0.65]}>
        <dodecahedronGeometry args={[0.18 * s, 1]} />
        <meshStandardMaterial color="#141414" roughness={0.2} />
      </mesh>
      <mesh position={[0.06 * s, 0.17 * s, 0]} scale={[1.5, 0.3, 0.75]}>
        <sphereGeometry args={[0.13 * s, 8, 8]} />
        <meshStandardMaterial
          color="#ffd60a"
          emissive="#ffb703"
          emissiveIntensity={0.35}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0.32 * s, 0.12 * s, 0]} scale={[1.2, 0.65, 0.9]}>
        <sphereGeometry args={[0.11 * s, 8, 8]} />
        <meshStandardMaterial color="#141414" roughness={0.2} />
      </mesh>
      <mesh position={[0.28 * s, 0.18 * s, 0]}>
        <sphereGeometry args={[0.07 * s, 8, 8]} />
        <meshStandardMaterial color="#ffd60a" emissive="#ffb703" emissiveIntensity={0.35} />
      </mesh>
      {/* Coda sinuosa animata */}
      <group ref={codaRef} position={[-0.22 * s, 0.08 * s, 0]}>
        <mesh position={[-0.16 * s, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.065 * s, 0.36 * s, 8]} />
          <meshStandardMaterial color="#141414" roughness={0.25} />
        </mesh>
      </group>
      {/* 4 zampe anfibie animate */}
      {(
        [
          [0.18, 0.13],
          [0.18, -0.13],
          [-0.16, 0.13],
          [-0.16, -0.13],
        ] as const
      ).map(([lx, lz], idx) => (
        <group
          key={idx}
          ref={(el) => zampeRef(el, idx)}
          position={[lx * s, 0.08 * s, lz * s]}
        >
          <mesh position={[0, -0.03 * s, (lz > 0 ? 0.04 : -0.04) * s]} rotation={[lz > 0 ? 0.5 : -0.5, 0, 0]}>
            <cylinderGeometry args={[0.024 * s, 0.018 * s, 0.12 * s, 6]} />
            <meshStandardMaterial color="#141414" roughness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Fauna autoctona della Provincia di Vicenza (Capriolo, Cervo Reale, Volpe Rossa, Lupo Alpino,
// Cicogna/Airone/Poiana, Aquila Reale, Gallo Cedrone, Lince Alpina e Salamandra di Aurora)
// con animazioni scheletriche/morph complete e collision avoidance rigorosa attorno alle case.
export function Fauna({
  anello,
  centro,
  dimensione,
  y,
  preset,
  ostacoli = [],
  totale = 75,
  aria = 75,
  infrastrutture = 0,
  scenario = 0,
}: {
  anello: Punto[]
  centro: Punto
  dimensione: number
  y: number
  preset: { current: PresetVisivo }
  ostacoli?: Ostacolo[]
  totale?: number
  aria?: number
  infrastrutture?: number
  scenario?: number
}) {
  const uccelli = useRef<(THREE.Group | null)[]>([])
  const ali = useRef<[THREE.Group | null, THREE.Group | null][]>([])
  const aquilaRef = useRef<THREE.Group | null>(null)
  const aliAquila = useRef<[THREE.Group | null, THREE.Group | null]>([null, null])

  const animali = useRef<(THREE.Group | null)[]>([])
  const zampeAnimali = useRef<(THREE.Group | null)[][]>(
    Array.from({ length: ANIMALI_MAX }, () => [null, null, null, null]),
  )
  const colliAnimali = useRef<(THREE.Group | null)[]>([])
  const rariTerra = useRef<(THREE.Group | null)[]>([])

  // Riferimenti per animare anche Gallo Cedrone e Salamandra di Aurora
  const zampeGallo = useRef<(THREE.Group | null)[]>([null, null])
  const colloGallo = useRef<THREE.Group | null>(null)
  const codaGallo = useRef<THREE.Group | null>(null)
  const zampeSalamandra = useRef<(THREE.Group | null)[]>([null, null, null, null])
  const codaSalamandra = useRef<THREE.Group | null>(null)

  // Caricamento modelli 3D .glb autoctoni della zona vicentina
  const gltfDeer = useModelloGLTF(CATALOGO_MODELLI_3D.deer)
  const gltfStag = useModelloGLTF(CATALOGO_MODELLI_3D.stag)
  const gltfFox = useModelloGLTF(CATALOGO_MODELLI_3D.fox)
  const gltfWolf = useModelloGLTF(CATALOGO_MODELLI_3D.wolf)
  const gltfStork = useModelloGLTF(CATALOGO_MODELLI_3D.stork)

  // Creazione delle istanze 3D animate (senza mai fermare i mixer nel cleanup di StrictMode)
  const istanzeGltf = useMemo(() => {
    const tutteIstanze: IstanzaAnimata[] = []

    // Avifauna vicentina (Cicogna bianca, Airone cenerino, Poiana comune, Corvo imperiale)
    const tinteUccelli = ["#eceff1", "#5d4037", "#37474f", "#455a64"]
    const cloniUccelli: (IstanzaAnimata | null)[] = Array.from({ length: UCCELLI_MAX }, (_, i) => {
      if (!gltfStork) return null
      const ist = creaIstanzaAnimata(gltfStork, {
        clipMovimento: ["storkFly_B_"],
        velocitaAnim: 0.9 + (i % 4) * 0.14,
        sfasamento: (i * 0.37) % 1.4,
        tinta: tinteUccelli[i % tinteUccelli.length],
        intensitaTinta: i % 4 === 0 ? 0.1 : 0.55,
      })
      tutteIstanze.push(ist)
      return ist
    })

    // Aquila Reale (Aquila chrysaetos)
    let cloneAquila: IstanzaAnimata | null = null
    if (gltfStork) {
      cloneAquila = creaIstanzaAnimata(gltfStork, {
        clipMovimento: ["storkFly_B_"],
        velocitaAnim: 0.58,
        tinta: "#4e342e",
        intensitaTinta: 0.78,
        roughness: 0.65,
      })
      tutteIstanze.push(cloneAquila)
    }

    // Fauna terrestre autoctona:
    // i % 4 === 0 -> Capriolo (Deer.glb)
    // i % 4 === 1 -> Volpe Rossa (Fox.glb)
    // i % 4 === 2 -> Cervo Reale coi palchi (Stag.glb)
    // i % 4 === 3 -> Lupo Alpino della Lessinia / Altopiano (Wolf.glb)
    const cloniAnimali: (IstanzaAnimata | null)[] = Array.from({ length: ANIMALI_MAX }, (_, i) => {
      const tipo = i % 4
      const sorgente =
        tipo === 0 ? gltfDeer : tipo === 1 ? gltfFox : tipo === 2 ? gltfStag : gltfWolf
      if (!sorgente) return null
      const ist = creaIstanzaAnimata(sorgente, {
        clipMovimento: ["Walk", "Gallop"],
        clipSosta: ["Eating", "Idle_Headlow", "Idle_2_HeadLow", "Idle"],
        velocitaAnim: 1.25 + (i % 3) * 0.15,
        sfasamento: (i * 0.43) % 1.2,
      })
      tutteIstanze.push(ist)
      return ist
    })

    // Lince Alpina (Lynx lynx) con animazione scheletrica Walk / Idle
    let cloneLince: IstanzaAnimata | null = null
    const baseLince = gltfFox ?? gltfWolf
    if (baseLince) {
      cloneLince = creaIstanzaAnimata(baseLince, {
        clipMovimento: ["Walk"],
        clipSosta: ["Idle", "Eating"],
        velocitaAnim: 1.2,
        tinta: "#d4a373",
        intensitaTinta: 0.65,
        soloMain: true,
      })
      tutteIstanze.push(cloneLince)
    }

    return { cloniUccelli, cloneAquila, cloniAnimali, cloneLince, tutteIstanze }
  }, [gltfDeer, gltfStag, gltfFox, gltfWolf, gltfStork])

  // Waypoint campionati fuori da tutte le case, strade e infrastrutture
  const waypoints = useMemo(
    () =>
      posizioniAlberi({
        poligono: anello,
        max: 56,
        densita: 1,
        seme: 99,
        ostacoli,
      }),
    [anello, ostacoli],
  )

  const s = dimensione * 0.03
  const raggioAnimale = 0.38 * s
  const t = useRef(0)

  const statiErranti = useRef<StatoErrante[]>([])
  const statiRari = useRef<StatoErrante[]>([])

  useEffect(() => {
    statiErranti.current = []
    statiRari.current = []
  }, [ostacoli, waypoints])

  const { spawnRate } = useMemo(
    () => calcolaSpawnSpecieRare({ aria, infrastrutture, scenario, totale }),
    [aria, infrastrutture, scenario, totale],
  )

  useFrame((_, dt) => {
    const delta = Math.min(dt, 0.1)
    t.current += delta
    const time = t.current

    // Assicura che ogni clip sia attiva e aggiorna tutti i mixer scheletrici/morph ad ogni frame
    for (const ist of istanzeGltf.tutteIstanze) {
      ist.assicuraAttiva()
      ist.mixer.update(delta)
    }

    const nU = Math.round(preset.current.uccelli)
    const nA = Math.round(preset.current.animali)

    // 1. UCCELLI AUTOCTONI: volo organico multi-armonica (Lissajous + deriva, mai circolare)
    for (let i = 0; i < UCCELLI_MAX; i++) {
      const g = uccelli.current[i]
      if (!g) continue
      g.visible = i < nU
      if (!g.visible) continue

      const w1 = 0.26 + 0.037 * (i % 5)
      const w2 = 0.41 + 0.029 * ((i * 3) % 7)
      const w3 = 0.19 + 0.031 * ((i * 2) % 5)
      const fase = i * 2.39996

      const rx = dimensione * (0.24 + 0.045 * (i % 4))
      const rz = dimensione * (0.22 + 0.05 * ((i + 2) % 4))

      const posX =
        centro[0] +
        rx * (Math.sin(time * w1 + fase) * 0.72 + Math.sin(time * w2 * 1.3 - fase) * 0.28)
      const posZ =
        centro[1] +
        rz * (Math.cos(time * w2 + fase * 0.7) * 0.68 + Math.sin(time * w3 * 1.7 + i) * 0.32)

      const vx =
        rx *
        (w1 * Math.cos(time * w1 + fase) * 0.72 +
          w2 * 1.3 * Math.cos(time * w2 * 1.3 - fase) * 0.28)
      const vz =
        rz *
        (-w2 * Math.sin(time * w2 + fase * 0.7) * 0.68 +
          w3 * 1.7 * Math.cos(time * w3 * 1.7 + i) * 0.32)

      const quotaOndulata =
        y +
        dimensione * (0.2 + 0.035 * (i % 3)) +
        Math.sin(time * 1.1 + i * 1.3) * s * 0.9

      g.position.set(posX, quotaOndulata, posZ)
      const yaw = Math.atan2(vx, vz) - Math.PI / 2
      g.rotation.y = yaw
      g.rotation.z = Math.sin(time * w2 + fase) * 0.22

      const cicloPlanata = Math.sin(time * 1.4 + i * 1.9)
      const ampiezzaBattito = cicloPlanata > 0.35 ? 0.08 : 0.62
      const battito = Math.sin(time * 10.5 + i * 1.1) * ampiezzaBattito + 0.08
      const [sx, dx] = ali.current[i] ?? [null, null]
      if (sx) sx.rotation.x = battito
      if (dx) dx.rotation.x = -battito
    }

    // 2. SPECIE RARA IN VOLO: Aquila Reale (compare quando spawnRate >= 0.45)
    if (aquilaRef.current) {
      const visibileAquila = spawnRate >= 0.45 && nU > 0
      aquilaRef.current.visible = visibileAquila
      if (visibileAquila) {
        const wa = 0.16
        const wb = 0.23
        const ax =
          centro[0] +
          dimensione * 0.34 * (Math.sin(time * wa) * 0.8 + Math.cos(time * wb * 1.4) * 0.2)
        const az =
          centro[1] +
          dimensione * 0.32 * (Math.cos(time * wb) * 0.75 + Math.sin(time * wa * 1.6) * 0.25)
        const avx =
          dimensione *
          0.34 *
          (wa * Math.cos(time * wa) * 0.8 - wb * 1.4 * Math.sin(time * wb * 1.4) * 0.2)
        const avz =
          dimensione *
          0.32 *
          (-wb * Math.sin(time * wb) * 0.75 + wa * 1.6 * Math.cos(time * wa * 1.6) * 0.25)

        aquilaRef.current.position.set(
          ax,
          y + dimensione * 0.36 + Math.sin(time * 0.7) * s * 1.2,
          az,
        )
        aquilaRef.current.rotation.y = Math.atan2(avx, avz) - Math.PI / 2
        aquilaRef.current.rotation.z = Math.sin(time * wb) * 0.18
        const battitoAq = Math.sin(time * 4.2) * 0.22 + 0.06
        if (aliAquila.current[0]) aliAquila.current[0].rotation.x = battitoAq
        if (aliAquila.current[1]) aliAquila.current[1].rotation.x = -battitoAq
      }
    }

    if (waypoints.length === 0) return

    // 3. ANIMALI TERRESTRI AUTOCTONI (Capriolo, Volpe, Cervo Reale, Lupo Alpino):
    // camminata animata `Walk` durante gli spostamenti e `Eating`/`Idle` durante le soste
    for (let i = 0; i < ANIMALI_MAX; i++) {
      const m = animali.current[i]
      if (!m) continue
      m.visible = i < nA
      if (!m.visible) continue

      let st = statiErranti.current[i]
      if (!st) {
        const start = waypoints[i % waypoints.length]!
        const dest = scegliWaypointSicuro(start, waypoints, ostacoli, i * 7 + 3, raggioAnimale)
        st = {
          x: start[0],
          z: start[1],
          targetX: dest[0],
          targetZ: dest[1],
          angolo: i * 1.1,
          pausa: 0,
          fasePasso: i * 1.7,
          velocita: (1.08 + (i % 3) * 0.3) * s,
        }
        statiErranti.current[i] = st
      }

      const istanzaGltf = istanzeGltf.cloniAnimali[i]
      const zampe = zampeAnimali.current[i] ?? []
      const collo = colliAnimali.current[i]

      if (st.pausa > 0) {
        st.pausa -= delta
        istanzaGltf?.impostaMovimento(false)
        for (const zmp of zampe) if (zmp) zmp.rotation.z *= 0.85
        if (collo) collo.rotation.z = -0.35 + Math.sin(time * 3.5 + i) * 0.08
      } else {
        istanzaGltf?.impostaMovimento(true)
        const dx = st.targetX - st.x
        const dz = st.targetZ - st.z
        const dist = Math.hypot(dx, dz)

        if (dist < 0.55 * s) {
          const idxPref =
            Math.floor(Math.abs(Math.sin(time * 13.7 + i * 4.3)) * waypoints.length) %
            waypoints.length
          const nuovo = scegliWaypointSicuro(
            [st.x, st.z],
            waypoints,
            ostacoli,
            idxPref,
            raggioAnimale,
          )
          st.targetX = nuovo[0]
          st.targetZ = nuovo[1]
          st.pausa = 1.1 + ((i * 5 + Math.floor(time)) % 3) * 0.65
        } else {
          const deviazione = Math.sin(time * 1.9 + i * 2.7) * 0.25
          const passo = avanzaAnimaleEvitandoOstacoli({
            x: st.x,
            z: st.z,
            targetX: st.targetX,
            targetZ: st.targetZ,
            angolo: st.angolo,
            velocita: st.velocita,
            dt: delta,
            deviazione,
            ostacoli,
            anello,
            raggioAnimale,
          })
          st.x = passo.x
          st.z = passo.z
          st.angolo = passo.angolo
          st.fasePasso += delta * 9.5

          if (passo.collisione) {
            const idxAlt = (Math.floor(time * 7) + i * 5) % waypoints.length
            const alt = scegliWaypointSicuro(
              [st.x, st.z],
              waypoints,
              ostacoli,
              idxAlt,
              raggioAnimale,
            )
            st.targetX = alt[0]
            st.targetZ = alt[1]
          }

          const osc = Math.sin(st.fasePasso) * 0.48
          if (zampe[0]) zampe[0].rotation.z = osc
          if (zampe[1]) zampe[1].rotation.z = -osc
          if (zampe[2]) zampe[2].rotation.z = -osc
          if (zampe[3]) zampe[3].rotation.z = osc
          if (collo) collo.rotation.z = Math.sin(st.fasePasso * 0.5) * 0.06
        }
      }

      m.position.set(st.x, y, st.z)
      m.rotation.y = st.angolo - Math.PI / 2
    }

    // 4. SPECIE RARE TERRESTRI (Gallo Cedrone >= 0.25, Lince >= 0.65, Salamandra di Aurora >= 0.80)
    const soglieRari = [0.25, 0.65, 0.8]
    for (let r = 0; r < RARI_TERRA_MAX; r++) {
      const grp = rariTerra.current[r]
      if (!grp) continue
      const attivo = spawnRate >= soglieRari[r]! && nA > 0
      grp.visible = attivo
      if (!attivo) continue

      let st = statiRari.current[r]
      if (!st) {
        const pStart = waypoints[(r * 11 + 5) % waypoints.length]!
        const pDest = scegliWaypointSicuro(
          pStart,
          waypoints,
          ostacoli,
          r * 13 + 9,
          raggioAnimale,
        )
        st = {
          x: pStart[0],
          z: pStart[1],
          targetX: pDest[0],
          targetZ: pDest[1],
          angolo: r * 2.1,
          pausa: 0,
          fasePasso: 0,
          velocita: (r === 2 ? 0.55 : 0.95) * s,
        }
        statiRari.current[r] = st
      }

      if (st.pausa > 0) {
        st.pausa -= delta
        if (r === 1) istanzeGltf.cloneLince?.impostaMovimento(false)
        if (r === 0) {
          for (const zg of zampeGallo.current) if (zg) zg.rotation.z *= 0.85
          if (colloGallo.current) colloGallo.current.rotation.z = -0.25 + Math.sin(time * 4) * 0.08
        }
      } else {
        if (r === 1) istanzeGltf.cloneLince?.impostaMovimento(true)
        const dx = st.targetX - st.x
        const dz = st.targetZ - st.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.5 * s) {
          const nextIdx =
            Math.floor(Math.abs(Math.cos(time * 9.3 + r * 3.1)) * waypoints.length) %
            waypoints.length
          const pt = scegliWaypointSicuro(
            [st.x, st.z],
            waypoints,
            ostacoli,
            nextIdx,
            raggioAnimale,
          )
          st.targetX = pt[0]
          st.targetZ = pt[1]
          st.pausa = 1.2 + r * 0.55
        } else {
          const deviazione = Math.sin(time * 1.6 + r * 3) * 0.2
          const passo = avanzaAnimaleEvitandoOstacoli({
            x: st.x,
            z: st.z,
            targetX: st.targetX,
            targetZ: st.targetZ,
            angolo: st.angolo,
            velocita: st.velocita,
            dt: delta,
            deviazione,
            ostacoli,
            anello,
            raggioAnimale,
          })
          st.x = passo.x
          st.z = passo.z
          st.angolo = passo.angolo
          st.fasePasso += delta * 10

          if (passo.collisione) {
            const alt = scegliWaypointSicuro(
              [st.x, st.z],
              waypoints,
              ostacoli,
              (r * 7 + Math.floor(time * 5)) % waypoints.length,
              raggioAnimale,
            )
            st.targetX = alt[0]
            st.targetZ = alt[1]
          }

          // Animazione articolata per Gallo Cedrone (r === 0)
          if (r === 0) {
            const oscG = Math.sin(st.fasePasso) * 0.52
            if (zampeGallo.current[0]) zampeGallo.current[0].rotation.z = oscG
            if (zampeGallo.current[1]) zampeGallo.current[1].rotation.z = -oscG
            if (colloGallo.current) {
              colloGallo.current.rotation.z = Math.sin(st.fasePasso * 2) * 0.14
            }
            if (codaGallo.current) {
              codaGallo.current.rotation.y = Math.sin(st.fasePasso) * 0.16
            }
          }

          // Animazione sinuosa anfibia per Salamandra Nera di Aurora (r === 2)
          if (r === 2) {
            const oscS = Math.sin(st.fasePasso * 1.2) * 0.45
            if (zampeSalamandra.current[0]) zampeSalamandra.current[0].rotation.y = oscS
            if (zampeSalamandra.current[1]) zampeSalamandra.current[1].rotation.y = -oscS
            if (zampeSalamandra.current[2]) zampeSalamandra.current[2].rotation.y = -oscS
            if (zampeSalamandra.current[3]) zampeSalamandra.current[3].rotation.y = oscS
            if (codaSalamandra.current) {
              codaSalamandra.current.rotation.y = Math.sin(st.fasePasso * 1.2) * 0.38
            }
          }
        }
      }

      grp.position.set(st.x, y, st.z)
      grp.rotation.y = st.angolo - Math.PI / 2
    }
  })

  return (
    <>
      {/* Avifauna autoctona (Cicogna bianca, Airone, Poiana, Corvo imperiale — modello 3D Stork.glb animato) */}
      {Array.from({ length: UCCELLI_MAX }, (_, i) => {
        const istUccello = istanzeGltf.cloniUccelli[i]
        return (
          <group
            key={`u${i}`}
            ref={(g) => {
              uccelli.current[i] = g
            }}
            visible={false}
          >
            {istUccello ? (
              <primitive
                object={istUccello.oggetto}
                rotation={[0, Math.PI / 2, 0]}
                scale={0.0085 * s}
              />
            ) : (
              <>
                <mesh scale={[1.65, 0.62, 0.72]}>
                  <dodecahedronGeometry args={[s * 0.36, 1]} />
                  <meshStandardMaterial color={i % 2 === 0 ? "#263238" : "#455a64"} roughness={0.7} />
                </mesh>
                <mesh position={[s * 0.08, -s * 0.06, 0]} scale={[1.2, 0.5, 0.6]}>
                  <sphereGeometry args={[s * 0.3, 8, 8]} />
                  <meshStandardMaterial color="#eceff1" />
                </mesh>
                <mesh position={[s * 0.52, s * 0.08, 0]}>
                  <sphereGeometry args={[s * 0.2, 8, 8]} />
                  <meshStandardMaterial color="#263238" />
                </mesh>
                <mesh position={[s * 0.74, s * 0.06, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[s * 0.065, s * 0.2, 6]} />
                  <meshStandardMaterial color="#ffb703" />
                </mesh>
                <mesh position={[-s * 0.62, s * 0.04, 0]} rotation={[0, 0, 0.15]} scale={[1.1, 0.15, 0.9]}>
                  <boxGeometry args={[s * 0.45, s * 0.08, s * 0.42]} />
                  <meshStandardMaterial color="#263238" />
                </mesh>
                <group
                  ref={(m) => {
                    ali.current[i] = [m, ali.current[i]?.[1] ?? null]
                  }}
                  position={[0, s * 0.05, s * 0.18]}
                >
                  <mesh position={[0, 0, s * 0.52]} rotation={[0, -0.12, 0]}>
                    <boxGeometry args={[s * 0.56, s * 0.04, s * 1.05]} />
                    <meshStandardMaterial color="#37474f" />
                  </mesh>
                </group>
                <group
                  ref={(m) => {
                    ali.current[i] = [ali.current[i]?.[0] ?? null, m]
                  }}
                  position={[0, s * 0.05, -s * 0.18]}
                >
                  <mesh position={[0, 0, -s * 0.52]} rotation={[0, 0.12, 0]}>
                    <boxGeometry args={[s * 0.56, s * 0.04, s * 1.05]} />
                    <meshStandardMaterial color="#37474f" />
                  </mesh>
                </group>
              </>
            )}
          </group>
        )
      })}

      {/* Aquila Reale (Aquila chrysaetos) in quota */}
      <group ref={aquilaRef} visible={false}>
        {istanzeGltf.cloneAquila ? (
          <primitive
            object={istanzeGltf.cloneAquila.oggetto}
            rotation={[0, Math.PI / 2, 0]}
            scale={0.0135 * s}
          />
        ) : (
          <>
            <mesh scale={[1.8, 0.68, 0.8]}>
              <dodecahedronGeometry args={[s * 0.52, 1]} />
              <meshStandardMaterial color="#4e342e" roughness={0.7} />
            </mesh>
            <mesh position={[s * 0.78, s * 0.1, 0]}>
              <sphereGeometry args={[s * 0.28, 8, 8]} />
              <meshStandardMaterial color="#b08968" />
            </mesh>
            <mesh position={[s * 1.06, s * 0.06, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[s * 0.1, s * 0.28, 6]} />
              <meshStandardMaterial color="#ffb703" />
            </mesh>
            <group
              ref={(m) => {
                aliAquila.current[0] = m
              }}
              position={[0, s * 0.06, s * 0.25]}
            >
              <mesh position={[0, 0, s * 0.9]}>
                <boxGeometry args={[s * 0.82, s * 0.05, s * 1.8]} />
                <meshStandardMaterial color="#3e2723" />
              </mesh>
            </group>
            <group
              ref={(m) => {
                aliAquila.current[1] = m
              }}
              position={[0, s * 0.06, -s * 0.25]}
            >
              <mesh position={[0, 0, -s * 0.9]}>
                <boxGeometry args={[s * 0.82, s * 0.05, s * 1.8]} />
                <meshStandardMaterial color="#3e2723" />
              </mesh>
            </group>
          </>
        )}
      </group>

      {/* Fauna terrestre autoctona animata: Capriolo (Deer.glb), Volpe Rossa (Fox.glb), Cervo Reale (Stag.glb), Lupo Alpino (Wolf.glb) */}
      {Array.from({ length: ANIMALI_MAX }, (_, i) => {
        const istAnimale = istanzeGltf.cloniAnimali[i]
        const tipo = i % 4
        // Scale proporzionate alle altezze reali dei modelli .glb (Deer=4.27, Fox=2.67, Stag=5.38, Wolf=2.67)
        const scalaGltf =
          tipo === 0 ? 0.22 * s : tipo === 1 ? 0.24 * s : tipo === 2 ? 0.21 * s : 0.26 * s
        return (
          <group
            key={`a${i}`}
            ref={(m) => {
              animali.current[i] = m
            }}
            visible={false}
          >
            {istAnimale ? (
              <primitive
                object={istAnimale.oggetto}
                rotation={[0, Math.PI / 2, 0]}
                scale={scalaGltf}
              />
            ) : tipo % 2 === 0 ? (
              <ModelloCapriolo
                s={s * 1.15}
                zampeRef={(el, idx) => {
                  if (!zampeAnimali.current[i]) {
                    zampeAnimali.current[i] = [null, null, null, null]
                  }
                  zampeAnimali.current[i]![idx] = el
                }}
                colloRef={(el) => {
                  colliAnimali.current[i] = el
                }}
              />
            ) : (
              <ModelloVolpe
                s={s * 1.1}
                zampeRef={(el, idx) => {
                  if (!zampeAnimali.current[i]) {
                    zampeAnimali.current[i] = [null, null, null, null]
                  }
                  zampeAnimali.current[i]![idx] = el
                }}
                colloRef={(el) => {
                  colliAnimali.current[i] = el
                }}
              />
            )}
          </group>
        )
      })}

      {/* Specie rare / in via d'estinzione della Provincia di Vicenza (tutte animate) */}
      <group
        ref={(el) => {
          rariTerra.current[0] = el
        }}
        visible={false}
      >
        <ModelloGalloCedrone
          s={s * 1.2}
          zampeRef={(el, idx) => {
            zampeGallo.current[idx] = el
          }}
          colloRef={(el) => {
            colloGallo.current = el
          }}
          codaRef={(el) => {
            codaGallo.current = el
          }}
        />
      </group>
      <group
        ref={(el) => {
          rariTerra.current[1] = el
        }}
        visible={false}
      >
        {istanzeGltf.cloneLince ? (
          <primitive
            object={istanzeGltf.cloneLince.oggetto}
            rotation={[0, Math.PI / 2, 0]}
            scale={0.27 * s}
          />
        ) : (
          <ModelloLince s={s * 1.2} />
        )}
      </group>
      <group
        ref={(el) => {
          rariTerra.current[2] = el
        }}
        visible={false}
      >
        <ModelloSalamandraAurora
          s={s * 1.25}
          zampeRef={(el, idx) => {
            zampeSalamandra.current[idx] = el
          }}
          codaRef={(el) => {
            codaSalamandra.current = el
          }}
        />
      </group>
    </>
  )
}
