// Contratto A di TASKS.md, locale allo script finché non arriva lo scaffold Dev 4.
export type Punto = [number, number];
export type TipoInfra = 'parco' | 'ciclabile' | 'colonnine' | 'industria' | 'strada';
export type Comune = {
  istat: string; nome: string; geometria: Punto[][]; centroide: Punto;
  confinanti: string[]; ariaNorm: number; pm10: number; nCentraline: number;
};
export type Dotazioni = {
  fotovoltaico: boolean; solareTermico: boolean;
  riscaldamento: 'pompa_calore' | 'condensazione' | 'tradizionale';
  cottura: 'induzione' | 'gas'; isolamento: 'buono' | 'medio' | 'scarso';
  infissi: boolean; colonninaEV: boolean;
};
export type Casa = { id: string; comune: string; pubblico: boolean; nickname?: string; dotazioni: Dotazioni };
export type Infrastruttura = { id: string; comune: string; tipo: TipoInfra; posizione: Punto };
export type DatiBase = {
  meta: { periodoAria: string; inquinante: 'PM10' | 'PM10+NO2'; generatoIl: string };
  comuni: Comune[];
};
export type Dataset = DatiBase & { infrastrutture: Infrastruttura[]; caseSeed: Casa[] };
