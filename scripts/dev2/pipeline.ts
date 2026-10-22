import { proj4, validaCRS } from './proiezione.js';
import { preparaDataset } from './dataset.js';
import type { RispostaOSM } from './osm.js';
import type { DatiBase } from './types.js';
import { validaBase } from './validazione.js';

export type OpzioniPipeline = {
  modalita: 'auto' | 'procedurale'; crs?: string; fetch?: typeof fetch;
};

export async function generaDataset(base: DatiBase, opzioni: OpzioniPipeline) {
  validaBase(base);
  if (opzioni.modalita === 'procedurale') return preparaDataset(base, { sorgente: 'procedurale' });
  if (!opzioni.crs) throw new Error('Specificare --crs: deve coincidere con la proiezione in metri di Dev 1');
  validaCRS(opzioni.crs);
  const punti = base.comuni.flatMap(comune => comune.geometria.flat()).map(punto => proj4(opzioni.crs!, 'EPSG:4326', punto));
  const longitudini = punti.map(p => p[0]), latitudini = punti.map(p => p[1]);
  const bbox = [Math.min(...latitudini), Math.min(...longitudini), Math.max(...latitudini), Math.max(...longitudini)].join(',');
  const query = `[out:json][timeout:40];(
    nwr[leisure=park](${bbox});
    nwr[landuse=industrial](${bbox});
    way[highway~"^(trunk|primary|secondary|trunk_link|primary_link|secondary_link)$"](${bbox});
    way[highway][ref~"^S[SP] ?[0-9]"](${bbox});
    way[highway=cycleway](${bbox});
    nwr[amenity=charging_station](${bbox});
  );out geom;`;
  let osm: RispostaOSM;
  try {
    const risposta = await (opzioni.fetch ?? fetch)('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: new URLSearchParams({ data: query }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'vicenza-sostenibile-hackathon/1.0' }, signal: AbortSignal.timeout(45_000),
    });
    if (!risposta.ok) throw new Error(`Overpass HTTP ${risposta.status}`);
    osm = await risposta.json();
    if (!osm || !Array.isArray(osm.elements) || osm.elements.some(elemento => !elemento || !Number.isFinite(elemento.id))) throw new Error('Risposta OSM non valida');
    if (osm.remark) throw new Error(`Risposta Overpass parziale: ${osm.remark}`);
  } catch (errore) {
    const risultato = preparaDataset(base, { sorgente: 'procedurale' });
    risultato.rapporto.motivoFallback = errore instanceof Error ? errore.message : String(errore);
    return risultato;
  }
  return preparaDataset(base, { sorgente: 'osm', osm, crs: opzioni.crs });
}
