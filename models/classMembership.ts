import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IClassMembership extends Document {
  classId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClassMembershipSchema = new Schema<IClassMembership>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound unique index: a student can have at most one membership record per class
ClassMembershipSchema.index({ classId: 1, studentId: 1 }, { unique: true });

export const ClassMembership: Model<IClassMembership> =
  mongoose.models.ClassMembership || mongoose.model<IClassMembership>('ClassMembership', ClassMembershipSchema);
export default ClassMembership;
