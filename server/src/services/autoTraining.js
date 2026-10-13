import { buildTrainingRows } from './mlExport.js';
import { importArtifact, activate } from './mlRegistry.js';
import { writeAudit } from './audit.js';
import { trainNodeModel } from './nodeTrainer.js';

export async function runAutomaticTraining(secret, { now = new Date() } = {}) {
  const rows = await buildTrainingRows(secret);
  const { artifact, bytes, sha256 } = trainNodeModel(rows, { now });
  const imported = await importArtifact(bytes, sha256);
  const activated = artifact.status === 'candidate' ? await activate(artifact.version) : null;
  await writeAudit({
    action: 'model.auto_train',
    targetType: 'model',
    targetId: artifact.version,
    summary: `status=${artifact.status},rows=${rows.length},autoActivated=${Boolean(activated)}`,
  });
  return {
    version: imported.version,
    status: artifact.status,
    rows: rows.length,
    autoActivated: Boolean(activated),
  };
}
