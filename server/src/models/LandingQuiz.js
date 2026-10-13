import mongoose from 'mongoose';

const { Schema } = mongoose;

const bilingual = (maxLength) => ({
  bn: { type: String, required: true, trim: true, maxlength: maxLength },
  en: { type: String, required: true, trim: true, maxlength: maxLength },
});

const landingQuizSchema = new Schema(
  {
    slot: { type: Number, required: true, enum: [1, 2], unique: true },
    question: bilingual(300),
    options: {
      type: [bilingual(160)],
      validate: { validator: (options) => options.length === 4, message: 'a landing quiz needs exactly four options' },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: bilingual(600),
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const LandingQuiz = mongoose.models.LandingQuiz || mongoose.model('LandingQuiz', landingQuizSchema);
