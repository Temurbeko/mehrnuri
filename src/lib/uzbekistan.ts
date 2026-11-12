import type { Region, UtilityType } from "./domain";

export const DISTRICTS_BY_REGION = {
  tashkent_city: [
    { id: "yunusobod", soato: "1726266" },
    { id: "chilonzor", soato: "1726294" },
    { id: "mirzo_ulugbek", soato: "1726269" },
    { id: "shayxontohur", soato: "1726277" },
    { id: "olmazor", soato: "1726280" },
    { id: "sergeli", soato: "1726283" },
    { id: "yashnobod", soato: "1726290" },
    { id: "uchtepa", soato: "1726262" },
    { id: "mirobod", soato: "1726273" },
    { id: "yakkasaroy", soato: "1726287" },
    { id: "bektemir", soato: "1726264" },
    { id: "yangihayot", soato: "1726292" },
  ],
  tashkent: [
    { id: "nurafshon", soato: "1727401" },
    { id: "chirchiq", soato: "1727419" },
    { id: "olmaliq", soato: "1727404" },
    { id: "angren", soato: "1727407" },
    { id: "zangiota", soato: "1727220" },
    { id: "qibray", soato: "1727224" },
    { id: "toshkent_tuman", soato: "1727248" },
    { id: "yangiyol", soato: "1727259" },
  ],
  samarkand: [
    { id: "samarkand_sh", soato: "1718401" },
    { id: "kattaqorgon", soato: "1718406" },
    { id: "urgut", soato: "1718236" },
    { id: "pastdargom", soato: "1718224" },
    { id: "payariq", soato: "1718226" },
  ],
  fergana: [
    { id: "fergana_sh", soato: "1730401" },
    { id: "qoqon", soato: "1730405" },
    { id: "margilon", soato: "1730408" },
    { id: "oltiariq", soato: "1730203" },
    { id: "quva", soato: "1730218" },
  ],
  andijan: [
    { id: "andijan_sh", soato: "1703401" },
    { id: "asaka", soato: "1703203" },
    { id: "shahrixon", soato: "1703230" },
    { id: "xonobod", soato: "1703408" },
  ],
  namangan: [
    { id: "namangan_sh", soato: "1714401" },
    { id: "chust", soato: "1714236" },
    { id: "kosonsoy", soato: "1714207" },
    { id: "pop", soato: "1714219" },
  ],
  bukhara: [
    { id: "bukhara_sh", soato: "1706401" },
    { id: "kogon", soato: "1706403" },
    { id: "gijduvon", soato: "1706219" },
    { id: "qorakol", soato: "1706230" },
  ],
  kashkadarya: [
    { id: "qarshi", soato: "1710401" },
    { id: "shahrisabz", soato: "1710405" },
    { id: "koson", soato: "1710229" },
    { id: "guzor", soato: "1710207" },
  ],
  surkhandarya: [
    { id: "termiz", soato: "1722401" },
    { id: "denov", soato: "1722210" },
    { id: "boysun", soato: "1722204" },
    { id: "sherobod", soato: "1722223" },
  ],
  khorezm: [
    { id: "urganch", soato: "1733401" },
    { id: "xiva", soato: "1733403" },
    { id: "hazorasp", soato: "1733220" },
    { id: "xonqa", soato: "1733223" },
  ],
  navoi: [
    { id: "navoi_sh", soato: "1712401" },
    { id: "zarafshon", soato: "1712408" },
    { id: "karmana", soato: "1712234" },
    { id: "qiziltepa", soato: "1712216" },
  ],
  jizzakh: [
    { id: "jizzakh_sh", soato: "1708401" },
    { id: "sharof_rashidov", soato: "1708212" },
    { id: "zomin", soato: "1708218" },
    { id: "gallaorol", soato: "1708209" },
  ],
  syrdarya: [
    { id: "guliston", soato: "1724401" },
    { id: "yangiyer", soato: "1724410" },
    { id: "sirdaryo_t", soato: "1724231" },
    { id: "boyovut", soato: "1724206" },
  ],
  karakalpakstan: [
    { id: "nukus", soato: "1735401" },
    { id: "beruniy", soato: "1735204" },
    { id: "tortkol", soato: "1735233" },
    { id: "qongirot", soato: "1735215" },
    { id: "moynoq", soato: "1735222" },
  ],
} as const satisfies Record<Region, readonly { id: string; soato: string }[]>;

export type DistrictId = (typeof DISTRICTS_BY_REGION)[Region][number]["id"];

export interface DistrictInfo {
  id: DistrictId;
  soato: string;
}

export function findDistrict(region: Region, districtId: string | null | undefined): DistrictInfo {
  const list = DISTRICTS_BY_REGION[region];
  return list.find((d) => d.id === districtId) ?? list[0]!;
}

/**
 * Official Uzbekistan utility enterprises.
 */
export function officialSupplierName(utility: UtilityType, region: Region): string {
  switch (utility) {
    case "electricity":
      return "«Hududiy elektr tarmoqlari» AJ (HET)";
    case "gas":
      return "«Hududgazta'minot» AJ";
    case "water":
      return region === "tashkent_city" ? "«Toshkent shahar suv ta'minoti» MChJ" : "«O'zsuvta'minot» AJ";
    case "heating":
    case "hot_water":
      return region === "tashkent_city" ? "«Veolia Energy Tashkent» MChJ XK" : "«Issiqlik manbai» DUK";
    case "waste":
      return region === "tashkent_city" ? "«Maxsustrans» DUK" : "«Toza Hudud» DUK";
  }
}

export function meterUnitFor(utility: UtilityType): "kWh" | "m³" | null {
  switch (utility) {
    case "electricity":
      return "kWh";
    case "gas":
    case "water":
    case "hot_water":
      return "m³";
    default:
      return null;
  }
}

/**
 * Utility tax ids (TIN) confirmed from real Soliq receipts (paymentDetails[].comitentTin).
 * Pure data; more are learned automatically (src/lib/payments/recipient.ts).
 */
export const KNOWN_SUPPLIER_TINS: Record<string, UtilityType[]> = {
  // "Issiqquvvat Veolia" (Tashkent heating), receipt of 2026-11-12
  "306866603": ["heating", "hot_water"],
};
