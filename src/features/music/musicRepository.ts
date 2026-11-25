import type { SupabaseClient } from '@supabase/supabase-js';
import type { MusicSettings, MusicTrack } from './types.ts';

const MUSIC_BUCKET = 'gallery-music';
const MUSIC_COLUMNS = 'youtube_id,audio_tracks,version';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const AUDIO_TYPES = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'video/mp4'],
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'],
  ogg: ['audio/ogg', 'application/ogg', 'audio/vorbis'],
};


export function audioFileFormat(file: Pick<File, 'name' | 'type' | 'size'>) {
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() ?? '';
  const mimeTypes = Object.hasOwn(AUDIO_TYPES, extension)
    ? AUDIO_TYPES[extension as keyof typeof AUDIO_TYPES]
    : undefined;
  if (
    !mimeTypes ||
    (file.type &&
      file.type !== 'application/octet-stream' &&
      !mimeTypes.includes(file.type))
  ) {
    throw new Error('MP3, M4A, WAV, OGG 음원만 등록할 수 있습니다.');
  }
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES)
    throw new Error('음원 파일은 20MB 이하로 선택해 주세요.');
  return { extension, contentType: mimeTypes[0] };
}

export function createMusicRepository(client: SupabaseClient) {
  const bucket = client.storage.from(MUSIC_BUCKET);
  const removeUnused = async (paths: string[]) => {
    if (!paths.length) return true;
    try {
      const { error } = await bucket.remove(paths);
      return !error;
    } catch {
      return false;
    }
  };
  async function save(
    current: MusicSettings,
    changes: Partial<Omit<MusicSettings, 'version'>>,
  ) {
    const { data, error } = await client
      .from('gallery_music')
      .update(changes)
      .eq('id', true)
      .eq('version', current.version)
      .select(MUSIC_COLUMNS)
      .single();
    if (error?.code === 'PGRST116')
      throw new Error(
        '설정이 변경되었거나 저장 권한이 없습니다. 다시 불러온 뒤 확인해 주세요.',
      );
    if (error || !data)
      throw new Error(
        '배경음악을 저장하지 못했습니다. 연결 상태와 관리자 권한을 확인해 주세요.',
      );
    return data as MusicSettings;
  }
  return {
    async read(): Promise<MusicSettings> {
      const { data, error } = await client
        .from('gallery_music')
        .select(MUSIC_COLUMNS)
        .eq('id', true)
        .single();
      if (error || !data)
        throw new Error(
          '배경음악 설정을 불러오지 못했습니다. Supabase 연결과 배경음악 설정 SQL을 확인해 주세요.',
        );
      return data as MusicSettings;
    },
    tracks(settings: MusicSettings): MusicTrack[] {
      return settings.audio_tracks.map((track) => ({
        ...track,
        source: bucket.getPublicUrl(track.path).data.publicUrl,
      }));
    },
    async append(current: MusicSettings, files: File[], userId: string) {
      if (!files.length) throw new Error('등록할 음원 파일을 선택해 주세요.');
      const pending = files.map((file) => {
        const { extension, contentType } = audioFileFormat(file);
        const baseName = file.name.slice(0, -(extension.length + 1)).trim();
        return {
          file,
          contentType,
          track: {
            path: `${userId}/${crypto.randomUUID()}.${extension}`,
            title: Array.from(baseName).slice(0, 160).join('') || file.name,
          },
        };
      });
      const uploaded: string[] = [];
      try {
        for (const { file, contentType, track } of pending) {
          uploaded.push(track.path);
          const { error } = await bucket.upload(track.path, file, {
            contentType,
            upsert: false,
          });
          if (error)
            throw new Error(
              '음원을 올리지 못했습니다. 파일과 저장소 권한을 확인해 주세요.',
            );
        }
        return await save(current, {
          audio_tracks: [
            ...current.audio_tracks,
            ...pending.map((item) => item.track),
          ],
        });
      } catch (error) {
        await removeUnused(uploaded);
        throw error;
      }
    },
    async remove(current: MusicSettings, path: string) {
      const audio_tracks = current.audio_tracks.filter(
        (track) => track.path !== path,
      );
      if (audio_tracks.length === current.audio_tracks.length)
        throw new Error('재생 목록에서 음원을 찾을 수 없습니다.');
      const settings = await save(current, { audio_tracks });
      const warning = (await removeUnused([path]))
        ? ''
        : '목록에서 삭제했지만 음원 파일을 정리하지 못했습니다.';
      return { settings, warning };
    },
    removeYoutubeLink(current: MusicSettings) {
      return save(current, { youtube_id: null });
    },
  };
}
