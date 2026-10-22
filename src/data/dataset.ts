import type { Dataset } from "../types"
import mock from "./dataset.mock.json"

// Usa src/data/dataset.json (prodotto da Dev 1 + Dev 2) quando esiste, altrimenti il mock.
const reali = import.meta.glob<{ default: Dataset }>("./dataset.json", { eager: true })

export const dataset: Dataset = reali["./dataset.json"]?.default ?? (mock as Dataset)
export const èMock = !reali["./dataset.json"]
