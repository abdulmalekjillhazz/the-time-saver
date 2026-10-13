import mongoose from 'mongoose';

const { Schema } = mongoose;

const weeklySummarySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    weekEndDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // Sunday of the week
    content: { type: String, required: true }, // Markdown-formatted summary
    locale: { type: String, enum: ['en', 'bn'], required: true },
    generatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// One summary per user per week (identified by Sunday date) per locale.
// The unique index prevents duplicate summaries under concurrency.
weeklySummarySchema.index({ userId: 1, weekEndDate: 1, locale: 1 }, { unique: true });
// Index for fetching summaries for a user ordered by recency.
weeklySummarySchema.index({ userId: 1, weekEndDate: -1 });

export const WeeklySummary = mongoose.models.WeeklySummary || mongoose.model('WeeklySummary', weeklySummarySchema);
