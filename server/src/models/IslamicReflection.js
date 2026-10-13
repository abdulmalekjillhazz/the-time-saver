import mongoose from 'mongoose';

const { Schema } = mongoose;

const islamicReflectionSchema = new Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    locale: { type: String, enum: ['bn', 'en'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    reflection: { type: String, required: true, trim: true, maxlength: 900 },
    practicalAction: { type: String, required: true, trim: true, maxlength: 220 },
    sourceType: { type: String, enum: ['quran', 'hadith', 'general'], default: 'general' },
    sourceCitation: { type: String, trim: true, maxlength: 180, default: '' },
    generatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

islamicReflectionSchema.index({ date: 1, locale: 1 }, { unique: true });

export const IslamicReflection = mongoose.models.IslamicReflection
  || mongoose.model('IslamicReflection', islamicReflectionSchema);
