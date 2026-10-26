import mongoose, { Schema } from 'mongoose';

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    url: { type: String, trim: true, maxlength: 500, default: '/today' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredCount: { type: Number, default: 0 },
    totalSubscribers: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Announcement =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

