import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { generaDataset } from './pipeline.js';
import type { DatiBase } from './types.js';

export async function eseguiCLI(args: string[]) {
  const { values } = parseArgs({ args, options: {
    base: { type: 'string' }, out: { type: 'string' }, mode: { type: 'string', default: 'auto' }, crs: { type: 'string' },
  } });
  if (!values.base || !values.out || !['auto', 'procedurale'].includes(values.mode!)) {
    throw new Error('Uso: --base dati-dev1.json --out dataset.json --mode auto|procedurale [--crs EPSG:32632]');
  }
  if (resolve(values.base) === resolve(values.out)) throw new Error('Input e output devono essere file diversi');
  const base: DatiBase = JSON.parse(await readFile(values.base, 'utf8'));
  const risultato = await generaDataset(base, { modalita: values.mode as 'auto' | 'procedurale', crs: values.crs });
  await mkdir(dirname(resolve(values.out)), { recursive: true });
  await writeFile(values.out, JSON.stringify(risultato.dataset), 'utf8');
  await writeFile(`${values.out}.report.json`, JSON.stringify(risultato.rapporto, null, 2) + '\n', 'utf8');
  return risultato.rapporto;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  eseguiCLI(process.argv.slice(2)).then(rapporto => console.log(JSON.stringify(rapporto, null, 2)))
    .catch(errore => { console.error(errore instanceof Error ? errore.message : errore); process.exitCode = 1; });
}
