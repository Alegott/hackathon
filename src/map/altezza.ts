export const ALTEZZA_MIN = 0.15
export const ALTEZZA_MAX = 0.9

// Altezza dell'estrusione di un comune in scena, proporzionale al suo indice.
export const altezzaComune = (totale: number) => ALTEZZA_MIN + (totale / 100) * (ALTEZZA_MAX - ALTEZZA_MIN)
