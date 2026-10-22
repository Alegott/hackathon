import { expect, it, vi } from 'vitest';
import { generaDataset } from './pipeline.js';
import type { DatiBase } from './types.js';

const base: DatiBase = {
  meta: { periodoAria: '2025', inquinante: 'PM10', generatoIl: '2026-10-22' },
  comuni: [{ istat: 'demo', nome: 'Fittizio', centroide: [0, 0], geometria: [[[-100, -100], [100, -100], [100, 100], [-100, 100]]],
    confinanti: [], ariaNorm: 60, pm10: 29, nCentraline: 2 }],
};

it('estrae OSM e restituisce il dataset finale senza modificare meta e comuni', async () => {
  const fetchOSM = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ elements: [
    { type: 'node', id: 9, lat: 0, lon: 0, tags: { amenity: 'charging_station' } },
  ] })));
  const risultato = await generaDataset(base, { modalita: 'auto', crs: 'EPSG:3857', fetch: fetchOSM });
  expect(risultato.dataset.infrastrutture).toHaveLength(1);
  expect(risultato.dataset.infrastrutture[0]).toMatchObject({ id: 'osm:node:9', comune: 'demo', tipo: 'colonnine' });
  expect(risultato.dataset.infrastrutture[0].posizione[0]).toBeCloseTo(0, 5);
  expect(risultato.dataset.infrastrutture[0].posizione[1]).toBeCloseTo(0, 5);
  expect(risultato.dataset.comuni).toEqual(base.comuni);
  expect(risultato.dataset.caseSeed).toHaveLength(12);
  const [url, init] = fetchOSM.mock.calls[0];
  expect(url).toBe('https://overpass-api.de/api/interpreter');
  const query = new URLSearchParams(String(init?.body)).get('data');
  for (const filtro of ['leisure', 'industrial', 'cycleway', 'charging_station', 'highway']) expect(query).toContain(filtro);
  expect(query).toContain('out geom');
});

it.each([
  ['errore di rete', () => Promise.reject(new Error('Rete assente'))],
  ['HTTP 504', () => Promise.resolve(new Response('Gateway timeout', { status: 504 }))],
  ['risposta parziale', () => Promise.resolve(new Response(JSON.stringify({ elements: [], remark: 'runtime error: timeout' })))],
  ['JSON non valido', () => Promise.resolve(new Response('non JSON'))],
  ['schema non valido', () => Promise.resolve(new Response(JSON.stringify({ elements: null })))],
] as const)('usa il fallback dichiarato per %s', async (_, risposta) => {
  const risultato = await generaDataset(base, { modalita: 'auto', crs: 'EPSG:3857', fetch: vi.fn().mockImplementation(risposta) });
  expect(risultato.dataset.infrastrutture).toHaveLength(5);
  expect(risultato.rapporto.sorgenteInfrastrutture).toBe('procedurale');
  expect(risultato.rapporto.motivoFallback).toBeTruthy();
});

it('interrompe la richiesta dopo 45 secondi e passa al fallback senza aspettare 30 minuti', async () => {
  vi.useFakeTimers();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('Tempo scaduto')), ms);
    return controller.signal;
  });
  try {
    const richiesta = vi.fn<typeof fetch>().mockImplementation((_, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const promessa = generaDataset(base, { modalita: 'auto', crs: 'EPSG:3857', fetch: richiesta });
    await vi.advanceTimersByTimeAsync(45_000);
    const risultato = await promessa;
    expect(timeout).toHaveBeenCalledWith(45_000);
    expect(risultato.rapporto.sorgenteInfrastrutture).toBe('procedurale');
    expect(risultato.rapporto.motivoFallback).toBe('Tempo scaduto');
  } finally {
    timeout.mockRestore();
    vi.useRealTimers();
  }
});

it('richiede una proiezione esplicita in metri e non scarica OSM in modalità procedurale', async () => {
  const rete = vi.fn<typeof fetch>();
  await expect(generaDataset(base, { modalita: 'auto', fetch: rete })).rejects.toThrow(/crs/);
  await expect(generaDataset(base, { modalita: 'auto', crs: 'EPSG:4326', fetch: rete })).rejects.toThrow(/metri/);
  await generaDataset(base, { modalita: 'procedurale', fetch: rete });
  expect(rete).not.toHaveBeenCalled();
});
