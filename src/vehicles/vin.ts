/**
 * VIN format: since 1981 exactly 17 characters; I, O and Q are excluded so they
 * cannot be confused with 1 and 0. Mirrors `mobile/lib/vin.ts`.
 */
export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
