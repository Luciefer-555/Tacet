import mongoose, { Document, Model, Schema } from 'mongoose';

export interface Comment {
  commentId: string;
  authorProfileId: string;
  text: string;
  createdAt: Date;
}

export interface Post {
  postId: string;
  authorProfileId: string;
  content: string;
  createdAt: Date;
  reactions: number;
  comments: Comment[];
}

export interface CollegeCommunityDocument extends Document {
  collegeId: string;
  collegeName: string;
  members: string[];
  posts: Post[];
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<Comment>(
  {
    commentId: { type: String, required: true, unique: false },
    authorProfileId: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PostSchema = new Schema<Post>(
  {
    postId: { type: String, required: true },
    authorProfileId: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    reactions: { type: Number, default: 0 },
    comments: { type: [CommentSchema], default: [] },
  },
  { _id: false }
);

const CollegeCommunitySchema = new Schema<CollegeCommunityDocument>(
  {
    collegeId: { type: String, required: true, unique: true, index: true },
    collegeName: { type: String, required: true },
    members: { type: [String], default: [] },
    posts: { type: [PostSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

CollegeCommunitySchema.index({ 'posts.postId': 1 });


export const CollegeCommunity: Model<CollegeCommunityDocument> =
  mongoose.models.CollegeCommunity ||
  mongoose.model<CollegeCommunityDocument>('CollegeCommunity', CollegeCommunitySchema);

export default CollegeCommunity;
