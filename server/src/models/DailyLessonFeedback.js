import mongoose from 'mongoose';

const { Schema } = mongoose;

const dailyLessonFeedbackSchema = new Schema(
  {
    dailyLessonId: { type: Schema.Types.ObjectId, ref: 'DailyLesson', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    helpful: { type: Boolean, default: null },
    accurate: { type: Boolean, default: null },
    rating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, trim: true, maxlength: 500, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

dailyLessonFeedbackSchema.index({ dailyLessonId: 1, createdAt: -1 });
dailyLessonFeedbackSchema.index({ dailyLessonId: 1, userId: 1 });

export const DailyLessonFeedback =
  mongoose.models.DailyLessonFeedback || mongoose.model('DailyLessonFeedback', dailyLessonFeedbackSchema);
