import mongoose from 'mongoose';

const { Schema } = mongoose;

const telegramNotificationLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  routineId: { type: Schema.Types.ObjectId, ref: 'Routine', default: null },
  date: { type: String, required: true },
  kind: { type: String, enum: ['morning', 'evening', 'habit'], required: true },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

telegramNotificationLogSchema.index(
  { userId: 1, date: 1, kind: 1, routineId: 1 },
  { unique: true }
);
telegramNotificationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TelegramNotificationLog = mongoose.models.TelegramNotificationLog
  || mongoose.model('TelegramNotificationLog', telegramNotificationLogSchema);
