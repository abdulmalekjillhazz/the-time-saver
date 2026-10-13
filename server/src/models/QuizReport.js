import mongoose from 'mongoose';

const { Schema } = mongoose;

const quizReportSchema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    dailyLessonId: { type: Schema.Types.ObjectId, ref: 'DailyLesson', default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    questionIndex: { type: Number, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

quizReportSchema.index({ quizId: 1, questionIndex: 1 });
quizReportSchema.index({ createdAt: -1 });

export const QuizReport =
  mongoose.models.QuizReport || mongoose.model('QuizReport', quizReportSchema);
