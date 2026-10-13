import mongoose from 'mongoose';

const { Schema } = mongoose;

const dailyQuizScoreSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    dailyLessonId: { type: Schema.Types.ObjectId, ref: 'DailyLesson', required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    answers: { type: [Number], required: true },
    attemptedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

dailyQuizScoreSchema.index({ userId: 1, quizId: 1, attemptedAt: -1 });

export const DailyQuizScore =
  mongoose.models.DailyQuizScore || mongoose.model('DailyQuizScore', dailyQuizScoreSchema);
