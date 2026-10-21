import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Post } from '../types';

export default function PostCard({ post, onDelete }: { post: Post; onDelete?: (id: string) => void }) {
  const { isOwner } = useAuth();
  const [busy, setBusy] = useState(false);
  const when = new Date(post.publishedAt);
  const date = when.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const n = post.images.length;
  const layout = n >= 6 ? 'many' : String(n);

  async function handleDelete() {
    if (!confirm('Delete this post and its images?')) return;
    setBusy(true);
    try {
      await api.deletePost(post.id);
      onDelete?.(post.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="content">
      <h1>{post.title}</h1>
      <time className="date" dateTime={when.toISOString()}>{date}</time>
      {post.body
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      <div className="gallery" data-layout={layout}>
        {post.images.map((img) => (
          <a key={img.id} href={img.url} target="_blank" rel="noreferrer" title="Open full quality">
            <img
              src={img.thumbUrl}
              alt={post.title}
              width={img.width ?? undefined}
              height={img.height ?? undefined}
              loading="lazy"
            />
          </a>
        ))}
      </div>
      {isOwner && (
        <div className="admin-bar">
          <Link className="btn ghost" to={`/edit/${post.id}`}>Edit post</Link>
          <button type="button" className="btn danger" disabled={busy} onClick={handleDelete}>
            {busy ? 'Deleting…' : 'Delete post'}
          </button>
        </div>
      )}
    </article>
  );
}
