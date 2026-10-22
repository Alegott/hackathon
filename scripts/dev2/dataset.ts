import type { Casa, DatiBase, Dataset, TipoInfra } from './types.js';
import { selezionaOSM, type RispostaOSM } from './osm.js';
import { puntoNelComune } from './geometria.js';
import { validaBase } from './validazione.js';

const tipi: TipoInfra[] = ['parco', 'ciclabile', 'colonnine', 'industria', 'strada'];

export type Opzioni = { sorgente: 'procedurale' } | { sorgente: 'osm'; osm: RispostaOSM; crs: string };
export type Risultato = { dataset: Dataset; rapporto: {
  caseSeed: string; sorgenteInfrastrutture: 'osm' | 'mista' | 'procedurale';
  comuniProcedurali: string[]; motivoFallback?: string;
} };

export function preparaDataset(base: DatiBase, opzioni: Opzioni): Risultato {
  validaBase(base);
  const caseSeed: Casa[] = base.comuni.flatMap(comune => Array.from({ length: 12 }, (_, i) => ({
    id: `seed:${comune.istat}:${i + 1}`, comune: comune.istat, pubblico: i % 3 !== 0,
    ...(i % 3 !== 0 ? { nickname: `Casa demo ${i + 1}` } : {}),
    dotazioni: {
      fotovoltaico: i % 4 === 0, solareTermico: i % 6 === 0,
      riscaldamento: i % 4 === 0 ? 'pompa_calore' : i % 3 === 0 ? 'tradizionale' : 'condensazione',
      cottura: i % 4 === 0 ? 'induzione' : 'gas',
      isolamento: i % 4 === 0 ? 'buono' : i % 3 === 0 ? 'scarso' : 'medio',
      infissi: i % 3 !== 0, colonninaEV: i % 6 === 0,
    },
  })));
  const dataset: Dataset = {
    ...base, caseSeed,
    infrastrutture: opzioni.sorgente === 'osm' ? selezionaOSM(base.comuni, opzioni.osm, opzioni.crs) : [],
  };
  const comuniConOSM = new Set(dataset.infrastrutture.map(infra => infra.comune));
  const comuniProcedurali = base.comuni.filter(comune => !comuniConOSM.has(comune.istat));
  dataset.infrastrutture.push(...comuniProcedurali.flatMap(comune => tipi.map((tipo, i) => ({
      id: `procedurale:${comune.istat}:${tipo}`, comune: comune.istat, tipo,
      posizione: puntoNelComune(comune, i),
    }))));
  if (Buffer.byteLength(JSON.stringify(dataset), 'utf8') >= 5_000_000) throw new Error('Il dataset deve pesare meno di 5 MB');
  return { dataset, rapporto: {
    caseSeed: 'dati dimostrativi',
    sorgenteInfrastrutture: comuniConOSM.size === 0 ? 'procedurale' : comuniProcedurali.length ? 'mista' : 'osm',
    comuniProcedurali: comuniProcedurali.map(comune => comune.istat),
  } };
}
