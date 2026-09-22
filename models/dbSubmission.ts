import mongoose, { Schema, model, models } from 'mongoose';

export interface IDbSubmission {
  _id: mongoose.Types.ObjectId;
  problemId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  dbType: 'sql' | 'mongodb';
  query: string;
  actualResult: any;
  passed: boolean;
  error?: string | null;
  status: 'submitted' | 'scored' | 'failed_gate';
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DbSubmissionSchema = new Schema<IDbSubmission>(
  {
    problemId: {
      type: Schema.Types.ObjectId,
      ref: 'DbProblem',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dbType: {
      type: String,
      enum: ['sql', 'mongodb'],
      required: true,
    },
    query: {
      type: String,
      required: true,
    },
    actualResult: {
      type: Schema.Types.Mixed,
      default: null,
    },
    passed: {
      type: Boolean,
      required: true,
      default: false,
    },
    error: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['submitted', 'scored', 'failed_gate'],
      default: 'submitted',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

DbSubmissionSchema.index({ problemId: 1, studentId: 1 }, { unique: true });

export default models.DbSubmission || model<IDbSubmission>('DbSubmission', DbSubmissionSchema);
