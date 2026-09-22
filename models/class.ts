import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IClass extends Document {
  mentorId: Types.ObjectId;
  collegeId: string;
  name: string;
  classId: string;
  passwordHash: string;
  qrCodeDataUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    classId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    qrCodeDataUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ClassSchema.index({ collegeId: 1, mentorId: 1 });

export const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema);
export default Class;
