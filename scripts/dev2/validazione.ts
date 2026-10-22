import type { DatiBase, Punto } from './types.js';

function punto(valore: unknown): valore is Punto {
  return Array.isArray(valore) && valore.length === 2 && valore.every(coordinata => typeof coordinata === 'number' && Number.isFinite(coordinata));
}

export function validaBase(base: DatiBase): void {
  if (!base.meta || !['PM10', 'PM10+NO2'].includes(base.meta.inquinante)
    || typeof base.meta.periodoAria !== 'string' || typeof base.meta.generatoIl !== 'string') throw new Error('Meta Dev 1 non validi');
  if (!Array.isArray(base.comuni) || !base.comuni.length) throw new Error('Elenco comuni mancante o vuoto');
  const codici = new Set<string>();
  for (const comune of base.comuni) {
    if (typeof comune.istat !== 'string' || !comune.istat || codici.has(comune.istat)) throw new Error(`Codice ISTAT mancante o duplicato: ${comune.istat}`);
    codici.add(comune.istat);
    if (!Array.isArray(comune.geometria) || !comune.geometria.length || comune.geometria.some(anello =>
      !Array.isArray(anello) || anello.length < 3 || !anello.every(punto)
      || new Set(anello.map(p => p.join(','))).size < 3
      || Math.abs(anello.reduce((somma, punto, i) => {
        const prossimo = anello[(i + 1) % anello.length];
        return somma + punto[0] * prossimo[1] - prossimo[0] * punto[1];
      }, 0)) < 1e-8)) throw new Error(`Geometria non valida: ${comune.istat}`);
    if (!punto(comune.centroide) || typeof comune.nome !== 'string' || !Array.isArray(comune.confinanti)
      || !comune.confinanti.every(codice => typeof codice === 'string')
      || !Number.isFinite(comune.ariaNorm) || comune.ariaNorm < 0 || comune.ariaNorm > 100
      || !Number.isFinite(comune.pm10) || comune.pm10 < 0 || !Number.isInteger(comune.nCentraline) || comune.nCentraline < 0) {
      throw new Error(`Dati comune non validi: ${comune.istat}`);
    }
  }
}
