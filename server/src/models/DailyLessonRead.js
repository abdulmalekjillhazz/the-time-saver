import mongoose from 'mongoose';

const { Schema } = mongoose;

const dailyLessonReadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dailyLessonId: { type: Schema.Types.ObjectId, ref: 'DailyLesson', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

dailyLessonReadSchema.index({ userId: 1, dailyLessonId: 1 }, { unique: true });
dailyLessonReadSchema.index({ userId: 1, readAt: -1 });

export const DailyLessonRead =
  mongoose.models.DailyLessonRead || mongoose.model('DailyLessonRead', dailyLessonReadSchema);
