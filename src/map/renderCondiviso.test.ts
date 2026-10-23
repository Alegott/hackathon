import { expect, it } from "vitest"
import { renderCondiviso } from "./renderCondiviso"

it("mantiene il framebuffer intermedio durante il disegno e dopo il reset di Three", () => {
  const target = { nome: "transizione-mappa" }
  let corrente: object | null = target
  const gl = {
    FRAMEBUFFER_BINDING: 1, FRAMEBUFFER: 2, VIEWPORT: 3,
    getParameter: (p: number) => p === 1 ? corrente : [0, 0, 1400, 900],
    bindFramebuffer: (_p: number, f: object | null) => { corrente = f }, viewport() {},
  }
  const renderer = { resetState() { corrente = null } }
  renderCondiviso(gl as unknown as WebGLRenderingContext, renderer, () => expect(corrente).toBe(target))
  expect(corrente).toBe(target)
})
