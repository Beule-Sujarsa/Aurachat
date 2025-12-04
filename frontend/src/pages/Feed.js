import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const Feed = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await api.get('/posts');
      setPosts(response.data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setIsPosting(true);
    try {
      const response = await api.post('/posts', {
        content: newPost
      });
      
      setPosts([response.data.post, ...posts]);
      setNewPost('');
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await api.post(`/posts/${postId}/like`);
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, is_liked: response.data.is_liked }
          : post
      ));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="feed-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px'
      }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="feed-page" style={{
      minHeight: 'calc(100vh - var(--navbar-height))',
      padding: '2rem 0',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div className="container" style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Create Post */}
        <div className="card mb-4">
          <form onSubmit={handleCreatePost}>
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                rows="3"
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontSize: '1rem'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {newPost.length}/280 characters
              </div>
              <button
                type="submit"
                disabled={!newPost.trim() || isPosting || newPost.length > 280}
                className="btn btn-primary"
                style={{ 
                  opacity: (!newPost.trim() || newPost.length > 280) ? 0.5 : 1 
                }}
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>

        {/* Posts Feed */}
        {posts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              No posts yet
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Follow some users to see their posts in your feed, or create your first post!
            </p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="card mb-4">
                {/* Post Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    marginRight: '0.75rem',
                    backgroundImage: post.author?.profile_pic && post.author.profile_pic !== 'default.jpg' 
                      ? `url(${post.author.profile_pic})` 
                      : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}>
                    {(!post.author?.profile_pic || post.author.profile_pic === 'default.jpg') 
                      && (post.author?.username?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {post.author?.username || 'Unknown User'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {formatDate(post.created_at)}
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div style={{
                  marginBottom: '1rem',
                  lineHeight: '1.5',
                  color: 'var(--text-primary)'
                }}>
                  {post.content}
                </div>

                {/* Post Image */}
                {post.image_url && (
                  <div style={{ marginBottom: '1rem' }}>
                    <img
                      src={post.image_url}
                      alt="Post content"
                      style={{
                        width: '100%',
                        borderRadius: 'var(--border-radius)',
                        maxHeight: '400px',
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                )}

                {/* Post Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => handleLike(post.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      color: post.is_liked ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontSize: '0.875rem'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>
                      {post.is_liked ? '❤️' : '🤍'}
                    </span>
                    {post.likes_count} {post.likes_count === 1 ? 'like' : 'likes'}
                  </button>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>💬</span>
                    {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;