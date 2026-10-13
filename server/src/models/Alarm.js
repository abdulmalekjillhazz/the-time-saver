import mongoose from 'mongoose';

const { Schema } = mongoose;

// Server copy of a user's one-shot alarm. The scheduler claims due alarms by
// setting firedAt (only when it is still null), so closed-app push and
// Telegram each fire exactly once even with several servers running.
const alarmSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, required: true, maxlength: 64 },
    at: { type: Date, required: true },
    name: { type: String, required: true, default: '', maxlength: 60 },
    timezone: { type: String, required: true, default: 'Asia/Dhaka' },
    firedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

alarmSchema.index({ userId: 1, clientId: 1 }, { unique: true });
alarmSchema.index({ firedAt: 1, cancelledAt: 1, at: 1 });
alarmSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Alarm = mongoose.models.Alarm || mongoose.model('Alarm', alarmSchema);
