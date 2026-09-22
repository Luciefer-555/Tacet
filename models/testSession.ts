import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ITestSession extends Document {
  problemId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId?: Types.ObjectId | null;
  startedAt: Date;
  timeLimitMinutes: number;
  draftCode?: string;
  lastDraftSavedAt?: Date;
  submittedAt?: Date;
  status: 'active' | 'submitted' | 'expired';
  autoPromoted?: boolean;
  autoPromotedAt?: Date;
  submissionId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TestSessionSchema = new Schema<ITestSession>(
  {
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', default: null },
    startedAt: { type: Date, required: true, default: Date.now },
    timeLimitMinutes: { type: Number, required: true },
    draftCode: { type: String, default: '' },
    lastDraftSavedAt: { type: Date },
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'submitted', 'expired'],
      default: 'active',
      index: true,
    },
    autoPromoted: { type: Boolean, default: false },
    autoPromotedAt: { type: Date },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', default: null },
  },
  { timestamps: true }
);

TestSessionSchema.index({ problemId: 1, studentId: 1 }, { unique: true });

export const TestSession: Model<ITestSession> =
  mongoose.models.TestSession || mongoose.model<ITestSession>('TestSession', TestSessionSchema);
export default TestSession;
