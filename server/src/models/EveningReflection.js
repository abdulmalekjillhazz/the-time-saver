import mongoose from 'mongoose';

const { Schema } = mongoose;

const eveningReflectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    mood: { type: String, enum: ['happy', 'neutral', 'tired'], required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

eveningReflectionSchema.index({ userId: 1, date: 1 }, { unique: true });

export const EveningReflection =
  mongoose.models.EveningReflection || mongoose.model('EveningReflection', eveningReflectionSchema);
