import 'dotenv/config';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MlModel } from '../src/models/MlModel.js';

const version = 'v1.0.0-candidate';
const artifactPath = fileURLToPath(new URL('../../ml/artifacts/synthetic-v20261010-093142.json', import.meta.url));

function assertLocalDevelopmentDatabase(uri) {
  if (!uri || process.env.NODE_ENV === 'production') {
    throw new Error('The demo model can only be installed with a configured non-production MongoDB database.');
  }
  let hostname;
  try {
    hostname = new URL(uri).hostname.replace(/^\[|\]$/g, '');
  } catch {
    throw new Error('MONGODB_URI is not a valid MongoDB URL.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Refusing to install synthetic demo weights into a non-local database.');
  }
}

async function main() {
  assertLocalDevelopmentDatabase(process.env.MONGODB_URI);
  const artifactBytes = await readFile(artifactPath);
  const artifact = JSON.parse(artifactBytes.toString('utf8'));
  if (artifact.status !== 'synthetic' || !Array.isArray(artifact.features)) {
    throw new Error('The local model artifact is not marked as synthetic.');
  }
  const artifactSha256 = crypto.createHash('sha256').update(artifactBytes).digest('hex');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  if (await MlModel.exists({ status: 'active' })) {
    console.log('A validated model is already active; leaving it unchanged.');
    return;
  }
  await MlModel.updateMany({ status: 'demo-active' }, { $set: { status: 'retired', isActive: false } });
  const model = await MlModel.findOneAndUpdate(
    { version },
    {
      $set: {
        version,
        status: 'demo-active',
        isActive: true,
        isDemo: true,
        features: artifact.features,
        mean: artifact.mean,
        scale: artifact.scale,
        coefficients: artifact.coefficients,
        intercept: artifact.intercept,
        metrics: artifact.metrics,
        decisionReasons: ['synthetic data: local demonstration only; not validated for personal risk'],
        trainingWindow: artifact.trainingWindow,
        rows: artifact.rows,
        artifactSha256,
        consentVersion: artifact.consentVersion,
        activatedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  console.log(`Installed ${model.version} as a local-only demo model. Predictions are illustrative, not validated.`);
}

main()
  .catch((err) => {
    console.error(`Local demo model activation failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
