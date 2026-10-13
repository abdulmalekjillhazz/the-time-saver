import mongoose from 'mongoose';

const { Schema } = mongoose;

const routineSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, maxlength: 64 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    crossesMidnight: { type: Boolean, default: false },
    category: { type: String, default: 'general', maxlength: 40 },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    note: { type: String, default: '', maxlength: 300 },
    anchorHabit: { type: String, default: '', maxlength: 120 }, // Atomic Habit Stacking trigger
    isFrog: { type: Boolean, default: false },
    fallbackDuration: { type: Number, min: 1, max: 60, default: null },
    fallbackPrompt: { type: String, trim: true, maxlength: 200, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

routineSchema.index({ userId: 1, startTime: 1 });
// Only index routines with a clientId; a sparse compound index still includes the required userId.
routineSchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

export const Routine = mongoose.models.Routine || mongoose.model('Routine', routineSchema);
