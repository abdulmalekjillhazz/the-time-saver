import mongoose from 'mongoose';

const { Schema } = mongoose;

const circleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 8 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

circleSchema.index({ 'members.userId': 1 });

export const Circle = mongoose.models.Circle || mongoose.model('Circle', circleSchema);
