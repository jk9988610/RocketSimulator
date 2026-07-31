import {
  angularRateRadPerS,
  AU_KM,
  CELESTIAL,
  MOON_ORBIT_KM,
  SIM_PERIODS_S,
} from './cosmos-scale'

export interface Vec2 {
  x: number
  y: number
}

/** 日心坐标（km）：太阳在原点 */
export interface HeliocentricState {
  simTimeS: number
  earth: Vec2
  earthOrbitAngle: number
  earthRotation: number
  moon: Vec2
  moonOrbitAngle: number
  moonRotation: number
  sunRotation: number
}

/** 地心坐标（m）：用于飞行物理 */
export interface GeocentricState {
  moonPositionM: Vec2
  moonOrbitAngle: number
  earthRotation: number
}

export function computeHeliocentricState(simTimeS: number): HeliocentricState {
  const earthOrbitAngle = simTimeS * angularRateRadPerS(SIM_PERIODS_S.earthRevolution)
  const earthX = Math.cos(earthOrbitAngle) * AU_KM
  const earthY = Math.sin(earthOrbitAngle) * AU_KM

  const moonOrbitAngle = simTimeS * angularRateRadPerS(SIM_PERIODS_S.moonOrbit)
  const moonLocalX = Math.cos(moonOrbitAngle) * MOON_ORBIT_KM
  const moonLocalY = Math.sin(moonOrbitAngle) * MOON_ORBIT_KM

  return {
    simTimeS,
    earth: { x: earthX, y: earthY },
    earthOrbitAngle,
    earthRotation: simTimeS * angularRateRadPerS(CELESTIAL.earth.rotationPeriodS),
    moon: { x: earthX + moonLocalX, y: earthY + moonLocalY },
    moonOrbitAngle,
    moonRotation: simTimeS * angularRateRadPerS(CELESTIAL.moon.rotationPeriodS),
    sunRotation: simTimeS * angularRateRadPerS(CELESTIAL.sun.rotationPeriodS),
  }
}

export function computeGeocentricState(simTimeS: number): GeocentricState {
  const moonOrbitAngle = simTimeS * angularRateRadPerS(SIM_PERIODS_S.moonOrbit)
  const moonOrbitM = MOON_ORBIT_KM * 1000
  return {
    moonPositionM: {
      x: Math.cos(moonOrbitAngle) * moonOrbitM,
      y: Math.sin(moonOrbitAngle) * moonOrbitM,
    },
    moonOrbitAngle,
    earthRotation: simTimeS * angularRateRadPerS(CELESTIAL.earth.rotationPeriodS),
  }
}
