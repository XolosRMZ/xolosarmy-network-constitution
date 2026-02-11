'use strict';

const DEFAULT_OUTCOME_FACTOR = {
  PASS: 0,
  WARN: -0.5,
  FAIL: -1
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {Record<string, any>} precedenceBands
 * @returns {Array<{name: string, min: number, risk_class?: string}>}
 */
function sortedBands(precedenceBands) {
  return Object.entries(precedenceBands || {})
    .map(([name, cfg]) => ({
      name,
      min: Number(cfg?.min) || 0,
      risk_class: cfg?.risk_class
    }))
    .sort((a, b) => a.min - b.min);
}

/**
 * @param {number} precedence
 * @param {Record<string, any>} precedenceBands
 * @returns {string}
 */
function inferPrecedenceBand(precedence, precedenceBands) {
  const bands = sortedBands(precedenceBands);
  if (bands.length === 0) return 'operational';

  let chosen = bands[0];
  for (const band of bands) {
    if (precedence >= band.min) chosen = band;
  }
  return chosen.name;
}

/**
 * @param {Record<string, any>} article
 * @param {Record<string, any>} params
 * @returns {number}
 */
function inferPrecedence(article, params) {
  const direct = Number(article?.hierarchy?.precedence);
  if (Number.isFinite(direct)) return clamp(direct, 0, 100);

  const existingBand = article?.hierarchy?.precedence_band;
  const fromBand = Number(params?.precedence_bands?.[existingBand]?.min);
  if (Number.isFinite(fromBand)) return clamp(fromBand, 0, 100);

  const weight = Number(article?.hierarchy?.weight);
  if (Number.isFinite(weight)) {
    const inferred = weight <= 1 ? weight * 100 : weight;
    return clamp(inferred, 0, 100);
  }

  return 0;
}

/**
 * Treat weight as 0..1 and clamp, per CAE design requirement.
 * @param {Record<string, any>} article
 * @returns {number}
 */
function normalizeWeight(article) {
  const weight = Number(article?.hierarchy?.weight);
  if (!Number.isFinite(weight)) return 1;
  return clamp(weight, 0, 1);
}

/**
 * @param {string} bandName
 * @param {Record<string, any>} params
 * @returns {number}
 */
function severityFactorFromBand(bandName, params) {
  const min = Number(params?.precedence_bands?.[bandName]?.min);
  if (!Number.isFinite(min)) return 0.5;
  return clamp(min / 100, 0, 1);
}

/**
 * @param {Array<{result: 'PASS'|'WARN'|'FAIL', severity_band: string, weight: number}>} results
 * @param {number} before
 * @param {Record<string, any>} params
 */
function scoreAlignment(results, before, params) {
  const customOutcome = params?.alignment_scoring?.outcome_factor;
  const outcomeFactor = {
    ...DEFAULT_OUTCOME_FACTOR,
    ...(customOutcome || {})
  };

  let delta = 0;
  for (const row of results) {
    const outcome = Number(outcomeFactor[row.result]);
    const severity = severityFactorFromBand(row.severity_band, params);
    const weight = Number.isFinite(row.weight) ? row.weight : 1;
    const contribution = (Number.isFinite(outcome) ? outcome : 0) * severity * weight;
    delta += contribution;
  }

  const normalizedBefore = clamp(Number.isFinite(before) ? before : 1, 0, 1);
  const after = clamp(normalizedBefore + delta, 0, 1);

  return {
    before: normalizedBefore,
    delta,
    after
  };
}

module.exports = {
  clamp,
  inferPrecedence,
  inferPrecedenceBand,
  normalizeWeight,
  severityFactorFromBand,
  scoreAlignment
};
