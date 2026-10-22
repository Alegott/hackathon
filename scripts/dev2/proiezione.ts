import proj4 from 'proj4';

proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

export function validaCRS(crs: string) {
  if (proj4.defs(crs)?.units !== 'm') throw new Error(`CRS ${crs} non supportato in metri: usare EPSG:32632, EPSG:25832 o EPSG:3857, coerente con Dev 1`);
}

export { proj4 };
