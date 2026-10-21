export interface PostImage {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  bytes: number;
  url: string; // original, full quality
  thumbUrl: string; // 1600px WebP used in the feed
}

export interface Post {
  id: string;
  title: string;
  body: string;
  images: PostImage[];
  publishedAt: number;
  createdAt: number;
  updatedAt: number;
}
