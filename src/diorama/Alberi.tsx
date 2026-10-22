import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { CATALOGO_MODELLI_3D, useModelloGLTF } from "./modelli3d"
import { posizioniAlberi, type Ostacolo } from "./posizioniAlberi"
import type { Punto } from "./geometria"
import type { PresetVisivo } from "./preset"

const MAX_ALBERI = 160
const CHIOMA_BASSA_VIVA = new THREE.Color("#1b4332")
const CHIOMA_MEDIA_VIVA = new THREE.Color("#2d6a4f")
const CHIOMA_ALTA_VIVA = new THREE.Color("#40916c")
const CHIOMA_SECCA = new THREE.Color("#8a7a4a")

// Scala deterministica per ogni albero (0.78 – 1.26) così il bosco ha altezze naturali variegate
function scalaAlbero(i: number): number {
  return 0.78 + ((i * 37) % 17) * 0.03
}

// Alberi istanziati realistici che combinano il modello 3D glTF (tree.glb + Flower.glb)
// con conifere alpine a più livelli (tronco + rami + 3 palchi di chioma).
// Nessun albero cresce su strade, case o altre infrastrutture grazie a `ostacoli`.
export function Alberi({
  anello,
  seme,
  ostacoli,
  y,
  s,
  preset,
}: {
  anello: Punto[]
  seme: number
  ostacoli: Ostacolo[]
  y: number
  s: number
  preset: { current: PresetVisivo }
}) {
  const tronchi = useRef<THREE.InstancedMesh>(null)
  const rami = useRef<THREE.InstancedMesh>(null)
  const chiomeBasse = useRef<THREE.InstancedMesh>(null)
  const chiomeMedie = useRef<THREE.InstancedMesh>(null)
  const chiomeAlte = useRef<THREE.InstancedMesh>(null)
  const alberiGltfRef = useRef<THREE.InstancedMesh>(null)

  const matBassa = useRef<THREE.MeshStandardMaterial>(null)
  const matMedia = useRef<THREE.MeshStandardMaterial>(null)
  const matAlta = useRef<THREE.MeshStandardMaterial>(null)
  const fogliameApplicato = useRef(-1)

  const gltfTree = useModelloGLTF(CATALOGO_MODELLI_3D.tree)
  const gltfFlower = useModelloGLTF(CATALOGO_MODELLI_3D.flower)

  // Estrae geometria e materiale dal modello 3D scaricato /models/tree.glb
  const meshTreeGltf = useMemo(() => {
    if (!gltfTree) return null
    const candidati: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
    gltfTree.scene.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (candidati.length === 0 && m.isMesh && m.geometry && !Array.isArray(m.material)) {
        candidati.push({ geometry: m.geometry, material: m.material })
      }
    })
    return candidati[0] ?? null
  }, [gltfTree])

  const posizioni = useMemo(
    () => posizioniAlberi({ poligono: anello, max: MAX_ALBERI, densita: 1, seme, ostacoli }),
    [anello, seme, ostacoli],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const euler = useMemo(() => new THREE.Euler(), [])

  useEffect(() => {
    const t = tronchi.current
    const r = rami.current
    if (!t || !r) return
    posizioni.forEach(([x, z], i) => {
      const sc = scalaAlbero(i)
      const rotY = ((i * 73) % 360) * (Math.PI / 180)
      q.setFromEuler(euler.set(0, rotY, 0))
      t.setMatrixAt(
        i,
        m.compose(
          new THREE.Vector3(x, y + 0.36 * s * sc, z),
          q,
          new THREE.Vector3(sc, sc, sc),
        ),
      )
      q.setFromEuler(euler.set(0.45, rotY + 0.8, 0.35))
      r.setMatrixAt(
        i,
        m.compose(
          new THREE.Vector3(x, y + 0.62 * s * sc, z),
          q,
          new THREE.Vector3(sc, sc, sc),
        ),
      )
    })
    t.instanceMatrix.needsUpdate = true
    r.instanceMatrix.needsUpdate = true
    fogliameApplicato.current = -1
  }, [posizioni, y, s, m, q, euler, meshTreeGltf])

  useFrame(() => {
    const t = tronchi.current
    const r = rami.current
    const cb = chiomeBasse.current
    const cm = chiomeMedie.current
    const ca = chiomeAlte.current
    const ag = alberiGltfRef.current
    if (!t || !r || !cb || !cm || !ca) return

    const n = Math.round(preset.current.densitaAlberi * posizioni.length)
    t.count = n
    r.count = n
    cb.count = n
    cm.count = n
    ca.count = n
    if (ag) ag.count = n

    const f = preset.current.fogliame
    if (f !== fogliameApplicato.current) {
      fogliameApplicato.current = f
      const k = Math.max(f, 0.001)
      posizioni.forEach(([x, z], i) => {
        const sc = scalaAlbero(i)
        const kf = k * sc
        const rotY = ((i * 53) % 360) * (Math.PI / 180)
        q.setFromEuler(euler.set(0, rotY, 0))

        // Ogni 3 alberi usa il modello 3D latifoglia glTF (tree.glb) quando carico
        const usaGltf = !!ag && i % 3 === 0
        const kConifera = usaGltf ? 0.0001 : kf

        cb.setMatrixAt(
          i,
          m.compose(
            new THREE.Vector3(x, y + 0.78 * s * sc, z),
            q,
            new THREE.Vector3(kConifera, kConifera, kConifera),
          ),
        )
        cm.setMatrixAt(
          i,
          m.compose(
            new THREE.Vector3(x, y + 1.08 * s * sc, z),
            q,
            new THREE.Vector3(kConifera, kConifera, kConifera),
          ),
        )
        ca.setMatrixAt(
          i,
          m.compose(
            new THREE.Vector3(x, y + 1.36 * s * sc, z),
            q,
            new THREE.Vector3(kConifera, kConifera, kConifera),
          ),
        )

        if (ag) {
          // La geometria nativa di tree.glb è alta ~509 unità; la scaliamo all'altezza del bosco (1.55 * s)
          const kGltf = usaGltf ? ((1.55 * s * kf) / 509.08) : 0.000001
          ag.setMatrixAt(
            i,
            m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(kGltf, kGltf, kGltf)),
          )
        }
      })
      cb.instanceMatrix.needsUpdate = true
      cm.instanceMatrix.needsUpdate = true
      ca.instanceMatrix.needsUpdate = true
      if (ag) ag.instanceMatrix.needsUpdate = true
      matBassa.current?.color.lerpColors(CHIOMA_BASSA_VIVA, CHIOMA_SECCA, 1 - f)
      matMedia.current?.color.lerpColors(CHIOMA_MEDIA_VIVA, CHIOMA_SECCA, 1 - f)
      matAlta.current?.color.lerpColors(CHIOMA_ALTA_VIVA, CHIOMA_SECCA, 1 - f)
    }
  })

  // Sottobosco fiorito 3D (Flower.glb) visibile nei prati puliti
  const fioriScena = useMemo(() => {
    if (!gltfFlower || posizioni.length === 0) return []
    return posizioni.slice(0, 12).map(([x, z], idx) => ({
      id: idx,
      pos: [x + 0.28 * s, y, z + 0.22 * s] as [number, number, number],
      rotY: (idx * 1.3) % (Math.PI * 2),
      clone: gltfFlower.scene.clone(true),
    }))
  }, [gltfFlower, posizioni, y, s])

  return (
    <>
      {/* Modello 3D glTF di albero (tree.glb) istanziato */}
      {meshTreeGltf && (
        <instancedMesh
          ref={alberiGltfRef}
          args={[meshTreeGltf.geometry, meshTreeGltf.material, MAX_ALBERI]}
          frustumCulled={false}
        />
      )}
      {/* Tronco principale rastremato */}
      <instancedMesh ref={tronchi} args={[undefined, undefined, MAX_ALBERI]} frustumCulled={false}>
        <cylinderGeometry args={[0.065 * s, 0.115 * s, 0.74 * s, 7]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </instancedMesh>
      {/* Rami legnosi secondari (visibili quando la chioma è spoglia) */}
      <instancedMesh ref={rami} args={[undefined, undefined, MAX_ALBERI]} frustumCulled={false}>
        <cylinderGeometry args={[0.025 * s, 0.045 * s, 0.48 * s, 5]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
      </instancedMesh>
      {/* Palco inferiore della chioma */}
      <instancedMesh
        ref={chiomeBasse}
        args={[undefined, undefined, MAX_ALBERI]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.48 * s, 0.65 * s, 8]} />
        <meshStandardMaterial ref={matBassa} color="#1b4332" roughness={0.8} flatShading />
      </instancedMesh>
      {/* Palco intermedio della chioma */}
      <instancedMesh
        ref={chiomeMedie}
        args={[undefined, undefined, MAX_ALBERI]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.38 * s, 0.58 * s, 8]} />
        <meshStandardMaterial ref={matMedia} color="#2d6a4f" roughness={0.78} flatShading />
      </instancedMesh>
      {/* Cima dell'albero */}
      <instancedMesh
        ref={chiomeAlte}
        args={[undefined, undefined, MAX_ALBERI]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.26 * s, 0.5 * s, 8]} />
        <meshStandardMaterial ref={matAlta} color="#40916c" roughness={0.75} flatShading />
      </instancedMesh>
      {/* Flora fiorita 3D (Flower.glb) ai piedi del bosco quando il fogliame è rigoglioso */}
      {preset.current.fogliame > 0.55 &&
        fioriScena.map((f) => (
          <primitive
            key={`fl-${f.id}`}
            object={f.clone}
            position={f.pos}
            rotation={[0, f.rotY, 0]}
            scale={1.8 * s}
          />
        ))}
    </>
  )
}
