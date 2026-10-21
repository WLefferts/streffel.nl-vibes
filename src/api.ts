import type { Post, PostImage } from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export interface PostInput {
  title: string;
  body: string;
  publishedAt?: number;
}

export const api = {
  me: () => req<{ owner: boolean }>('/api/me'),
  login: (password: string) => req<{ ok: true }>('/api/login', json('POST', { password })),
  logout: () => req<{ ok: true }>('/api/logout', { method: 'POST' }),

  posts: () => req<Post[]>('/api/posts'),
  post: (id: string) => req<Post>(`/api/posts/${id}`),
  createPost: (input: PostInput) => req<Post>('/api/posts', json('POST', input)),
  updatePost: (id: string, input: PostInput) => req<Post>(`/api/posts/${id}`, json('PUT', input)),
  deletePost: (id: string) => req<{ ok: true }>(`/api/posts/${id}`, { method: 'DELETE' }),
  deleteImage: (id: string) => req<{ ok: true }>(`/api/images/${id}`, { method: 'DELETE' }),

  /** Sends the original file as the raw request body (XHR, because fetch has no upload progress). */
  uploadImage(postId: string, file: File, onProgress: (fraction: number) => void): Promise<PostImage> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/posts/${postId}/images?name=${encodeURIComponent(file.name)}`);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onerror = () => reject(new Error(`Upload of ${file.name} failed (network error)`));
      xhr.onload = () => {
        let data: { error?: string } = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* not JSON, e.g. proxy error page */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data as PostImage);
        else reject(new Error(data.error ?? `Upload of ${file.name} failed (${xhr.status})`));
      };
      xhr.send(file);
    });
  },
};
