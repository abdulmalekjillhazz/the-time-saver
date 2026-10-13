import mongoose from 'mongoose';

const { Schema } = mongoose;

const dailyLessonSchema = new Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    audio: {
      status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      durationSeconds: { type: Number, default: null },
      voiceConfigVersion: { type: String, default: null },
      createdAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
      error: { type: String, default: null },
    },
    category: { type: String, enum: ['sleep', 'focus', 'health', 'social', 'growth'], required: true },
    locale: { type: String, enum: ['en', 'bn'], required: true },
    storyType: { type: String, enum: ['personal', 'science', 'myth', 'tool'], required: true },
    keyTakeaway: { type: String, required: true, trim: true, maxlength: 300 },
    vocabulary: [
      {
        _id: false,
        term: { type: String, required: true, trim: true, maxlength: 100 },
        definition: { type: String, required: true, trim: true, maxlength: 300 },
      },
    ],
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', default: null },
    generatedAt: { type: Date, default: () => new Date() },
    generationSource: { type: String, enum: ['ai', 'curated-fallback'], default: 'ai' },
    flaggedForReview: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    flaggedAt: { type: Date, default: null },
    shareCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dailyLessonSchema.index({ date: 1, locale: 1 }, { unique: true });
dailyLessonSchema.index({ date: -1 });
dailyLessonSchema.index({ flaggedForReview: 1 });

export const DailyLesson = mongoose.models.DailyLesson || mongoose.model('DailyLesson', dailyLessonSchema);
