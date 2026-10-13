import mongoose from 'mongoose';

const { Schema } = mongoose;

const userBadgeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    badgeId: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
userBadgeSchema.index({ userId: 1, awardedAt: -1 });

export const UserBadge = mongoose.models.UserBadge || mongoose.model('UserBadge', userBadgeSchema);
