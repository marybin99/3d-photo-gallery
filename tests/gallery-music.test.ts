import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { audioFileFormat, createMusicRepository } from '../src/galleryMusic.ts';

const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const oldPath = `${userId}/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.mp3`;
const empty = { youtube_id: null, audio_tracks: [], version: 'current' };
const current = {
  ...empty,
  audio_tracks: [{ path: oldPath, title: '기존 배경음악' }],
};

function repository(conflict = false) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const client = createClient('https://music-test.supabase.co', 'test-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? 'GET';
        const body =
          typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        calls.push({ method, url, body });
        let response = {};
        let status = 200;
        if (method === 'PATCH') {
          response = conflict
            ? { code: 'PGRST116', message: 'No matching row' }
            : { ...empty, ...body, version: 'next' };
          if (conflict) status = 406;
        } else if (method === 'GET') response = empty;
        else if (method === 'DELETE') response = [];
        return new Response(JSON.stringify(response), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  return { api: createMusicRepository(client), calls };
}

test('a legacy YouTube link is kept in settings and does not become a playable track', async () => {
  const { api } = repository();
  assert.deepEqual(api.tracks(await api.read()), []);
  assert.deepEqual(api.tracks({ ...empty, youtube_id: 'M7lc1UVf-VE' }), []);
});

test('uploading multiple audio files appends them in order without replacing the existing song', async () => {
  const { api, calls } = repository();
  const files = [
    new File(['audio one'], 'Ambient.M4A', { type: 'audio/x-m4a' }),
    new File(['audio two'], 'Evening.ogg', { type: 'audio/ogg' }),
  ];
  assert.deepEqual(audioFileFormat(files[0]), {
    extension: 'm4a',
    contentType: 'audio/mp4',
  });
  assert.throws(() =>
    audioFileFormat({ name: 'song.wav', type: 'text/plain', size: 100 }),
  );
  assert.throws(() =>
    audioFileFormat({
      name: 'song.mp3',
      type: 'audio/mpeg',
      size: 21 * 1024 * 1024,
    }),
  );
  const settings = await api.append(current, files, userId);
  assert.deepEqual(
    api.tracks(settings).map((track) => track.title),
    ['기존 배경음악', 'Ambient', 'Evening'],
  );
  assert.match(
    api.tracks(settings)[1].source,
    /storage\/v1\/object\/public\/gallery-music\/.+\.m4a$/,
  );
  assert.deepEqual(
    calls.map((call) => call.method),
    ['POST', 'POST', 'PATCH'],
  );
  assert.equal(calls[2].url.searchParams.get('version'), 'eq.current');
});

test('a concurrent playlist change cleans only the newly uploaded audio files', async () => {
  const { api, calls } = repository(true);
  const file = new File(['audio'], 'Ambient.M4A', { type: 'audio/x-m4a' });
  await assert.rejects(
    () => api.append(current, [file], userId),
    /다시 불러온 뒤/,
  );
  assert.deepEqual(
    calls.map((call) => call.method),
    ['POST', 'PATCH', 'DELETE'],
  );
  const newPath = (calls[1].body as typeof current).audio_tracks[1].path;
  assert.deepEqual(calls[2].body, { prefixes: [newPath] });
});

test('deleting a track updates the list before deleting that audio file', async () => {
  const { api, calls } = repository();
  const { settings, warning } = await api.remove(current, oldPath);
  assert.deepEqual(api.tracks(settings), []);
  assert.equal(warning, '');
  assert.deepEqual(
    calls.map((call) => call.method),
    ['PATCH', 'DELETE'],
  );
  assert.deepEqual(calls[1].body, { prefixes: [oldPath] });
});
