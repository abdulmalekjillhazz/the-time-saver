import mongoose from 'mongoose';

const { Schema } = mongoose;

const taskCompletionReminderLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  kind: { type: String, enum: ['morning', 'evening'], required: true },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

taskCompletionReminderLogSchema.index({ userId: 1, date: 1, kind: 1 }, { unique: true });
taskCompletionReminderLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TaskCompletionReminderLog = mongoose.models.TaskCompletionReminderLog
  || mongoose.model('TaskCompletionReminderLog', taskCompletionReminderLogSchema);
