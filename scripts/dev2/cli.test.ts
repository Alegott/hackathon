import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { eseguiCLI } from './cli.js';

it('il comando scrive dataset.json e rapporto con etichetta dimostrativa', async () => {
  const cartella = await mkdtemp(join(tmpdir(), 'dev2-cli-'));
  try {
    const input = join(cartella, 'base.json');
    const output = join(cartella, 'public', 'dataset.json');
    await writeFile(input, JSON.stringify({
      meta: { periodoAria: '2025 (mock)', inquinante: 'PM10', generatoIl: '2026-10-22' },
      comuni: [{ istat: 'mock', nome: 'Fittizio', geometria: [[[0, 0], [100, 0], [100, 100], [0, 100]]],
        centroide: [50, 50], confinanti: [], ariaNorm: 60, pm10: 29, nCentraline: 0 }],
    }));
    await eseguiCLI(['--base', input, '--out', output, '--mode', 'procedurale']);
    const dataset = JSON.parse(await readFile(output, 'utf8'));
    const rapporto = JSON.parse(await readFile(`${output}.report.json`, 'utf8'));
    expect(dataset.comuni).toHaveLength(1);
    expect(dataset.infrastrutture).toHaveLength(5);
    expect(dataset.caseSeed).toHaveLength(12);
    expect(rapporto.caseSeed).toBe('dati dimostrativi');
    expect(rapporto.sorgenteInfrastrutture).toBe('procedurale');
  } finally {
    await rm(cartella, { recursive: true, force: true });
  }
});
