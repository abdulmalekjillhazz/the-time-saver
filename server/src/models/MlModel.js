import mongoose from 'mongoose';

const { Schema } = mongoose;

// One row per trained model version. Only one row can be active at a time (enforced by the index).
const mlModelSchema = new Schema(
  {
    version: { type: String, required: true, unique: true },
    status: { type: String, enum: ['candidate', 'rejected', 'active', 'retired', 'synthetic', 'demo-active'], required: true },
    isActive: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    features: { type: [String], required: true },
    mean: { type: [Number], required: true },
    scale: { type: [Number], required: true },
    coefficients: { type: [Number], required: true },
    intercept: { type: Number, required: true },
    metrics: { type: Schema.Types.Mixed, required: true },
    decisionReasons: { type: [String], default: [] },
    trainingWindow: { type: Schema.Types.Mixed, default: {} },
    rows: { type: Number, default: 0 },
    artifactSha256: { type: String, required: true },
    consentVersion: { type: String, required: true },
    activatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// At most one active model. A second activation fails at the database, even if two admins race.
mlModelSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const MlModel = mongoose.models.MlModel || mongoose.model('MlModel', mlModelSchema);
