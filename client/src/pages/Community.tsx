import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import {
  MessageSquare,
  Heart,
  Share2,
  Flag,
  Trash2,
  Plus,
  Search,
  Filter,
  Tag,
  Send,
  Sparkles,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  tags: string;
  attachment_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  author_id: string;
  author_student_id: string;
  author_username: string;
  author_name: string;
  author_avatar?: string;
  author_course?: string;
  has_liked: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_student_id: string;
  author_username: string;
  author_name: string;
  author_avatar?: string;
}

const COMMON_TAGS = ['All', 'ExamPrep', 'Engineering', 'Medical', 'Tips', 'Notes', 'Doubts', 'Coding'];

export const Community: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [sortBy, setSortBy] = useState<'recent' | 'top'>('recent');

  // New post modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [creating, setCreating] = useState(false);

  // Comments drawer / active post
  const [activePost, setActivePost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Report modal state
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Spam or inappropriate content');
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const tagQuery = selectedTag !== 'All' ? `&tag=${encodeURIComponent(selectedTag)}` : '';
      const searchQueryParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const data = await apiRequest<{ posts: CommunityPost[] }>(
        `/community/posts?sort=${sortBy}${tagQuery}${searchQueryParam}`
      );
      setPosts(data.posts || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load community discussions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [selectedTag, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPosts();
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Title and content are required.');
      return;
    }

    setCreating(true);
    try {
      const data = await apiRequest<{ post: CommunityPost }>('/community/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          tags: newTags.trim(),
          attachment_url: newAttachmentUrl.trim() || undefined,
        }),
      });
      setPosts((prev) => [data.post, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      setNewAttachmentUrl('');
      toast.success('Post shared to the community!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish post.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) {
      toast.info('Please log in to like posts.');
      return;
    }

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.has_liked;
          return {
            ...p,
            has_liked: nextLiked,
            likes_count: nextLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
          };
        }
        return p;
      })
    );

    try {
      const res = await apiRequest<{ has_liked: boolean; likes_count: number }>(`/community/posts/${postId}/like`, {
        method: 'POST',
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, has_liked: res.has_liked, likes_count: res.likes_count } : p))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update like.');
      fetchPosts();
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post permanently?')) return;

    try {
      await apiRequest(`/community/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (activePost?.id === postId) {
        setActivePost(null);
      }
      toast.info('Post deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete post.');
    }
  };

  const openComments = async (post: CommunityPost) => {
    setActivePost(post);
    setLoadingComments(true);
    try {
      const data = await apiRequest<{ comments: Comment[] }>(`/community/posts/${post.id}`);
      setComments(data.comments || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load comments.');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const data = await apiRequest<{ comment: Comment }>(`/community/posts/${activePost.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setComments((prev) => [...prev, data.comment]);
      setCommentText('');
      setPosts((prev) =>
        prev.map((p) => (p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p))
      );
      toast.success('Comment added.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await apiRequest(`/community/comments/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (activePost) {
        setPosts((prev) =>
          prev.map((p) => (p.id === activePost.id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
        );
      }
      toast.info('Comment removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove comment.');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPostId) return;

    setSubmittingReport(true);
    try {
      await apiRequest(`/community/posts/${reportingPostId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason }),
      });
      toast.success('Thank you. Post flagged for moderation review.');
      setReportingPostId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Feed Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '24px',
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.card,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge">Public Community</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.warmStone }}>
              Peer-to-Peer Academic Commons
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Student Discussions & Guides
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone, marginTop: '2px' }}>
            Ask questions, share summaries, post exam advice, and collaborate openly with verified learners.
          </p>
        </div>

        <Button
          variant="primary"
          shape="pill"
          onClick={() => setShowCreateModal(true)}
          leftIcon={<Plus size={16} color={THEME.warmIvory} />}
        >
          Create Post
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 300px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search posts, topics, or authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: THEME.radius.pill,
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
                fontSize: '13px',
                color: THEME.deepForestCharcoal,
              }}
            />
            <Search
              size={15}
              color={THEME.warmStone}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" shape="pill">
            Search
          </Button>
        </form>

        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.warmStone }}>SORT BY:</span>
          <button
            type="button"
            onClick={() => setSortBy('recent')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: THEME.radius.pill,
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              backgroundColor: sortBy === 'recent' ? THEME.deepForestCharcoal : THEME.warmIvory,
              color: sortBy === 'recent' ? THEME.warmIvory : THEME.deepForestCharcoal,
              cursor: 'pointer',
            }}
          >
            Latest
          </button>
          <button
            type="button"
            onClick={() => setSortBy('top')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: THEME.radius.pill,
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              backgroundColor: sortBy === 'top' ? THEME.deepForestCharcoal : THEME.warmIvory,
              color: sortBy === 'top' ? THEME.warmIvory : THEME.deepForestCharcoal,
              cursor: 'pointer',
            }}
          >
            Most Liked
          </button>
        </div>
      </div>

      {/* Tag Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {COMMON_TAGS.map((tag) => {
          const active = selectedTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '5px 14px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: THEME.radius.pill,
                border: `1.5px solid ${active ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                backgroundColor: active ? THEME.emeraldGreen : THEME.warmIvory,
                color: active ? THEME.warmIvory : THEME.deepForestCharcoal,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: `all ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
              }}
            >
              {tag === 'All' ? 'All Topics' : `#${tag}`}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Feed + Comments Drawer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: activePost ? '1.5fr 1fr' : '1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Posts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="160px" borderRadius={THEME.radius.card} />
            ))
          ) : posts.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={36} color={THEME.emeraldGreen} />}
              title="No discussions found"
              description="Be the first student to start a discussion or question in this topic!"
              action={
                <Button
                  variant="primary"
                  shape="pill"
                  onClick={() => setShowCreateModal(true)}
                  leftIcon={<Plus size={14} color={THEME.warmIvory} />}
                >
                  Create Discussion
                </Button>
              }
            />
          ) : (
            posts.map((post) => {
              const isAuthor = user?.id === post.author_id;
              const isSelected = activePost?.id === post.id;
              return (
                <div
                  key={post.id}
                  className="card"
                  style={{
                    padding: '20px',
                    backgroundColor: THEME.warmIvory,
                    border: `1.5px solid ${isSelected ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                    borderRadius: THEME.radius.card,
                    boxShadow: isSelected ? THEME.shadow.lifted : THEME.shadow.card,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                  }}
                >
                  {/* Author Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: THEME.radius.full,
                          backgroundColor: THEME.emeraldGreen,
                          color: THEME.warmIvory,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '15px',
                          border: `1.5px solid ${THEME.deepForestCharcoal}`,
                        }}
                      >
                        {post.author_name ? post.author_name[0].toUpperCase() : 'S'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                            {post.author_name}
                          </span>
                          <span style={{ fontSize: '12px', color: THEME.warmStone }}>
                            @{post.author_username}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: THEME.deepForestCharcoal,
                              backgroundColor: THEME.warmIvory,
                              border: `1px solid ${THEME.warmStone}`,
                              padding: '1px 6px',
                              borderRadius: THEME.radius.sharp,
                            }}
                          >
                            {post.author_student_id}
                          </span>
                          {post.author_course && (
                            <span style={{ fontSize: '11px', color: THEME.warmStone }}>
                              • {post.author_course}
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: THEME.warmStone }}>
                            • {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Post Options */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isAuthor ? (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: THEME.vermilion,
                            padding: '4px',
                          }}
                          title="Delete your post"
                        >
                          <Trash2 size={15} color={THEME.vermilion} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReportingPostId(post.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: THEME.warmStone,
                            padding: '4px',
                          }}
                          title="Report post"
                        >
                          <Flag size={14} color={THEME.warmStone} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
                  <div>
                    <h2 style={{ fontSize: '17px', fontWeight: 800, color: THEME.deepForestCharcoal, marginBottom: '6px' }}>
                      {post.title}
                    </h2>
                    <p style={{ fontSize: '14px', color: THEME.deepForestCharcoal, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {post.content}
                    </p>
                  </div>

                  {/* Attachment link if present */}
                  {post.attachment_url && (
                    <a
                      href={post.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: THEME.emeraldGreen,
                        textDecoration: 'underline',
                      }}
                    >
                      <ExternalLink size={13} color={THEME.emeraldGreen} />
                      <span>Attached Resource Reference</span>
                    </a>
                  )}

                  {/* Tags */}
                  {post.tags && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {post.tags.split(',').map((t, i) => {
                        const cleanT = t.trim().replace(/^#/, '');
                        if (!cleanT) return null;
                        return (
                          <span
                            key={i}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: THEME.deepForestCharcoal,
                              backgroundColor: THEME.warmIvory,
                              border: `1px solid ${THEME.deepForestCharcoal}`,
                              padding: '2px 8px',
                              borderRadius: THEME.radius.pill,
                            }}
                          >
                            #{cleanT}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Interaction Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      paddingTop: '8px',
                      borderTop: `1px solid ${THEME.warmStone}`,
                      opacity: 0.9,
                    }}
                  >
                    {/* Like button */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: post.has_liked ? THEME.vermilion : THEME.deepForestCharcoal,
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      <Heart
                        size={16}
                        color={post.has_liked ? THEME.vermilion : THEME.deepForestCharcoal}
                        fill={post.has_liked ? THEME.vermilion : 'none'}
                      />
                      <span>{post.likes_count}</span>
                    </button>

                    {/* Comments button */}
                    <button
                      type="button"
                      onClick={() => openComments(post)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: isSelected ? THEME.emeraldGreen : THEME.deepForestCharcoal,
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      <MessageCircle size={16} color={isSelected ? THEME.emeraldGreen : THEME.deepForestCharcoal} />
                      <span>{post.comments_count} Comments</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Comments Side Drawer */}
        {activePost && (
          <div
            className="card"
            style={{
              padding: '20px',
              backgroundColor: THEME.warmIvory,
              border: `2px solid ${THEME.deepForestCharcoal}`,
              borderRadius: THEME.radius.card,
              boxShadow: THEME.shadow.lifted,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  Discussion Replies
                </h3>
                <span style={{ fontSize: '12px', color: THEME.warmStone }}>
                  Re: {activePost.title.length > 30 ? activePost.title.substring(0, 30) + '...' : activePost.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActivePost(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: THEME.warmStone,
                }}
              >
                Close
              </button>
            </div>

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {loadingComments ? (
                <Skeleton height="80px" borderRadius={THEME.radius.sm} />
              ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 10px', color: THEME.warmStone, fontSize: '13px' }}>
                  No replies yet. Join the conversation below!
                </div>
              ) : (
                comments.map((comment) => {
                  const isCommentAuthor = user?.id === comment.author_id;
                  return (
                    <div
                      key={comment.id}
                      style={{
                        padding: '12px',
                        backgroundColor: THEME.warmIvory,
                        border: `1px solid ${THEME.deepForestCharcoal}`,
                        borderRadius: THEME.radius.sm,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                            {comment.author_name}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: THEME.deepForestCharcoal,
                              border: `1px solid ${THEME.warmStone}`,
                              padding: '0 4px',
                              borderRadius: THEME.radius.sharp,
                            }}
                          >
                            {comment.author_student_id}
                          </span>
                        </div>
                        {isCommentAuthor && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.vermilion }}
                            title="Delete comment"
                          >
                            <Trash2 size={12} color={THEME.vermilion} />
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: THEME.deepForestCharcoal, margin: 0, lineHeight: 1.4 }}>
                        {comment.content}
                      </p>
                      <span style={{ fontSize: '10px', color: THEME.warmStone }}>
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                placeholder="Write a constructive student reply..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: THEME.radius.control,
                  border: `1.5px solid ${THEME.deepForestCharcoal}`,
                  backgroundColor: THEME.warmIvory,
                  fontSize: '13px',
                  color: THEME.deepForestCharcoal,
                  resize: 'none',
                }}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                shape="pill"
                loading={submittingComment}
                disabled={!commentText.trim()}
                leftIcon={<Send size={13} color={THEME.warmIvory} />}
                style={{ alignSelf: 'flex-end' }}
              >
                Reply
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Start Community Discussion">
        <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              Discussion Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Tips for mastering Dynamic Programming or Pathology Revision"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              Topic Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Engineering, Algorithms, ExamPrep"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              Resource Reference URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={newAttachmentUrl}
              onChange={(e) => setNewAttachmentUrl(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              Discussion Content *
            </label>
            <textarea
              placeholder="Share your question, study notes summary, or advice in detail..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={6}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: THEME.radius.control,
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
                fontSize: '13px',
                color: THEME.deepForestCharcoal,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="secondary" shape="pill" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" shape="pill" loading={creating}>
              Publish Post
            </Button>
          </div>
        </form>
      </Modal>

      {/* Report Post Modal */}
      <Modal isOpen={!!reportingPostId} onClose={() => setReportingPostId(null)} title="Report Post for Review">
        <form onSubmit={handleSubmitReport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Help keep StudySync a safe and supportive learning environment for all students.
          </p>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              Reason for Report *
            </label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: THEME.radius.control,
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
                fontSize: '13px',
                color: THEME.deepForestCharcoal,
              }}
            >
              <option value="Spam or promotional content">Spam or promotional content</option>
              <option value="Harassment or abusive language">Harassment or abusive language</option>
              <option value="Misleading or incorrect academic information">Misleading or incorrect academic information</option>
              <option value="Academic dishonesty / exam leak">Academic dishonesty / exam leak</option>
              <option value="Other concern">Other concern</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="secondary" shape="pill" onClick={() => setReportingPostId(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" shape="pill" loading={submittingReport}>
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Community;
