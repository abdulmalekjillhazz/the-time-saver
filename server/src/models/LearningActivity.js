import mongoose from 'mongoose';

const { Schema } = mongoose;

const learningActivitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    activityType: { type: String, enum: ['story', 'quiz'], required: true },
    contentId: { type: String, required: true },
    points: { type: Number, required: true, min: 0 },
    activeDate: { type: String, required: true },
  },
  { timestamps: true }
);

learningActivitySchema.index({ userId: 1, activityType: 1, contentId: 1 }, { unique: true });
learningActivitySchema.index({ points: -1, activeDate: 1 });

export const LearningActivity =
  mongoose.models.LearningActivity || mongoose.model('LearningActivity', learningActivitySchema);
