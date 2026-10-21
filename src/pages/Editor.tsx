import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { PostImage } from '../types';

const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
const toLocalInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, isOwner } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishedAt, setPublishedAt] = useState(() => toLocalInput(Date.now()));
  const [existing, setExisting] = useState<PostImage[]>([]);
  const [removed, setRemoved] = useState<PostImage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [createdId, setCreatedId] = useState<string>();
  const [ready, setReady] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !isOwner) return;
    api
      .post(id)
      .then((p) => {
        setTitle(p.title);
        setBody(p.body);
        setPublishedAt(toLocalInput(p.publishedAt));
        setExisting(p.images);
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
  }, [id, isOwner]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  if (loading) return <p className="notice">Loading…</p>;
  if (!isOwner) return <Navigate to="/login" replace />;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // If an earlier attempt created the post but an upload failed, keep updating that same post.
      const targetId = id ?? createdId;
      const input = { title, body, publishedAt: publishedAt ? new Date(publishedAt).getTime() : undefined };
      const post = targetId ? await api.updatePost(targetId, input) : await api.createPost(input);
      setCreatedId(post.id);

      for (const file of [...files]) {
        await api.uploadImage(post.id, file, (p) => setProgress((prev) => ({ ...prev, [fileKey(file)]: p })));
        setFiles((cur) => cur.filter((f) => f !== file));
      }
      await Promise.all(removed.map((r) => api.deleteImage(r.id)));
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this post and its images?')) return;
    setBusy(true);
    try {
      await api.deletePost(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (!ready) return <p className={error ? 'error' : 'notice'}>{error || 'Loading post…'}</p>;

  return (
    <form className="content editor" onSubmit={save}>
      <h1>{id ? 'Edit post' : 'New post'}</h1>

      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </label>

      <label>
        Date and time
        <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} required />
        <small>The feed is sorted by this. Set it to when you took the photo, or leave it as now.</small>
      </label>

      <label>
        Story
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        <small>Leave a blank line between paragraphs.</small>
      </label>

      {existing.length > 0 && (
        <div className="thumbs">
          {existing.map((img) => (
            <figure key={img.id}>
              <img src={img.thumbUrl} alt={img.name} />
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  setExisting(existing.filter((i) => i.id !== img.id));
                  setRemoved([...removed, img]);
                }}
              >
                Remove
              </button>
            </figure>
          ))}
        </div>
      )}

      <label>
        Add images (uploaded at original quality, JPEG, PNG, WebP or AVIF, max 100 MB each)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={busy}
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <div className="thumbs">
          {files.map((f, i) => (
            <figure key={fileKey(f)}>
              <img src={previews[i]} alt={f.name} />
              {busy ? (
                <progress value={progress[fileKey(f)] ?? 0} max={1} />
              ) : (
                <button type="button" className="btn ghost" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish post'}</button>
        <Link className="btn ghost" to="/">Cancel</Link>
        {id && (
          <button type="button" className="btn danger" disabled={busy} onClick={remove}>
            Delete post
          </button>
        )}
      </div>
    </form>
  );
}
