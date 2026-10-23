import { expect, it } from "vitest"
import { Traffico } from "./Traffico"

it("le auto proseguono agli incroci con al massimo otto modelli", () => {
  const traffico = new Traffico()
  traffico.setPercorsi([[[0, 0], [20, 0], [20, 100]]])
  for (let i = 0; i < 60; i++) traffico.frame(.1, true, [0, 0], .2, () => true)
  const auto = traffico.gruppo.children[0]!
  expect(auto.visible).toBe(true)
  expect(auto.position.x).toBeCloseTo(20)
  expect(auto.position.y).toBeGreaterThan(10)
  expect(traffico.gruppo.children).toHaveLength(8)
  traffico.frame(.1, false, [0, 0], .2, () => true)
  expect(traffico.gruppo.visible).toBe(false)
  traffico.libera()
})

it("nasconde i passaggi occupati e riparte nel nuovo comune", () => {
  const traffico = new Traffico()
  traffico.setComune("A")
  traffico.setPercorsi([[[0, 0], [100, 0]]])
  traffico.frame(.1, true, [0, 0], .2, () => false)
  expect(traffico.gruppo.children.every((auto) => !auto.visible)).toBe(true)
  traffico.setComune("B")
  traffico.setPercorsi([[[5000, 0], [5100, 0]]])
  traffico.frame(.1, true, [5000, 0], .2, () => true)
  expect(traffico.gruppo.children[0]!.position.x).toBeGreaterThan(5000)
  traffico.libera()
})

it("usa anche segmenti corti delle strade urbane", () => {
  const traffico = new Traffico()
  traffico.setPercorsi([[[0, 0], [4, 0], [8, 0], [12, 0]]])
  traffico.frame(0, true, [0, 0], 2, () => true)
  expect(traffico.gruppo.children.some((a) => a.visible)).toBe(true)
  traffico.libera()
})

it("riporta il traffico nella vista dopo uno spostamento della mappa", () => {
  const traffico = new Traffico()
  traffico.setPercorsi([[[0, 0], [100, 0]]])
  traffico.frame(0, true, [0, 0], 2, () => true)
  traffico.setPercorsi([[[5000, 0], [5100, 0]]])
  traffico.frame(0, true, [5000, 0], 2, () => true)
  const visibili = traffico.gruppo.children.filter((a) => a.visible)
  expect(visibili.length).toBeGreaterThan(0)
  expect(visibili.every((a) => a.position.x >= 5000)).toBe(true)
  traffico.libera()
})
