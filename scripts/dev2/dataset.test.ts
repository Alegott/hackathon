import { describe, expect, it } from 'vitest';
import { preparaDataset } from './dataset.js';
import type { ElementoOSM } from './osm.js';

const base = {
  meta: { periodoAria: '2025', inquinante: 'PM10' as const, generatoIl: '2026-10-22' },
  comuni: [
    { istat: 'A', nome: 'Comune fittizio A', geometria: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]] as [number, number][][],
      centroide: [50, 50] as [number, number], confinanti: ['B'], ariaNorm: 70, pm10: 25.5, nCentraline: 2 },
    { istat: 'B', nome: 'Comune fittizio B', geometria: [[[100, 0], [200, 0], [200, 100], [100, 100], [100, 0]]] as [number, number][][],
      centroide: [150, 50] as [number, number], confinanti: ['A'], ariaNorm: 40, pm10: 36, nCentraline: 2 },
  ],
};

describe('preparazione dataset Dev 2', () => {
  it('proietta OSM in UTM32 e produce un dataset compatto anche con 114 comuni', () => {
    const comuni = Array.from({ length: 114 }, (_, i) => ({ ...base.comuni[0], istat: `test-${i}`,
      centroide: [500_000 + i * 1000, 0] as [number, number],
      geometria: [[[499_900 + i * 1000, -100], [500_100 + i * 1000, -100], [500_100 + i * 1000, 100], [499_900 + i * 1000, 100]]] as [number, number][][] }));
    const risultato = preparaDataset({ ...base, comuni }, { sorgente: 'osm', crs: 'EPSG:32632', osm: { elements: [
      { type: 'node', id: 99, lon: 9, lat: 0, tags: { amenity: 'charging_station' } },
    ] } });
    expect(risultato.dataset.caseSeed).toHaveLength(1368);
    const osm = risultato.dataset.infrastrutture.find(infra => infra.id === 'osm:node:99')!;
    expect(osm.comune).toBe('test-0');
    expect(osm.posizione[0]).toBeCloseTo(500_000, 3);
    expect(osm.posizione[1]).toBeCloseTo(0, 3);
    expect(Buffer.byteLength(JSON.stringify(risultato.dataset))).toBeLessThan(5_000_000);
    expect(new Set(risultato.dataset.caseSeed.map(casa => casa.id)).size).toBe(1368);
  });
  it('rifiuta geometrie non valide, comuni duplicati e dataset oltre il limite di 5 MB', () => {
    expect(() => preparaDataset({ ...base, comuni: [] }, { sorgente: 'procedurale' })).toThrow(/comuni/i);
    expect(() => preparaDataset({ ...base, comuni: [base.comuni[0], base.comuni[0]] }, { sorgente: 'procedurale' })).toThrow(/duplicato/i);
    expect(() => preparaDataset({ ...base, comuni: [{ ...base.comuni[0], geometria: [] }] }, { sorgente: 'procedurale' })).toThrow(/geometria/i);
    expect(() => preparaDataset({ ...base, comuni: [{ ...base.comuni[0], geometria: [[[0, 0], [1, 1], [2, 2]]] }] }, { sorgente: 'procedurale' })).toThrow(/geometria/i);
    expect(() => preparaDataset({ ...base, comuni: [{ ...base.comuni[0], nome: 'x'.repeat(5_000_000) }] }, { sorgente: 'procedurale' })).toThrow(/5 MB/);
  });
  it('colloca il fallback dentro poligoni concavi anche quando il centroide è esterno', () => {
    const concavo = { ...base, comuni: [{ ...base.comuni[0], centroide: [50, 50] as [number, number],
      geometria: [[[0, 0], [100, 0], [100, 10], [10, 10], [10, 100], [0, 100], [0, 0]]] as [number, number][][] }] };
    const risultato = preparaDataset(concavo, { sorgente: 'procedurale' });
    const posizioni = risultato.dataset.infrastrutture.map(infra => infra.posizione);
    expect(posizioni.every(([x, y]) => x >= 0 && y >= 0 && x <= 100 && y <= 100 && (x <= 10 || y <= 10))).toBe(true);
    expect(new Set(posizioni.map(posizione => posizione.join(','))).size).toBe(5);
  });
  it('seleziona i parchi più grandi e le strade e ciclabili più lunghe, incluse le relazioni OSM', () => {
    const elements = [1, 2, 3, 4].flatMap((id): ElementoOSM[] => {
      const geometry = [
        { lon: 0.0001, lat: 0.0001 }, { lon: 0.0001 + id * 0.0001, lat: 0.0001 },
        { lon: 0.0001 + id * 0.0001, lat: 0.0002 }, { lon: 0.0001, lat: 0.0002 }, { lon: 0.0001, lat: 0.0001 },
      ];
      return [
        { type: 'way', id, tags: { leisure: 'park' }, geometry },
        { type: 'way', id: id + 10, tags: { highway: 'cycleway' }, geometry: geometry.slice(0, 2) },
        { type: 'way', id: id + 20, tags: { highway: 'primary', ref: 'SP 1' }, geometry: geometry.slice(0, 2) },
      ];
    });
    const risultato = preparaDataset(base, { sorgente: 'osm', crs: 'EPSG:3857', osm: { elements: [
      ...elements,
      { type: 'relation', id: 40, tags: { landuse: 'industrial' }, members: [
        { role: 'outer', geometry: elements[0].geometry },
      ] },
      { type: 'way', id: 50, tags: { highway: 'residential' }, geometry: elements[0].geometry },
    ] } });
    for (const [tipo, ids] of [
      ['parco', ['osm:way:4', 'osm:way:3', 'osm:way:2']],
      ['ciclabile', ['osm:way:14', 'osm:way:13', 'osm:way:12']],
      ['strada', ['osm:way:24', 'osm:way:23', 'osm:way:22']],
      ['industria', ['osm:relation:40']],
    ] as const) {
      expect(risultato.dataset.infrastrutture.filter(infra => infra.tipo === tipo && infra.comune === 'A').map(infra => infra.id)).toEqual(ids);
    }
  });
  it('integra con fallback i comuni privi di oggetti OSM e dichiara la provenienza mista', () => {
    const risultato = preparaDataset(base, { sorgente: 'osm', crs: 'EPSG:3857', osm: { elements: [
      { type: 'node', id: 1, lon: 0.0002, lat: 0.0002, tags: { amenity: 'charging_station' } },
    ] } });
    expect(risultato.dataset.infrastrutture.filter(infra => infra.comune === 'A')).toHaveLength(1);
    expect(risultato.dataset.infrastrutture.filter(infra => infra.comune === 'B')).toHaveLength(5);
    expect(risultato.rapporto.sorgenteInfrastrutture).toBe('mista');
    expect(risultato.rapporto.comuniProcedurali).toEqual(['B']);
  });
  it('assegna OSM al poligono corretto e conserva le tre colonnine più capienti, senza duplicati', () => {
    const risultato = preparaDataset(base, {
      sorgente: 'osm', crs: 'EPSG:3857',
      osm: { elements: [
        ...[1, 2, 3, 4].map(id => ({ type: 'node' as const, id, lon: 0.0002, lat: 0.0002,
          tags: { amenity: 'charging_station', capacity: String(id) } })),
        { type: 'node', id: 4, lon: 0.0002, lat: 0.0002, tags: { amenity: 'charging_station', capacity: '4' } },
        { type: 'node', id: 5, lon: 0.0012, lat: 0.0002, tags: { amenity: 'charging_station' } },
        { type: 'node', id: 6, lon: 5, lat: 5, tags: { amenity: 'charging_station' } },
        { type: 'node', id: 7, lon: 0.0002, lat: 0.0002, tags: { amenity: 'cafe' } },
      ] },
    });
    const colonnine = risultato.dataset.infrastrutture.filter(infra => infra.tipo === 'colonnine');
    expect(colonnine.filter(infra => infra.comune === 'A').map(infra => infra.id)).toEqual(['osm:node:4', 'osm:node:3', 'osm:node:2']);
    expect(colonnine.find(infra => infra.comune === 'B')?.id).toBe('osm:node:5');
    expect(colonnine[0].posizione[0]).toBeCloseTo(22.264, 2);
    expect(colonnine[0].posizione[1]).toBeCloseTo(22.264, 2);
    expect(risultato.rapporto.sorgenteInfrastrutture).toBe('osm');
  });
  it('unisce i dati Dev 1 a case dimostrative e infrastrutture procedurali riproducibili', () => {
    const risultato = preparaDataset(base, { sorgente: 'procedurale' });
    expect(risultato.dataset.meta).toEqual(base.meta);
    expect(risultato.dataset.comuni).toEqual(base.comuni);
    expect(risultato).toEqual(preparaDataset(base, { sorgente: 'procedurale' }));
    for (const comune of base.comuni) {
      const caseComune = risultato.dataset.caseSeed.filter(casa => casa.comune === comune.istat);
      expect(caseComune).toHaveLength(12);
      expect(caseComune.some(casa => casa.pubblico && casa.nickname)).toBe(true);
      expect(caseComune.some(casa => !casa.pubblico)).toBe(true);
      expect(new Set(caseComune.map(casa => JSON.stringify(casa.dotazioni))).size).toBeGreaterThan(3);
      const infrastrutture = risultato.dataset.infrastrutture.filter(infra => infra.comune === comune.istat);
      expect(new Set(infrastrutture.map(infra => infra.tipo)).size).toBe(5);
      expect(infrastrutture.every(infra => infra.id.startsWith('procedurale:'))).toBe(true);
    }
    expect(risultato.rapporto.caseSeed).toBe('dati dimostrativi');
    expect(risultato.rapporto.sorgenteInfrastrutture).toBe('procedurale');
    expect(JSON.stringify(base)).not.toContain('caseSeed');
  });
});
