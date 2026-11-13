import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ARTWORK_BUCKET,
  ARTWORK_COLUMNS,
  SIGNED_URL_SECONDS,
  validateDraft,
  type ArtworkDraft,
  type ArtworkRecord,
} from './artworkModel.ts';

function databaseError(error: { code?: string; message: string }): Error {
  if (error.code === '23505')
    return new Error(
      '다른 작품이 이미 이 위치를 사용하고 있습니다. 목록을 새로고침해 주세요.',
    );
  if (error.code === '42501')
    return new Error(
      '운영자 권한이 없거나 세션이 만료되었습니다. 다시 로그인해 주세요.',
    );
  if (error.code === 'PGRST116')
    return new Error(
      '다른 곳에서 작품이 수정되거나 삭제되었습니다. 목록을 새로고침해 주세요.',
    );
  return new Error(
    '작품 정보를 저장하거나 불러오지 못했습니다. 연결 상태와 Supabase 초기 설정을 확인해 주세요.',
  );
}
export function createArtworkRepository(client: SupabaseClient) {
  const bucket = client.storage.from(ARTWORK_BUCKET);
  const removeImage = async (path: string) => {
    const warning =
      '작품 정보는 반영됐지만 이전 사진 파일 정리에 실패했습니다. Storage에서 사용하지 않는 파일을 확인해 주세요.';
    try {
      const { error } = await bucket.remove([path]);
      return error ? warning : '';
    } catch {
      return warning;
    }
  };
  return {
    async list(publishedOnly: boolean): Promise<ArtworkRecord[]> {
      let query = client
        .from('artworks')
        .select(ARTWORK_COLUMNS)
        .order('slot_id');
      if (publishedOnly) query = query.eq('is_published', true);
      const { data, error } = await query;
      if (error) throw databaseError(error);
      return data ?? [];
    },
    async imageUrls(records: ArtworkRecord[]): Promise<Map<string, string>> {
      if (!records.length) return new Map();
      const { data, error } = await bucket.createSignedUrls(
        records.map((row) => row.image_path),
        SIGNED_URL_SECONDS,
      );
      if (error || !data)
        throw new Error(
          '작품 이미지를 불러오지 못했습니다. 사진 접근 권한을 확인해 주세요.',
        );
      const urls = new Map<string, string>();
      for (const item of data) {
        if (item.error || !item.signedUrl || !item.path)
          throw new Error(
            '일부 사진을 불러오지 못했습니다. Storage 파일을 확인해 주세요.',
          );
        urls.set(item.path, item.signedUrl);
      }
      return urls;
    },
    async save(
      userId: string,
      draft: ArtworkDraft,
      current: ArtworkRecord | null,
      image: Blob | null,
    ) {
      const values = validateDraft(draft);
      if (!current && !image) throw new Error('등록할 사진을 선택해 주세요.');
      let uploaded: string | null = null;
      if (image) {
        const extension = {
          'image/webp': 'webp',
          'image/jpeg': 'jpg',
          'image/png': 'png',
        }[image.type];
        if (!extension) throw new Error('지원하지 않는 이미지 형식입니다.');
        uploaded = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await bucket.upload(uploaded, image, {
          contentType: image.type,
          cacheControl: '3600',
          upsert: false,
        });
        if (error)
          throw new Error(
            '사진 업로드에 실패했습니다. 로그인 상태와 Storage 권한을 확인해 주세요.',
          );
      }
      const payload = {
        ...values,
        image_path: uploaded ?? current!.image_path,
      };
      try {
        const query = current
          ? client
              .from('artworks')
              .update(payload)
              .eq('id', current.id)
              .eq('updated_at', current.updated_at)
          : client.from('artworks').insert(payload);
        const { data, error } = await query.select(ARTWORK_COLUMNS).single();
        if (error) throw databaseError(error);
        if (!data)
          throw new Error(
            '다른 곳에서 작품이 수정되었습니다. 목록을 새로고침해 주세요.',
          );
        const warning =
          uploaded && current ? await removeImage(current.image_path) : '';
        return { record: data as ArtworkRecord, warning };
      } catch (error) {
        if (uploaded) {
          try {
            await removeImage(uploaded);
          } catch {
            /* A failed cleanup never hides the save error. */
          }
        }
        throw error;
      }
    },
    async delete(record: ArtworkRecord) {
      const { data, error } = await client
        .from('artworks')
        .delete()
        .eq('id', record.id)
        .eq('updated_at', record.updated_at)
        .select('id')
        .single();
      if (error) throw databaseError(error);
      if (!data)
        throw new Error(
          '다른 곳에서 작품이 수정되었습니다. 목록을 새로고침해 주세요.',
        );
      return { warning: await removeImage(record.image_path) };
    },
  };
}
