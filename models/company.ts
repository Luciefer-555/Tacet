import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface CompanyDocument extends Document {
  companyId: string;
  name: string;
  logoUrl?: string;
  website?: string;
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const CompanySchema = new Schema<CompanyDocument>(
  {
    companyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    website: {
      type: String,
      default: null,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

const Company: Model<CompanyDocument> =
  mongoose.models.Company || mongoose.model<CompanyDocument>('Company', CompanySchema);

export default Company;
