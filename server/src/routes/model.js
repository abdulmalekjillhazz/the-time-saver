import { Router } from 'express';
import { activeModel } from '../services/mlRegistry.js';
import { DEFAULT_LOCAL_MODEL } from '../services/hybridPrediction.js';

export function modelRouter() {
  const r = Router();

  r.get('/current', async (req, res, next) => {
    try {
      const m = await activeModel();
      const source = m || DEFAULT_LOCAL_MODEL;
      const sha = source.artifactSha256 || source.sha256 || 'hybrid-local-v2-baseline';

      res.set('ETag', `"${sha}"`);
      res.set('Cache-Control', 'public, max-age=3600');
      if (req.get('if-none-match') === `"${sha}"`) return res.status(304).end();

      res.json({
        version: source.version,
        features: source.features,
        mean: source.mean,
        scale: source.scale,
        coefficients: source.coefficients,
        intercept: source.intercept,
        metrics: {
          auc: source.metrics.auc,
          brier: source.metrics.brier,
          calibrationSlope: source.metrics.calibrationSlope,
          holdoutRows: source.metrics.holdoutRows,
        },
        sha256: sha,
        activatedAt: source.activatedAt,
        demo: false,
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
