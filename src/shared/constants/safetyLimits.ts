/**
 * Safety limits for ECU tuning validation
 * These values represent generally accepted safe operating ranges
 * WARNING: Actual safe limits vary by engine - use professional judgment
 */

export const SafetyLimits = {
  // Air-Fuel Ratio limits
  AFR: {
    MIN: 10.0,        // Extremely rich - flooding risk
    LEAN_WARNING: 11.5, // Lean under boost - detonation risk
    STOICH: 14.7,     // Stoichiometric
    MAX: 18.0,        // Very lean - misfire/damage risk
    WOT_TARGET_MIN: 11.0, // Wide open throttle minimum
    WOT_TARGET_MAX: 12.5, // Wide open throttle maximum
  },

  // Lambda (wideband) limits
  LAMBDA: {
    MIN: 0.68,        // Extremely rich
    LEAN_WARNING: 0.78, // Lean under load warning
    STOICH: 1.0,      // Stoichiometric
    MAX: 1.22,        // Very lean
  },

  // Ignition timing limits (degrees BTDC)
  TIMING: {
    MIN: -10,         // Maximum retard
    MAX: 45,          // Aggressive advance - detonation risk
    BOOST_MAX: 25,    // Max timing under boost
    NA_MAX: 40,       // Max timing naturally aspirated
    IDLE_MIN: 5,      // Minimum idle timing
    IDLE_MAX: 20,     // Maximum idle timing
  },

  // Boost pressure limits (PSI)
  BOOST: {
    WARNING: 15,      // High boost warning
    MAX: 30,          // Extreme boost - danger
    SPIKE_DELTA: 5,   // Max acceptable overshoot
  },

  // RPM limits
  RPM: {
    IDLE_MIN: 600,
    IDLE_MAX: 1200,
    REV_LIMIT_WARNING: 7500,
    MAX: 10000,       // Absolute maximum
  },

  // Fuel pressure (bar)
  FUEL_PRESSURE: {
    MIN: 2.5,
    MAX: 6.0,
    BASE_RAIL: 3.0,
  },

  // Injector duty cycle (%)
  INJECTOR_DUTY: {
    WARNING: 80,      // High duty cycle warning
    MAX: 95,          // Near static - needs bigger injectors
  },

  // Coolant temperature (Celsius)
  COOLANT_TEMP: {
    COLD: 20,
    NORMAL_MIN: 80,
    NORMAL_MAX: 100,
    WARNING: 110,
    CRITICAL: 120,
  },

  // VE (Volumetric Efficiency) %
  VE: {
    MIN: 20,
    NA_MAX: 110,      // Naturally aspirated max
    BOOSTED_MAX: 250, // Turbocharged max reasonable
  },
} as const;

/**
 * Risk levels for value validation
 */
export enum RiskLevel {
  SAFE = 'safe',
  CAUTION = 'caution',
  WARNING = 'warning',
  DANGER = 'danger',
}

/**
 * Map categories that require extra validation
 */
export const CriticalMapCategories = [
  'Fuel',
  'Ignition',
  'Timing',
  'Boost',
  'AFR',
  'Lambda',
  'Rev Limit',
  'Speed Limit',
  'Torque Limit',
] as const;

/**
 * Get risk level for AFR value
 */
export function getAfrRiskLevel(afr: number, isUnderLoad: boolean = false): RiskLevel {
  if (afr < SafetyLimits.AFR.MIN || afr > SafetyLimits.AFR.MAX) {
    return RiskLevel.DANGER;
  }
  if (isUnderLoad && afr > SafetyLimits.AFR.LEAN_WARNING) {
    return RiskLevel.DANGER;
  }
  if (afr < SafetyLimits.AFR.WOT_TARGET_MIN || afr > SafetyLimits.AFR.WOT_TARGET_MAX) {
    return RiskLevel.WARNING;
  }
  if (afr < 11.5 || afr > 13.5) {
    return RiskLevel.CAUTION;
  }
  return RiskLevel.SAFE;
}

/**
 * Get risk level for timing value
 */
export function getTimingRiskLevel(timing: number, boostPsi: number = 0): RiskLevel {
  if (timing < SafetyLimits.TIMING.MIN || timing > SafetyLimits.TIMING.MAX) {
    return RiskLevel.DANGER;
  }
  if (boostPsi > 0 && timing > SafetyLimits.TIMING.BOOST_MAX) {
    return RiskLevel.DANGER;
  }
  if (timing > SafetyLimits.TIMING.NA_MAX) {
    return RiskLevel.WARNING;
  }
  if (timing > 35) {
    return RiskLevel.CAUTION;
  }
  return RiskLevel.SAFE;
}

/**
 * Get risk level for boost value
 */
export function getBoostRiskLevel(boostPsi: number): RiskLevel {
  if (boostPsi > SafetyLimits.BOOST.MAX) {
    return RiskLevel.DANGER;
  }
  if (boostPsi > SafetyLimits.BOOST.WARNING) {
    return RiskLevel.WARNING;
  }
  if (boostPsi > 10) {
    return RiskLevel.CAUTION;
  }
  return RiskLevel.SAFE;
}

/**
 * Color mapping for risk levels
 */
export const RiskColors = {
  [RiskLevel.SAFE]: '#22c55e',     // Green
  [RiskLevel.CAUTION]: '#eab308',  // Yellow
  [RiskLevel.WARNING]: '#f97316',  // Orange
  [RiskLevel.DANGER]: '#ef4444',   // Red
} as const;
