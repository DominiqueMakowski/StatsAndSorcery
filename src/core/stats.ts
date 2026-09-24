// The statistics behind every spell: normal distributions, confidence bands, hit chances.

export interface Normal {
    mean: number
    sd: number
}

/** z such that 95% of a normal lies within mean ± z·sd. */
export const Z95 = 1.959964

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    const erf = 1 - poly * Math.exp(-(z * z) / 2)
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

/** P(lo ≤ X ≤ hi) for X ~ N(mean, sd). */
export function normalIntervalProb(dist: Normal, lo: number, hi: number): number {
    if (dist.sd <= 0) return dist.mean >= lo && dist.mean <= hi ? 1 : 0
    return normalCdf((hi - dist.mean) / dist.sd) - normalCdf((lo - dist.mean) / dist.sd)
}

export function ci95(dist: Normal): [number, number] {
    return [dist.mean - Z95 * dist.sd, dist.mean + Z95 * dist.sd]
}

/** A line whose intercept and slope are independent normals. */
export interface LineDistribution {
    beta0: Normal
    beta1: Normal
}

/**
 * Distribution of the line's height at x: β₀ + β₁·x ~ N(μ₀ + μ₁x, √(σ₀² + σ₁²x²)).
 * Its 95% interval, traced over x, is the confidence band drawn on the battlefield.
 */
export function heightAt(line: LineDistribution, x: number): Normal {
    return {
        mean: line.beta0.mean + line.beta1.mean * x,
        sd: Math.sqrt(line.beta0.sd ** 2 + (line.beta1.sd * x) ** 2),
    }
}
