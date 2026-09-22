import mongoose, { Document, Model, Schema } from 'mongoose';

export interface UserDocument extends Document {
  username: string;
  profileId: string;
  collegeId: string;
  collegeName: string;
  companyId?: string;
  email: string;
  phone: string;
  skills: string[];
  role: string;
  joinedAt: Date;
  branch?: string;
  year?: string;
  avatarUrl?: string;
  passwordHash?: string;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  credentialRecoveryCode?: string | null;
  credentialRecoveryExpires?: Date | null;
  emailVerified?: boolean;
  emailVerificationTokenIssuedAt?: Date | null;
  loggedOutAt?: Date | null;
}

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, trim: true },
    profileId: { type: String, required: true, unique: true },
    collegeId: {
      type: String,
      required: function (this: any): boolean {
        return this.role === 'student' || this.role === 'mentor';
      },
      index: true,
    },
    companyId: {
      type: String,
      required: function (this: any): boolean {
        return this.role === 'hiring_manager';
      },
    },
    collegeName: {
      type: String,
      required: function (this: any): boolean {
        return this.role === 'student' || this.role === 'mentor';
      },
    },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    skills: { type: [String], default: [] },
    branch: { type: String, default: '' },
    year: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    role: { type: String, default: 'student', enum: ['student', 'mentor', 'admin', 'hiring_manager'] },
    joinedAt: { type: Date, default: Date.now },
    passwordHash: { type: String },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    credentialRecoveryCode: { type: String, default: null },
    credentialRecoveryExpires: { type: Date, default: null },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenIssuedAt: {
      type: Date,
      default: null,
    },
    loggedOutAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

UserSchema.index({ collegeId: 1, profileId: 1 });

export const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);

export default User;
