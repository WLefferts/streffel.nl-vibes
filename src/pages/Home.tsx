import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Post } from '../types';
import PostCard from '../components/PostCard';

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.posts().then(setPosts).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">Could not load posts: {error}</p>;
  if (!posts) return <p className="notice">Loading posts…</p>;
  if (posts.length === 0) return <p className="notice">No posts yet.</p>;

  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </>
  );
}
