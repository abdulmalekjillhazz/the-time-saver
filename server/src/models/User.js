import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, default: undefined, unique: true, sparse: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    avatarUrl: { type: String, default: null, maxlength: 2048 },
    avatarId: { type: String, enum: ['sunrise', 'wave', 'curls', 'hijab', 'glasses', 'cap'], default: 'sunrise' },
    locale: { type: String, enum: ['bn', 'en'], default: 'bn' },
    timezone: { type: String, default: 'Asia/Dhaka' },
    role: { type: String, enum: ['user', 'viewer', 'editor', 'owner'], default: 'user' },
    telegramChatId: { type: String, default: null, trim: true },
    telegramNotifications: { type: Boolean, default: false },
    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, select: false },
      lastStep: { type: Number, default: 0 },
    },
    consents: {
      modelTraining: {
        granted: { type: Boolean, default: false },
        version: { type: String, default: 'model-training-v1' },
        updatedAt: { type: Date, default: () => new Date() },
      },
    },
    isRestricted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
