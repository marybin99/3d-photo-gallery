import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMusicRepository } from './musicRepository';
import type { MusicTrack } from './types';

export function useMusicTracks(client: SupabaseClient | null) {
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  useEffect(() => {
    if (!client) return;
    const repository = createMusicRepository(client);
    let request = 0;
    const reload = () => {
      const current = ++request;
      void repository
        .read()
        .then((settings) => {
          if (request === current) setMusicTracks(repository.tracks(settings));
        })
        .catch(() => {});
    };
    reload();
    window.addEventListener('focus', reload);
    return () => {
      ++request;
      window.removeEventListener('focus', reload);
    };
  }, [client]);
  return musicTracks;
}
