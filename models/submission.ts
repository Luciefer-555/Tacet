import mongoose, { Schema, model, models } from 'mongoose';

const SubmissionSchema = new Schema(
  {
    problemId: {
      type: Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: false, // no longer strictly required — a file upload can be the submission instead
      default: '',
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'pptx', 'docx', 'png', 'jpg', 'jpeg', null],
      default: null,
    },
    extractedContent: {
      type: String,
      default: null,
    },
    code: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      default: null,
    },
    functionInputs: {
      type: Schema.Types.Mixed,
      default: null,
    },
    runOnly: {
      type: Boolean,
      default: false,
    },
    testResults: {
      type: [
        new Schema(
          {
            input: { type: String },
            expectedOutput: { type: String },
            actualOutput: { type: String },
            passed: { type: Boolean },
            hidden: { type: Boolean, default: false },
            time: { type: Number, default: null },
            memory: { type: Number, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    correctnessScore: {
      type: Number,
      default: null,
    },
    correctnessGatePassed: {
      type: Boolean,
      default: null,
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'scored', 'failed_gate'],
      default: 'submitted',
    },
    aiScore: {
      type: Number,
      default: null,
    },
    aiRationale: {
      type: String,
      default: null,
    },
    manualScore: {
      type: Number,
      default: null,
    },
    problemVariantId: {
      type: String,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    autoPromoted: {
      type: Boolean,
      default: false,
    },
    autoPromotionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

SubmissionSchema.index({ problemId: 1, studentId: 1 }, { unique: true });

export default models.Submission || model('Submission', SubmissionSchema);
