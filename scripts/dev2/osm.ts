import { proj4, validaCRS } from './proiezione.js';
import { contiene } from './geometria.js';
import type { Comune, Infrastruttura, Punto, TipoInfra } from './types.js';

type CoordinataOSM = { lat: number; lon: number };

export type ElementoOSM = {
  type: string; id: number; lat?: number; lon?: number;
  tags?: Record<string, string>;
  center?: CoordinataOSM;
  geometry?: CoordinataOSM[];
  members?: { role?: string; geometry?: CoordinataOSM[] }[];
};
export type RispostaOSM = { elements: ElementoOSM[]; remark?: string };

function tipoElemento(tags: Record<string, string>): TipoInfra | null {
  if (tags.leisure === 'park') return 'parco';
  if (tags.landuse === 'industrial') return 'industria';
  if (tags.highway === 'cycleway') return 'ciclabile';
  if (tags.amenity === 'charging_station') return 'colonnine';
  if (['trunk', 'primary', 'secondary', 'trunk_link', 'primary_link', 'secondary_link'].includes(tags.highway)
    || (tags.highway && /^S[SP]\s?\d/i.test(tags.ref ?? ''))) return 'strada';
  return null;
}

function area(punti: Punto[]): number {
  return Math.abs(punti.reduce((somma, [x, y], i) => {
    const successivo = punti[(i + 1) % punti.length];
    return somma + x * successivo[1] - successivo[0] * y;
  }, 0)) / 2;
}

export function selezionaOSM(comuni: Comune[], osm: RispostaOSM, crs: string): Infrastruttura[] {
  validaCRS(crs);
  const candidati: (Infrastruttura & { importanza: number })[] = [];
  const visti = new Set<string>();
  for (const elemento of osm.elements) {
    const id = `osm:${elemento.type}:${elemento.id}`;
    if (visti.has(id)) continue;
    visti.add(id);
    const tipo = tipoElemento(elemento.tags ?? {});
    if (!tipo) continue;
    const proietta = ({ lon, lat }: CoordinataOSM) => proj4('EPSG:4326', crs, [lon, lat]) as Punto;
    const percorsi = elemento.geometry ? [elemento.geometry.map(proietta)] :
      (elemento.members ?? []).filter(membro => membro.role !== 'inner').map(membro => (membro.geometry ?? []).map(proietta));
    const punti = percorsi.flat();
    const coordinate = elemento.lon !== undefined && elemento.lat !== undefined ? { lon: elemento.lon, lat: elemento.lat } : elemento.center;
    const posizione = coordinate ? proietta(coordinate) : punti.length ? [
      (Math.min(...punti.map(p => p[0])) + Math.max(...punti.map(p => p[0]))) / 2,
      (Math.min(...punti.map(p => p[1])) + Math.max(...punti.map(p => p[1]))) / 2,
    ] as Punto : null;
    if (!posizione) continue;
    const comune = comuni.find(comune => comune.geometria.some(anello => contiene(anello, posizione)));
    if (!comune) continue;
    const importanza = tipo === 'colonnine' ? Number(elemento.tags?.capacity) || 1 :
      tipo === 'parco' || tipo === 'industria' ? percorsi.reduce((somma, percorso) => somma + area(percorso), 0) :
        percorsi.reduce((somma, percorso) => somma + percorso.slice(1).reduce((lunghezza, punto, i) =>
          lunghezza + Math.hypot(punto[0] - percorso[i][0], punto[1] - percorso[i][1]), 0), 0);
    candidati.push({ id, comune: comune.istat, tipo, posizione, importanza });
  }
  const conteggi = new Map<string, number>();
  return candidati.sort((a, b) => b.importanza - a.importanza || a.id.localeCompare(b.id))
    .filter(infra => {
      const chiave = `${infra.comune}:${infra.tipo}`;
      const numero = conteggi.get(chiave) ?? 0;
      conteggi.set(chiave, numero + 1);
      return numero < 3;
    }).map(({ importanza: _, ...infra }) => infra);
}
