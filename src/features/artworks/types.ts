export type Artwork = {
  id: string;
  title: string;
  description: string;
  image: string;
  youtubeId?: string;
  frameColor?: string;
  position: [number, number, number];
  rotation: number;
  zone: string;
  wall: 'front' | 'left' | 'right';
};

export type ArtworkRecord = {
  id: string;
  slot_id: string;
  title: string;
  description: string;
  image_path: string | null;
  youtube_url?: string | null;
  frame_color?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type ArtworkDraft = {
  youtube_url?: string;
  frame_color?: string;
  slot_id: string;
  title: string;
  description: string;
  is_published: boolean;
};
