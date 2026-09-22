import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface RequiredSkill {
  name: string;
  weight: number;
}

export interface ProblemVariant {
  variantId: string;
  title: string;
  description: string;
  generationFailed?: boolean;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface ProblemDocument extends Document {
  title: string;
  description: string;
  archetype?: string;
  difficulty: string;
  status: string;
  companyId?: string;
  collegeId?: string;
  classId?: Types.ObjectId;
  timeLimit?: number;
  opensAt?: Date;
  problemType: 'company' | 'class_assignment';
  problemFormat: 'open_ended' | 'coding';
  gradingMode?: 'stdin_stdout' | 'function_signature';
  functionName?: string;
  parameters?: { name: string; type: string }[];
  returnType?: string;
  functionTestCases?: {
    inputs: Record<string, any>;
    expectedOutput: any;
    hidden: boolean;
  }[];
  language?: string;
  testCases: TestCase[];
  referenceSolution?: string;
  postedBy: Types.ObjectId;
  postedByRole: string;
  requiredSkills: RequiredSkill[];
  rubric?: string;
  datasetSummary?: string;
  variants: ProblemVariant[];
  createdAt: Date;
}

const RequiredSkillSchema = new Schema<RequiredSkill>(
  {
    name: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 0, default: 1 },
  },
  { _id: false }
);

const ProblemSchema = new Schema<ProblemDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    archetype: { type: String, trim: true },
    difficulty: {
      type: String,
      required: true,
      enum: ['Easy', 'Medium', 'Hard'],
    },
    status: {
      type: String,
      default: 'open',
      enum: ['open', 'closed', 'draft'],
    },
    companyId: { type: String, trim: true },
    collegeId: { type: String, trim: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', default: null, index: true },
    timeLimit: { type: Number, default: null },
    opensAt: { type: Date, default: null },
    problemType: {
      type: String,
      enum: ['company', 'class_assignment'],
      default: 'company',
      index: true,
    },
    problemFormat: {
      type: String,
      enum: ['open_ended', 'coding'],
      default: 'open_ended',
    },
    gradingMode: {
      type: String,
      enum: ['stdin_stdout', 'function_signature'],
      default: 'stdin_stdout',
    },
    functionName: { type: String },
    parameters: [{
      name: { type: String, required: true },
      type: { type: String, required: true },
      _id: false,
    }],
    returnType: { type: String },
    functionTestCases: [{
      inputs: { type: Schema.Types.Mixed, required: true },
      expectedOutput: { type: Schema.Types.Mixed },
      hidden: { type: Boolean, default: false },
      _id: false,
    }],
    language: {
      type: String,
      enum: ['python', 'java', 'c', 'cpp'],
      default: null,
    },
    testCases: {
      type: [
        new Schema<{ input: string; expectedOutput: string; hidden: boolean }>(
          {
            input: { type: String, required: true },
            expectedOutput: { type: String, required: true },
            hidden: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    referenceSolution: {
      type: String,
      select: false,
    },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Mongoose-level enforcement: hiring_manager or mentor can be stored here.
    // Additionally enforced at the MongoDB collection level via $jsonSchema
    // validator (see scripts/mongo-problem-validator.ts).
    postedByRole: {
      type: String,
      required: true,
      enum: ['hiring_manager', 'mentor'],
    },
    requiredSkills: { type: [RequiredSkillSchema], default: [] },
    rubric: { type: String },
    datasetSummary: { type: String },
    variants: {
      type: [
        new Schema<{ variantId: string; title: string; description: string; generationFailed?: boolean }>(
          {
            variantId: { type: String, required: true },
            title: { type: String, required: true },
            description: { type: String, default: '' },
            generationFailed: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

ProblemSchema.index({ postedBy: 1 });
ProblemSchema.index({ status: 1, difficulty: 1 });

export const Problem: Model<ProblemDocument> =
  mongoose.models.Problem || mongoose.model<ProblemDocument>('Problem', ProblemSchema);

export default Problem;