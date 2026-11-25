type AudioTrack = { path: string; title: string };

export type MusicSettings = {
  youtube_id: string | null;
  audio_tracks: AudioTrack[];
  version: string;
};

export type MusicTrack = AudioTrack & { source: string };
