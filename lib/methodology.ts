// Configuration is separate from calculations and client records. Changes to
// these decisions require a new methodology version, never an in-place rewrite.
export const METHODOLOGY_VERSION = "AP-PE-2026.09-MDEP-1.1";
export const MAX_FODA_FACTORS_PER_AXIS = 10;
export const MAX_HIGH_LEVEL_LEADERS = 5;
export const MIN_VALIDATION_QUORUM = 3;

export const GATES = {
  foda: "three_leaders_including_director;consultant_if_doubt",
  mdep: "consultant_mandatory;client_final_decision",
} as const;
