import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { posizioniAlberi, type Ostacolo } from "./posizioniAlberi"
import type { Punto } from "./geometria"
import type { PresetVisivo } from "./preset"

const MAX_ALBERI = 160
const CHIOMA_PIENA = new THREE.Color("#2e7d32")
const CHIOMA_SECCA = new THREE.Color("#8a7a4a")

// Alberi istanziati. La lista completa è fissa (dipende solo da comune e ostacoli): la densità
// del preset decide quanti se ne mostrano, la chioma si rimpicciolisce fino ai rami spogli.
export function Alberi({
  anello, seme, ostacoli, y, s, preset,
}: {
  anello: Punto[]
  seme: number
  ostacoli: Ostacolo[]
  y: number
  s: number
  preset: { current: PresetVisivo }
}) {
  const tronchi = useRef<THREE.InstancedMesh>(null)
  const chiome = useRef<THREE.InstancedMesh>(null)
  const materialeChioma = useRef<THREE.MeshStandardMaterial>(null)
  const fogliameApplicato = useRef(-1)
  const posizioni = useMemo(
    () => posizioniAlberi({ poligono: anello, max: MAX_ALBERI, densita: 1, seme, ostacoli }),
    [anello, seme, ostacoli],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    const t = tronchi.current
    if (!t) return
    posizioni.forEach(([x, z], i) => t.setMatrixAt(i, m.makeTranslation(x, y + 0.35 * s, z)))
    t.instanceMatrix.needsUpdate = true
    fogliameApplicato.current = -1 // forza il ricalcolo delle chiome
  }, [posizioni, y, s, m])

  useFrame(() => {
    const t = tronchi.current, c = chiome.current
    if (!t || !c) return
    const n = Math.round(preset.current.densitaAlberi * posizioni.length)
    t.count = n
    c.count = n
    const f = preset.current.fogliame
    if (f !== fogliameApplicato.current) {
      fogliameApplicato.current = f
      const k = Math.max(f, 0.001)
      posizioni.forEach(([x, z], i) => {
        c.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + 1.0 * s, z), new THREE.Quaternion(), new THREE.Vector3(k, k, k)))
      })
      c.instanceMatrix.needsUpdate = true
      materialeChioma.current?.color.lerpColors(CHIOMA_PIENA, CHIOMA_SECCA, 1 - f)
    }
  })

  return (
    <>
      <instancedMesh ref={tronchi} args={[undefined, undefined, MAX_ALBERI]} frustumCulled={false}>
        <cylinderGeometry args={[0.08 * s, 0.1 * s, 0.7 * s, 5]} />
        <meshStandardMaterial color="#6d4c41" flatShading />
      </instancedMesh>
      <instancedMesh ref={chiome} args={[undefined, undefined, MAX_ALBERI]} frustumCulled={false}>
        <coneGeometry args={[0.45 * s, 1.1 * s, 6]} />
        <meshStandardMaterial ref={materialeChioma} color="#2e7d32" flatShading />
      </instancedMesh>
    </>
  )
}
