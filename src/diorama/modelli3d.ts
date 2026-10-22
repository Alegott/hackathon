import { useEffect, useState } from "react"
import * as THREE from "three"
import { GLTFLoader, SkeletonUtils, type GLTF } from "three-stdlib"

export const CATALOGO_MODELLI_3D = {
  // Fauna terrestre autoctona del Vicentino (Quaternius CC0 Animated Animals — rig scheletrico completo)
  deer: "/models/Deer.glb", // Capriolo (Capreolus capreolus)
  stag: "/models/Stag.glb", // Cervo Reale coi palchi (Cervus elaphus)
  fox: "/models/Fox.glb", // Volpe Rossa (Vulpes vulpes)
  wolf: "/models/Wolf.glb", // Lupo Alpino della Lessinia / Altopiano (Canis lupus italicus)
  // Avifauna autoctona (Three.js Official — animazione morph-target del battito d'ali)
  stork: "/models/Stork.glb", // Cicogna bianca / Airone / Rapace in volo
  // Flora (Three.js & 8thWall Web Examples)
  tree: "/models/tree.glb",
  flower: "/models/Flower.glb",
} as const

export type IstanzaAnimata = {
  oggetto: THREE.Object3D
  mixer: THREE.AnimationMixer
  azioneMovimento: THREE.AnimationAction | null
  azioneSosta: THREE.AnimationAction | null
  inMovimento: boolean
  impostaMovimento: (attivo: boolean) => void
  assicuraAttiva: () => void
}

const cacheGLTF = new Map<string, GLTF>()
const inCaricamento = new Map<string, Promise<GLTF | null>>()

export function caricaGLTF(url: string): Promise<GLTF | null> {
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return Promise.resolve(null)
  }
  const gia = cacheGLTF.get(url)
  if (gia) return Promise.resolve(gia)

  const pendente = inCaricamento.get(url)
  if (pendente) return pendente

  const promessa = new Promise<GLTF | null>((resolve) => {
    try {
      const loader = new GLTFLoader()
      loader.load(
        url,
        (gltf) => {
          cacheGLTF.set(url, gltf)
          resolve(gltf)
        },
        undefined,
        () => resolve(null),
      )
    } catch {
      resolve(null)
    }
  })

  inCaricamento.set(url, promessa)
  return promessa
}

export function useModelloGLTF(url: string): GLTF | null {
  const [gltf, setGltf] = useState<GLTF | null>(() => cacheGLTF.get(url) ?? null)

  useEffect(() => {
    let attivo = true
    if (cacheGLTF.has(url)) {
      setGltf(cacheGLTF.get(url) ?? null)
      return
    }
    caricaGLTF(url).then((res) => {
      if (attivo && res) setGltf(res)
    })
    return () => {
      attivo = false
    }
  }, [url])

  return gltf
}

/**
 * Clona una scena GLTF preservando rig scheletrici (SkinnedMesh) e morph targets,
 * disabilitando il frustum culling sulle ossa e applicando opzionalmente una tinta sul manto principale.
 */
export function clonaScenaGLTF(
  gltf: GLTF,
  opzioni?: { tinta?: string; intensitaTinta?: number; roughness?: number; soloMain?: boolean },
): THREE.Object3D {
  const clone = SkeletonUtils.clone(gltf.scene)
  const coloreTinta = opzioni?.tinta ? new THREE.Color(opzioni.tinta) : null
  const kTinta = opzioni?.intensitaTinta ?? 0.45

  clone.traverse((nodo) => {
    const mesh = nodo as THREE.Mesh
    if (mesh.isMesh) {
      mesh.frustumCulled = false
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (coloreTinta && mesh.material && !Array.isArray(mesh.material)) {
        const nomeMat = mesh.material.name || ""
        if (!opzioni?.soloMain || nomeMat === "Main" || nomeMat === "Material" || nomeMat === "") {
          const mat = mesh.material.clone() as THREE.MeshStandardMaterial
          if (mat.color) {
            mat.color.lerp(coloreTinta, kTinta)
          }
          if (opzioni?.roughness !== undefined && "roughness" in mat) {
            mat.roughness = opzioni.roughness
          }
          mesh.material = mat
        }
      }
    }
  })
  return clone
}

/**
 * Crea un'istanza 3D animata indipendente con gestione automatica della transizione
 * tra l'animazione di camminata/volo (`Walk` / `storkFly_B_`) e quella di sosta/pascolo (`Eating` / `Idle`).
 */
export function creaIstanzaAnimata(
  gltf: GLTF,
  opzioni?: {
    clipMovimento?: string[]
    clipSosta?: string[]
    velocitaAnim?: number
    sfasamento?: number
    tinta?: string
    intensitaTinta?: number
    roughness?: number
    soloMain?: boolean
  },
): IstanzaAnimata {
  const oggetto = clonaScenaGLTF(gltf, opzioni)
  const mixer = new THREE.AnimationMixer(oggetto)

  const trovaClip = (nomi?: string[]) => {
    if (nomi) {
      for (const n of nomi) {
        const c = gltf.animations.find((a) => a.name.toLowerCase() === n.toLowerCase())
        if (c) return c
      }
    }
    return gltf.animations[0] ?? null
  }

  const clipMov = trovaClip(opzioni?.clipMovimento ?? ["Walk", "Gallop", "storkFly_B_"])
  const clipSos =
    opzioni?.clipSosta && opzioni.clipSosta.length > 0 ? trovaClip(opzioni.clipSosta) : null

  const azioneMovimento = clipMov ? mixer.clipAction(clipMov) : null
  const azioneSosta = clipSos && clipSos !== clipMov ? mixer.clipAction(clipSos) : null

  if (azioneMovimento) {
    azioneMovimento.timeScale = opzioni?.velocitaAnim ?? 1.15
    if (opzioni?.sfasamento) azioneMovimento.time = opzioni.sfasamento
    azioneMovimento.play()
  }
  if (azioneSosta) {
    azioneSosta.timeScale = 1.0
  }

  const istanza: IstanzaAnimata = {
    oggetto,
    mixer,
    azioneMovimento,
    azioneSosta,
    inMovimento: true,
    impostaMovimento(attivo: boolean) {
      if (attivo === istanza.inMovimento) return
      istanza.inMovimento = attivo
      if (!azioneSosta || !azioneMovimento) return
      if (attivo) {
        azioneSosta.fadeOut(0.25)
        azioneMovimento.reset().fadeIn(0.25).play()
      } else {
        azioneMovimento.fadeOut(0.25)
        azioneSosta.reset().fadeIn(0.25).play()
      }
    },
    assicuraAttiva() {
      const corrente = istanza.inMovimento ? azioneMovimento : (azioneSosta ?? azioneMovimento)
      if (corrente && !corrente.isRunning()) {
        corrente.reset().play()
      }
    },
  }

  return istanza
}
