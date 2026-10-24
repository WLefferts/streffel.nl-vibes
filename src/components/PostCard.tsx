import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Post } from '../types';

function renderBody(body: string) {
  return body
    .split(/\n\s*\n/)
    .filter((block) => block.trim())
    .flatMap((block, blockIndex) => {
      const chunks: { type: 'text' | 'list'; lines: string[] }[] = [];

      for (const line of block.split('\n')) {
        const bullet = line.match(/^\s*[-*+]\s+(.+?)\s*$/);
        const type = bullet ? 'list' : 'text';
        const lastChunk = chunks[chunks.length - 1];

        if (!lastChunk || lastChunk.type !== type) {
          chunks.push({ type, lines: [] });
        }
        chunks[chunks.length - 1].lines.push(bullet ? bullet[1] : line);
      }

      return chunks.map((chunk, chunkIndex) => {
        const key = `${blockIndex}-${chunkIndex}`;
        return chunk.type === 'list' ? (
          <ul key={key}>
            {chunk.lines.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
          </ul>
        ) : (
          <p key={key}>{chunk.lines.join('\n')}</p>
        );
      });
    });
}

export default function PostCard({ post, onDelete }: { post: Post; onDelete?: (id: string) => void }) {
  const { isOwner } = useAuth();
  const [busy, setBusy] = useState(false);
  const when = new Date(post.publishedAt);
  const date = when.toLocaleDateString('en-GB', { dateStyle: 'long' });

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
      {renderBody(post.body)}
      <div className="gallery">
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
