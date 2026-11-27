/**
 * Option lists for the location forms: ISO 3166-1 alpha-2 country codes and
 * the IANA time zones the runtime knows about. Both render as native selects,
 * so they expose plain {value, label} pairs — computed once, sorted for the
 * current locale.
 */

export interface SelectOption {
  value: string;
  label: string;
}

/** ISO 3166-1 alpha-2 country codes. */
const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT",
  "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
  "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY",
  "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
  "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK",
  "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL",
  "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR",
  "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
  "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS",
  "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW",
  "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP",
  "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
  "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM",
  "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF",
  "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW",
  "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

let regionNames: Intl.DisplayNames | null = null;

/** "Australia (AU)" — the localized country name plus its alpha-2 code. */
function countryLabel(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(undefined, { type: "region" });
    return `${regionNames.of(code) ?? code} (${code})`;
  } catch {
    return code;
  }
}

let cachedCountries: SelectOption[] | null = null;

/** Every ISO 3166-1 alpha-2 country, labelled "Name (CODE)", locale-sorted. */
export function countryOptions(): SelectOption[] {
  cachedCountries ??= COUNTRY_CODES.map((code) => ({
    value: code,
    label: countryLabel(code),
  })).sort((a, b) => a.label.localeCompare(b.label));
  return cachedCountries;
}

/** Fallback for runtimes without Intl.supportedValuesOf (pre-2022 browsers). */
const FALLBACK_TIME_ZONES = [
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
];

let cachedTimeZones: SelectOption[] | null = null;

/** Every IANA time zone the runtime supports, locale-sorted. */
export function timeZoneOptions(): SelectOption[] {
  cachedTimeZones ??= (typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : FALLBACK_TIME_ZONES
  )
    .map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return cachedTimeZones;
}