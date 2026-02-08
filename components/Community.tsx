"use client"

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, ThumbsUp, Share2, X, Image as ImageIcon, Link as LinkIcon, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Comment {
  id: string;
  user: string;
  avatar: string;
  content: string;
  timestamp: string;
}

interface Post {
  id: string;
  user: string;
  department: string;
  year: string;
  avatar: string;
  timestamp: string;
  title: string;
  content: string;
  category: 'achievement' | 'idea' | 'event' | 'opportunity';
  image?: string;
  link?: string;
  likes: number;
  comments: Comment[];
  isPinned?: boolean;
}

const Community = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [postContent, setPostContent] = useState({
    title: '',
    content: '',
    category: 'idea' as 'achievement' | 'idea' | 'event' | 'opportunity',
    image: ''
  });

  // Mock data for initial posts
  useEffect(() => {
    setPosts([
      {
        id: '1',
        user: 'Alex Chen',
        department: 'Computer Science',
        year: '3rd Year',
        avatar: 'AC',
        timestamp: '2h ago',
        title: 'Just won 1st place at HackTheNorth!',
        content: 'Our team built an AI-powered accessibility tool that translates sign language to speech in real-time. So grateful for this opportunity!',
        category: 'achievement',
        image: 'https://source.unsplash.com/random/800x400/?hackathon',
        likes: 24,
        comments: [
          { id: 'c1', user: 'Jordan Smith', avatar: 'JS', content: 'This is amazing! How did you train the model?', timestamp: '1h ago' },
          { id: 'c2', user: 'Taylor Wilson', avatar: 'TW', content: 'Congrats! Would love to collaborate on this project.', timestamp: '45m ago' }
        ],
        isPinned: true
      },
      {
        id: '2',
        user: 'Casey Kim',
        department: 'Data Science',
        year: '2nd Year',
        avatar: 'CK',
        timestamp: '5h ago',
        title: 'Looking for study group members',
        content: 'Anyone interested in forming a study group for the upcoming ML midterm? We can meet in the library or online.',
        category: 'opportunity',
        likes: 8,
        comments: []
      },
      {
        id: '3',
        user: 'Morgan Lee',
        department: 'Cybersecurity',
        year: '4th Year',
        avatar: 'ML',
        timestamp: '1d ago',
        title: 'Idea: Campus Sustainability App',
        content: 'I was thinking about creating an app that helps track and reduce energy consumption on campus. Would anyone be interested in contributing to this project?',
        category: 'idea',
        likes: 15,
        comments: [
          { id: 'c3', user: 'Riley Johnson', avatar: 'RJ', content: 'Great idea! I have some experience with IoT sensors that could help with energy monitoring.', timestamp: '20h ago' }
        ]
      },
      {
        id: '4',
        user: 'Campus Tech Club',
        department: 'Official',
        year: '',
        avatar: 'CT',
        timestamp: '2d ago',
        title: 'Upcoming Workshop: Intro to Blockchain',
        content: 'Join us this Friday at 4 PM in the Engineering Building for a hands-on workshop on blockchain technology. No prior experience needed!',
        category: 'event',
        image: 'https://source.unsplash.com/random/800x400/?blockchain',
        likes: 32,
        comments: [],
        isPinned: true
      }
    ]);
  }, []);

  const filteredPosts = activeFilter === 'all' 
    ? posts 
    : posts.filter(post => post.category === activeFilter);

  const pinnedPosts = filteredPosts.filter(post => post.isPinned);
  const regularPosts = filteredPosts.filter(post => !post.isPinned);

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId ? { ...post, likes: post.likes + 1 } : post
    ));
  };

  const handleAddComment = (postId: string) => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: `comment-${Date.now()}`,
      user: 'Current User',
      avatar: 'CU',
      content: newComment,
      timestamp: 'Just now'
    };

    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, comments: [...post.comments, comment] } 
        : post
    ));
    
    setNewComment('');
  };

  const handleCreatePost = () => {
    const newPost: Post = {
      id: `post-${Date.now()}`,
      user: 'Current User',
      department: 'Your Department',
      year: 'Your Year',
      avatar: 'CU',
      timestamp: 'Just now',
      title: postContent.title || 'New Post',
      content: postContent.content,
      category: postContent.category,
      image: postContent.image,
      likes: 0,
      comments: []
    };

    setPosts([newPost, ...posts]);
    setPostContent({
      title: '',
      content: '',
      category: 'idea',
      image: ''
    });
    setIsModalOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostContent({...postContent, image: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  // Animation on scroll effect
  const postRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-4');
          }
        });
      },
      { threshold: 0.1 }
    );

    postRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => {
      postRefs.current.forEach(ref => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [filteredPosts]);

  return (
    <div className="py-8 px-4 md:px-8 bg-[#121212] min-h-screen">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-alata text-4xl font-bold text-white mb-2">Community</h1>
          <p className="text-gray-400">Where ideas, voices, and progress meet.</p>
        </div>

        {/* Create Post & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#1DB954] hover:bg-[#1DB954]/90 text-white font-medium rounded-lg px-6 py-2 transition-all duration-200 hover:scale-105"
          >
            + Create Post
          </Button>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-sm text-gray-400 mr-2">Filter:</span>
            <Select onValueChange={(value) => setActiveFilter(value)} value={activeFilter}>
              <SelectTrigger className="w-[180px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                <SelectItem value="all">All Posts</SelectItem>
                <SelectItem value="achievement">Achievements</SelectItem>
                <SelectItem value="idea">Ideas</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="opportunity">Opportunities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pinned Posts */}
        {pinnedPosts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 text-[#1DB954]">
              <Pin className="w-5 h-5" />
              <h2 className="font-alata text-xl font-semibold">Pinned Posts</h2>
            </div>
            <div className="space-y-6">
              {pinnedPosts.map((post) => (
                <PostCard 
                  key={post.id}
                  post={post}
                  isExpanded={expandedPost === post.id}
                  onExpand={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                  onLike={handleLike}
                  onComment={handleAddComment}
                  newComment={newComment}
                  setNewComment={setNewComment}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Posts */}
        <div className="space-y-6">
          {regularPosts.map((post, index) => (
            <div 
              key={post.id}
              ref={(el) => {
               postRefs.current[index] = el;
                                             }}

              className="opacity-0 translate-y-4 transition-all duration-500 ease-out"
            >
              <PostCard 
                post={post}
                isExpanded={expandedPost === post.id}
                onExpand={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                onLike={handleLike}
                onComment={handleAddComment}
                newComment={newComment}
                setNewComment={setNewComment}
              />
            </div>
          ))}
          
          {filteredPosts.length === 0 && (
            <div className="text-center py-12 bg-gray-900/50 rounded-xl">
              <p className="text-gray-400">No posts found. Be the first to share something!</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-alata">Create a Post</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title (optional)</label>
              <Input 
                placeholder="What's on your mind?"
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                value={postContent.title}
                onChange={(e) => setPostContent({...postContent, title: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Content</label>
              <Textarea 
                placeholder="Share your thoughts, ideas, or announcements..."
                className="min-h-[120px] bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                value={postContent.content}
                onChange={(e) => setPostContent({...postContent, content: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                <Select 
                  value={postContent.category}
                  onValueChange={(value: 'achievement' | 'idea' | 'event' | 'opportunity') => 
                    setPostContent({...postContent, category: value})}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 text-white">
                    <SelectItem value="idea">Idea 💡</SelectItem>
                    <SelectItem value="achievement">Achievement 🏆</SelectItem>
                    <SelectItem value="event">Event 📅</SelectItem>
                    <SelectItem value="opportunity">Opportunity 🔍</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Add Media</label>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-md cursor-pointer hover:bg-gray-700 transition-colors">
                      <ImageIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">Image</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                      />
                    </div>
                  </label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 gap-2 bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span className="text-sm">Link</span>
                  </Button>
                </div>
              </div>
            </div>
            
            {postContent.image && (
              <div className="relative">
                <img 
                  src={postContent.image} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button 
                  onClick={() => setPostContent({...postContent, image: ''})}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="bg-[#1DB954] hover:bg-[#1DB954]/90 text-white"
                onClick={handleCreatePost}
                disabled={!postContent.content.trim()}
              >
                Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Post Card Component
const PostCard = ({ 
  post, 
  isExpanded, 
  onExpand, 
  onLike, 
  onComment, 
  newComment, 
  setNewComment 
}: { 
  post: Post; 
  isExpanded: boolean; 
  onExpand: () => void; 
  onLike: (id: string) => void; 
  onComment: (id: string) => void;
  newComment: string;
  setNewComment: (value: string) => void;
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const handleLike = () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLocalLikes(prev => newLikedState ? prev + 1 : prev - 1);
    if (newLikedState) onLike(post.id);
  };

  const handleCommentClick = () => {
    onExpand();
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onComment(post.id);
    }
  };

  const getCategoryIcon = () => {
    switch (post.category) {
      case 'achievement': return '🏆';
      case 'idea': return '💡';
      case 'event': return '📅';
      case 'opportunity': return '🔍';
      default: return '📝';
    }
  };

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-[#1DB954]/30' : ''}`}>
      {/* Post Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg font-medium text-[#1DB954]">
              {post.avatar}
            </div>
            <div>
              <h3 className="font-medium text-white">{post.user}</h3>
              <p className="text-xs text-gray-400">
                {post.department} {post.year && `• ${post.year}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{post.timestamp}</span>
            <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded-full">
              {getCategoryIcon()} {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
            </span>
          </div>
        </div>

        {/* Post Content */}
        <div className="mt-4">
          {post.title && (
            <h4 className="font-semibold text-lg text-white mb-2">{post.title}</h4>
          )}
          <p className="text-gray-300 whitespace-pre-line">{post.content}</p>
          
          {post.image && (
            <div className="mt-4 rounded-lg overflow-hidden border border-gray-800">
              <img 
                src={post.image} 
                alt="Post content" 
                className="w-full max-h-96 object-cover"
              />
            </div>
          )}
          
          {post.link && (
            <a 
              href={post.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-sm text-[#1DB954] hover:underline"
            >
              <LinkIcon className="w-4 h-4 mr-1" />
              {new URL(post.link).hostname}
            </a>
          )}
        </div>

        {/* Post Actions */}
        <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
          <button 
            className={`flex items-center gap-1.5 text-sm ${isLiked ? 'text-[#1DB954]' : 'text-gray-400'} hover:text-[#1DB954] transition-colors`}
            onClick={handleLike}
          >
            <ThumbsUp className="w-4 h-4" />
            <span>{localLikes}</span>
          </button>
          
          <button 
            className={`flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors ${isExpanded ? 'text-white' : ''}`}
            onClick={handleCommentClick}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{post.comments.length} {post.comments.length === 1 ? 'Comment' : 'Comments'}</span>
          </button>
          
          <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {isExpanded && (
        <div className="bg-gray-950/50 border-t border-gray-800 p-4">
          <div className="space-y-4">
            {post.comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
                  {comment.avatar}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-800 rounded-2xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{comment.user}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-300">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <div className="flex-1">
                <Input
                  ref={commentInputRef}
                  type="text"
                  placeholder="Write a comment..."
                  className="w-full bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-full px-4"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
              </div>
              <Button 
                type="submit" 
                className="bg-[#1DB954] hover:bg-[#1DB954]/90 text-white rounded-full px-4"
                disabled={!newComment.trim()}
              >
                Post
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;
