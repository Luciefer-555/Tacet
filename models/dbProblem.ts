import mongoose, { Schema, model, models } from 'mongoose';

export interface IDbProblem {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  dbType: 'sql' | 'mongodb';
  schemaDefinition: string; // SQL DDL+INSERTs or MongoDB JSON documents
  referenceQuery: string;
  expectedResult: any;
  resultComparisonMode: 'ordered' | 'unordered';
  status: 'open' | 'closed';
  postedBy: mongoose.Types.ObjectId;
  postedByRole: 'hiring_manager' | 'mentor';
  problemType: 'company' | 'class_assignment';
  companyId?: string;
  collegeId?: string;
  classId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DbProblemSchema = new Schema<IDbProblem>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    dbType: {
      type: String,
      enum: ['sql', 'mongodb'],
      required: true,
    },
    schemaDefinition: {
      type: String,
      required: true,
    },
    referenceQuery: {
      type: String,
      required: true,
      select: false, // Hidden from students by default
    },
    expectedResult: {
      type: Schema.Types.Mixed,
      default: null,
      select: false,
    },
    resultComparisonMode: {
      type: String,
      enum: ['ordered', 'unordered'],
      default: 'unordered',
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    postedByRole: {
      type: String,
      enum: ['hiring_manager', 'mentor'],
      default: 'hiring_manager',
    },
    problemType: {
      type: String,
      enum: ['company', 'class_assignment'],
      default: 'company',
      index: true,
    },
    companyId: {
      type: String,
      default: null,
      index: true,
    },
    collegeId: {
      type: String,
      default: null,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default models.DbProblem || model<IDbProblem>('DbProblem', DbProblemSchema);
