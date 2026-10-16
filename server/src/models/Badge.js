import mongoose from 'mongoose';

const { Schema } = mongoose;

const localizedTextSchema = new Schema(
  {
    en: { type: String, required: true },
    bn: { type: String, required: true },
  },
  { _id: false }
);

const badgeSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['early-bird', 'century-focus', 'quiz-master', 'consistent-learner', 'first-learning-day'],
    },
    name: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
  },
  { timestamps: true }
);

export const Badge = mongoose.models.Badge || mongoose.model('Badge', badgeSchema);
