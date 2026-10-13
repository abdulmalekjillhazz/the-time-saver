import mongoose from 'mongoose';

const { Schema } = mongoose;

const holidayNotificationLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  kind: { type: String, enum: ['eve', 'day'], required: true },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

holidayNotificationLogSchema.index({ userId: 1, date: 1, kind: 1 }, { unique: true });
holidayNotificationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const HolidayNotificationLog = mongoose.models.HolidayNotificationLog
  || mongoose.model('HolidayNotificationLog', holidayNotificationLogSchema);
