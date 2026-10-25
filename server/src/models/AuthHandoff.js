import mongoose from 'mongoose';

const authHandoffSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

authHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthHandoff =
  mongoose.models.AuthHandoff || mongoose.model('AuthHandoff', authHandoffSchema);
