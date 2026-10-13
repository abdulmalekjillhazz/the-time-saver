import mongoose from 'mongoose';

const { Schema } = mongoose;

const quizSchema = new Schema(
  {
    dailyLessonId: { type: Schema.Types.ObjectId, ref: 'DailyLesson', required: true, unique: true },
    lessonSlug: { type: String, required: true, lowercase: true, trim: true },
    questions: [
      {
        _id: false,
        text: { type: String, required: true, trim: true, maxlength: 300 },
        options: [
          {
            _id: false,
            text: { type: String, required: true, trim: true, maxlength: 200 },
            correct: { type: Boolean, required: true, default: false },
          },
        ],
        explanation: { type: String, required: true, trim: true, maxlength: 500 },
      },
    ],
    generatedAt: { type: Date, default: () => new Date() },
    flaggedForReview: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    flaggedAt: { type: Date, default: null },
    reportCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

quizSchema.index({ lessonSlug: 1 });
quizSchema.index({ createdAt: -1 });
quizSchema.index({ flaggedForReview: 1 });

export const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
