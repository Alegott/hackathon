import type { Comune, Punto } from './types.js';

export function puntoNelComune(comune: Comune, indice: number): Punto {
  const anello = comune.geometria[indice % comune.geometria.length];
  const xs = anello.map(p => p[0]);
  const ys = anello.map(p => p[1]);
  const minimoX = Math.min(...xs), minimoY = Math.min(...ys);
  const larghezza = Math.max(...xs) - minimoX, altezza = Math.max(...ys) - minimoY;
  let stato = [...`${comune.istat}:${indice}`].reduce((hash, carattere) => Math.imul(hash, 31) + carattere.charCodeAt(0) | 0, 17);
  const casuale = () => { stato = (Math.imul(stato, 1664525) + 1013904223) | 0; return (stato >>> 0) / 4294967296; };
  for (let tentativo = 0; tentativo < 10000; tentativo++) {
    const punto: Punto = [minimoX + casuale() * larghezza, minimoY + casuale() * altezza];
    if (contiene(anello, punto)) return punto;
  }
  // Per poligoni estremamente sottili, un punto sul bordo appartiene comunque al comune.
  const quota = (indice + 1) / (indice + 2);
  return [anello[0][0] * quota + anello[1][0] * (1 - quota), anello[0][1] * quota + anello[1][1] * (1 - quota)];
}

export function contiene(anello: Punto[], [x, y]: Punto): boolean {
  let dentro = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [ax, ay] = anello[j];
    const [bx, by] = anello[i];
    const prodotto = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(prodotto) < 1e-7 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)
      && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) dentro = !dentro;
  }
  return dentro;
}
