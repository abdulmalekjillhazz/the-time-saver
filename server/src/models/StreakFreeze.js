import mongoose from 'mongoose';

const { Schema } = mongoose;

const streakFreezeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    week: { type: String, required: true, match: /^\d{4}-W\d{2}$/ },
  },
  { timestamps: true }
);

streakFreezeSchema.index({ userId: 1, week: 1 }, { unique: true });
streakFreezeSchema.index({ userId: 1, date: 1 }, { unique: true });

export const StreakFreeze = mongoose.models.StreakFreeze || mongoose.model('StreakFreeze', streakFreezeSchema);
