import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Post } from '../types';

export default function PostCard({ post }: { post: Post }) {
  const { isOwner } = useAuth();
  const when = new Date(post.publishedAt);
  const date = when.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const n = post.images.length;
  const layout = n >= 6 ? 'many' : String(n);

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
      {isOwner && <Link className="btn ghost" to={`/edit/${post.id}`}>Edit post</Link>}
    </article>
  );
}
