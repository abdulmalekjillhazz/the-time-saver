import crypto from 'node:crypto';
import { MODEL_FEATURES } from '@smart-routine/shared';

const MIN_ROWS = 200;
const MIN_TEST_ROWS = 50;
const MIN_MINORITY_TRAIN = 10;
const C_GRID = [0.1, 1, 10];

function refusal(message) {
  const error = new Error(message);
  error.code = 'TRAINING_REFUSED';
  return error;
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function features(row) {
  const start = Number(row.start_hour);
  const duration = Number(row.duration_min);
  const weekday = Number(row.weekday);
  const missed = Number(row.missed);
  if (
    !validDay(row.day) ||
    !/^[0-9a-f]{16}$/.test(row.user_hash) ||
    !Number.isInteger(start) || start < 0 || start > 23 ||
    !Number.isFinite(duration) || duration <= 0 || duration > 1440 ||
    !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
    !['low', 'medium', 'high'].includes(row.priority) ||
    ![0, 1].includes(missed)
  ) throw refusal('Training data contains an invalid row.');
  return [
    start < 8 ? 1 : 0,
    start,
    duration,
    weekday,
    row.priority === 'low' ? 1 : 0,
    row.priority === 'medium' ? 1 : 0,
  ];
}

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function solve(matrix, vector) {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  const n = vector.length;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return Array(n).fill(0);
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function fit(x, y, c, enforceMinimum = true) {
  if (enforceMinimum && Math.min(y.filter(Boolean).length, y.filter((v) => !v).length) < MIN_MINORITY_TRAIN) {
    throw refusal(`Too few examples of one outcome in training; at least ${MIN_MINORITY_TRAIN} are needed.`);
  }
  const width = x[0].length + 1;
  const weights = Array(width).fill(0);
  for (let iter = 0; iter < 100; iter += 1) {
    const hessian = Array.from({ length: width }, () => Array(width).fill(0));
    const gradient = Array(width).fill(0);
    for (let i = 0; i < x.length; i += 1) {
      const row = [1, ...x[i]];
      const p = sigmoid(row.reduce((sum, value, j) => sum + value * weights[j], 0));
      const error = p - y[i];
      const curvature = Math.max(p * (1 - p), 1e-12);
      for (let j = 0; j < width; j += 1) {
        gradient[j] += row[j] * error;
        for (let k = 0; k < width; k += 1) hessian[j][k] += row[j] * row[k] * curvature;
      }
    }
    for (let j = 1; j < width; j += 1) {
      gradient[j] += weights[j] / c;
      hessian[j][j] += 1 / c;
    }
    const step = solve(hessian, gradient);
    let largest = 0;
    for (let j = 0; j < width; j += 1) {
      weights[j] -= step[j];
      largest = Math.max(largest, Math.abs(step[j]));
    }
    if (largest < 1e-8) break;
  }
  if (!weights.every(Number.isFinite)) throw refusal('Training did not converge to a valid model.');
  return { intercept: weights[0], coefficients: weights.slice(1) };
}

function logLoss(y, p) {
  return -y.reduce((sum, outcome, i) => {
    const probability = Math.min(1 - 1e-15, Math.max(1e-15, p[i]));
    return sum + outcome * Math.log(probability) + (1 - outcome) * Math.log(1 - probability);
  }, 0) / y.length;
}

function predict(model, x) {
  return x.map((row) => sigmoid(model.intercept + row.reduce((sum, value, i) => sum + value * model.coefficients[i], 0)));
}

function auc(y, p) {
  const order = p.map((value, index) => ({ value, outcome: y[index] })).sort((a, b) => a.value - b.value);
  let positiveRanks = 0;
  let positives = 0;
  let negatives = 0;
  for (let i = 0; i < order.length;) {
    let end = i + 1;
    while (end < order.length && order[end].value === order[i].value) end += 1;
    const tiedPositives = order.slice(i, end).filter((item) => item.outcome).length;
    const tiedNegatives = end - i - tiedPositives;
    positiveRanks += tiedPositives * ((i + 1 + end) / 2);
    positives += tiedPositives;
    negatives += tiedNegatives;
    i = end;
  }
  return positives && negatives ? (positiveRanks - positives * (positives + 1) / 2) / (positives * negatives) : 0.5;
}

function calibration(y, probabilities) {
  const logits = probabilities.map((p) => Math.log(Math.min(1 - 1e-6, Math.max(1e-6, p)) / Math.max(1e-6, 1 - p)));
  let intercept = 0;
  let slope = 1;
  for (let iter = 0; iter < 100; iter += 1) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (let i = 0; i < y.length; i += 1) {
      const p = sigmoid(intercept + slope * logits[i]);
      const e = p - y[i];
      const w = Math.max(p * (1 - p), 1e-12);
      g0 += e;
      g1 += e * logits[i];
      h00 += w;
      h01 += w * logits[i];
      h11 += w * logits[i] * logits[i];
    }
    const determinant = h00 * h11 - h01 * h01;
    if (Math.abs(determinant) < 1e-12) return { slope: 0, intercept: 0 };
    const d0 = (h11 * g0 - h01 * g1) / determinant;
    const d1 = (h00 * g1 - h01 * g0) / determinant;
    intercept -= d0;
    slope -= d1;
    if (Math.max(Math.abs(d0), Math.abs(d1)) < 1e-8) break;
  }
  return { slope, intercept };
}

function metrics(y, p) {
  const brier = y.reduce((sum, outcome, i) => sum + (p[i] - outcome) ** 2, 0) / y.length;
  const ece = Array.from({ length: 10 }, (_, bin) => {
    const group = p.map((probability, i) => ({ probability, outcome: y[i] }))
      .filter(({ probability }) => Math.min(9, Math.floor(probability * 10)) === bin);
    if (!group.length) return 0;
    return group.length / y.length * Math.abs(
      group.reduce((sum, item) => sum + item.probability, 0) / group.length -
      group.reduce((sum, item) => sum + item.outcome, 0) / group.length
    );
  }).reduce((sum, value) => sum + value, 0);
  const calibrationMetrics = calibration(y, p);
  return {
    auc: auc(y, p),
    brier,
    calibrationSlope: calibrationMetrics.slope,
    calibrationIntercept: calibrationMetrics.intercept,
    expectedCalibrationError: ece,
    holdoutRows: y.length,
    holdoutMissRate: y.reduce((sum, value) => sum + value, 0) / y.length,
  };
}

function stratifiedFolds(labels) {
  const groups = [[], []];
  labels.forEach((label, index) => groups[label].push(index));
  let state = 7;
  for (const group of groups) {
    for (let i = group.length - 1; i > 0; i -= 1) {
      state = (state * 48271) % 2147483647;
      const j = state % (i + 1);
      [group[i], group[j]] = [group[j], group[i]];
    }
  }
  const folds = Array.from({ length: 3 }, () => []);
  groups.forEach((group) => group.forEach((index, i) => folds[i % 3].push(index)));
  return folds;
}

function standardize(matrix, mean, scale) {
  return matrix.map((row) => row.map((value, i) => (value - mean[i]) / scale[i]));
}

function crossValidate(x, y) {
  const folds = stratifiedFolds(y);
  let bestC = C_GRID[0];
  let bestLoss = Infinity;
  for (const c of C_GRID) {
    let totalLoss = 0;
    let count = 0;
    for (const validation of folds) {
      const held = new Set(validation);
      const trainX = x.filter((_, i) => !held.has(i));
      const trainY = y.filter((_, i) => !held.has(i));
      if (new Set(trainY).size < 2) throw refusal('Cross-validation could not split both outcomes.');
      const model = fit(trainX, trainY, c, false);
      const probabilities = predict(model, validation.map((i) => x[i]));
      totalLoss += logLoss(validation.map((i) => y[i]), probabilities) * validation.length;
      count += validation.length;
    }
    const loss = totalLoss / count;
    if (loss < bestLoss) {
      bestLoss = loss;
      bestC = c;
    }
  }
  return bestC;
}

export function trainNodeModel(rows, { now = new Date() } = {}) {
  if (!Array.isArray(rows) || rows.length < MIN_ROWS) {
    throw refusal(`Only ${rows?.length ?? 0} rows; at least ${MIN_ROWS} consented completions are needed.`);
  }
  const days = [...new Set(rows.map((row) => row.day))].sort();
  const cut = Math.floor(days.length * 0.8);
  if (cut < 1 || cut >= days.length) throw refusal('Need at least two different days for a time-based split.');
  const cutoff = days[cut];
  const trainRows = rows.filter((row) => row.day < cutoff);
  const testRows = rows.filter((row) => row.day >= cutoff);
  if (new Set(trainRows.map((row) => Number(row.missed))).size < 2 || new Set(testRows.map((row) => Number(row.missed))).size < 2) {
    throw refusal('Both training and holdout periods must contain both outcomes.');
  }
  const trainXRaw = trainRows.map(features);
  const testXRaw = testRows.map(features);
  const trainY = trainRows.map((row) => Number(row.missed));
  const testY = testRows.map((row) => Number(row.missed));
  const mean = MODEL_FEATURES.map((_, i) => trainXRaw.reduce((sum, row) => sum + row[i], 0) / trainXRaw.length);
  const scale = MODEL_FEATURES.map((_, i) => Math.sqrt(trainXRaw.reduce((sum, row) => sum + (row[i] - mean[i]) ** 2, 0) / trainXRaw.length) || 1);
  const trainX = standardize(trainXRaw, mean, scale);
  const testX = standardize(testXRaw, mean, scale);
  const chosenC = crossValidate(trainX, trainY);
  const model = fit(trainX, trainY, chosenC);
  const probabilities = predict(model, testX);
  const resultMetrics = metrics(testY, probabilities);
  if (!Object.values(resultMetrics).every(Number.isFinite)) {
    throw refusal('Validation produced non-finite quality metrics.');
  }
  const rate = trainY.reduce((sum, value) => sum + value, 0) / trainY.length;
  const priorityRate = (priority) => {
    const outcomes = trainRows.filter((row) => row.priority === priority).map((row) => Number(row.missed));
    return outcomes.length ? outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length : rate;
  };
  const constantP = testY.map(() => rate);
  const priorityP = testRows.map((row) => priorityRate(row.priority));
  const baselines = {
    constant: { brier: metrics(testY, constantP).brier, auc: auc(testY, constantP) },
    perPriority: { brier: metrics(testY, priorityP).brier, auc: auc(testY, priorityP) },
  };
  if (!Object.values(baselines).every((baseline) => Object.values(baseline).every(Number.isFinite))) {
    throw refusal('Baseline validation produced non-finite quality metrics.');
  }
  const reasons = [];
  if (testRows.length < MIN_TEST_ROWS) reasons.push(`holdout has fewer than ${MIN_TEST_ROWS} rows`);
  if (resultMetrics.brier >= Math.min(baselines.constant.brier, baselines.perPriority.brier)) reasons.push('Brier score is not better than both baselines');
  if (resultMetrics.auc <= Math.max(baselines.constant.auc, baselines.perPriority.auc)) reasons.push('AUC is not better than both baselines');
  if (resultMetrics.calibrationSlope < 0.8 || resultMetrics.calibrationSlope > 1.2) reasons.push('calibration slope is outside 0.8 to 1.2');

  const start = trainRows.map((row) => row.day).sort()[0];
  const end = testRows.map((row) => row.day).sort().at(-1);
  const version = `v${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const artifact = {
    version,
    createdAt: now.toISOString(),
    status: reasons.length ? 'rejected' : 'candidate',
    consentVersion: 'model-training-v1',
    features: MODEL_FEATURES,
    mean,
    scale,
    coefficients: model.coefficients,
    intercept: model.intercept,
    chosenC,
    metrics: { ...resultMetrics, baselines },
    trainingWindow: { start, cutoff, end, trainRows: trainRows.length, testRows: testRows.length },
    rows: rows.length,
    decision: { status: reasons.length ? 'rejected' : 'candidate', reasons },
  };
  const bytes = Buffer.from(JSON.stringify(artifact, null, 2));
  return { artifact, bytes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}
