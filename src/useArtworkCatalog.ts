import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { artworks } from './data';
import { supabase } from './supabase';
import { createArtworkRepository } from './artworkRepository';
import { recordToArtwork } from './artworkModel';

export function useArtworkCatalog() {
  const repository = useMemo(
    () => (supabase ? createArtworkRepository(supabase) : null),
    [],
  );
  const [items, setItems] = useState<typeof artworks>(
    repository ? [] : artworks,
  );
  const [loading, setLoading] = useState(!!repository);
  const [error, setError] = useState('');
  const request = useRef(0);
  const reload = useCallback(async () => {
    if (!repository) return;
    const current = ++request.current;
    setLoading(true);
    setError('');
    try {
      const records = await repository.list(true);
      const urls = await repository.imageUrls(records);
      const next = records.map((record) => {
        const url = urls.get(record.image_path);
        if (!url) throw new Error('사진 주소를 불러오지 못했습니다.');
        return recordToArtwork(record, url);
      });
      if (current === request.current) setItems(next);
    } catch {
      if (current === request.current)
        setError(
          '전시 작품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    void reload();
    // Refresh signed URLs before their one-hour expiry, including suspended tabs.
    const refresh = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const timer = window.setInterval(() => void reload(), 50 * 60 * 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      ++request.current;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload]);
  return { items, loading, error, reload, demo: !repository };
}
