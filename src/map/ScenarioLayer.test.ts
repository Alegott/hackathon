import { afterEach, expect, it, vi } from "vitest"
import * as THREE from "three"
import type { Map, CustomRenderMethodInput } from "maplibre-gl"
import { ScenarioLayer } from "./ScenarioLayer"

const { disegna } = vi.hoisted(() => ({ disegna: vi.fn() }))
vi.mock("three", async (importOriginal) => ({
  ...await importOriginal<typeof import("three")>(),
  WebGLRenderer: class {
    autoClear = false
    resetState() {}
    render = disegna
    dispose() {}
  },
}))
afterEach(() => { vi.unstubAllGlobals(); disegna.mockClear() })

it("industrie e strutture mantengono la scala geografica quando si allontana la mappa", () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) })
  let zoom = 15.5
  const layer = new ScenarioLayer()
  const map = { getCanvas: () => ({}), getZoom: () => zoom, triggerRepaint() {} }
  layer.onAdd(map as unknown as Map, {} as WebGLRenderingContext)
  layer.imposta([
    { id: "industria", tipo: "industria", lonlat: [11.54, 45.55] },
    { id: "colonnine", tipo: "colonnine", lonlat: [11.55, 45.55] },
  ], null)
  const args = { defaultProjectionData: { mainMatrix: new THREE.Matrix4().toArray() } } as unknown as CustomRenderMethodInput
  const gl = { FRAMEBUFFER_BINDING: 1, FRAMEBUFFER: 2, VIEWPORT: 3,
    getParameter: (p: number) => p === 1 ? null : [0, 0, 800, 600], bindFramebuffer() {}, viewport() {} } as unknown as WebGLRenderingContext
  layer.render(gl, args)
  const scena = disegna.mock.calls[0]![0] as THREE.Scene
  const oggetti = scena.children.find((c) => c.type === "Group")!
  const scale = oggetti.children.map((c) => c.scale.x)
  zoom = 12
  layer.render(gl, args)
  expect(oggetti.children.map((c) => c.scale.x)).toEqual(scale)
  layer.onRemove()
})
