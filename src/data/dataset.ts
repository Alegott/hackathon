import type { Dataset } from "../types"
import mock from "./dataset.mock.json"

// Il dataset reale viene dallo script di preparazione: src/data/dataset.json oppure il
// dataset.json nella radice del repo. Se non c'è si usa il mock.
const reali = import.meta.glob<{ default: Partial<Dataset> }>(["./dataset.json", "../../dataset.json"], { eager: true })
const reale = Object.values(reali)[0]?.default

// Finché Dev 2 non consegna infrastrutture e case seed, il dataset di Dev 1 ne è privo: si
// completa con liste vuote così l'app funziona comunque con i comuni reali.
export const dataset: Dataset = reale
  ? { ...(reale as Dataset), infrastrutture: reale.infrastrutture ?? [], caseSeed: reale.caseSeed ?? [] }
  : (mock as Dataset)
export const èMock = !reale
