import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createArtworkRepository } from '../src/artworkRepository.ts';
import {
  firstAvailableSlot,
  imageSize,
  recordToArtwork,
  slotLabel,
  validateDraft,
  validateImageFile,
  type ArtworkRecord,
} from '../src/artworkModel.ts';
import { artworks } from '../src/data.ts';

const user = '11111111-1111-4111-8111-111111111111';
const oldPath = `${user}/22222222-2222-4222-8222-222222222222.webp`;
const existing: ArtworkRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  slot_id: '01',
  title: '빛',
  description: '사진 설명',
  image_path: oldPath,
  is_published: true,
  created_at: '2026-11-13T00:00:00Z',
  updated_at: '2026-11-13T00:00:00Z',
};
const draft = {
  slot_id: '01',
  title: ' 새로운 빛 ',
  description: ' 이야기 ',
  is_published: false,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
type RequestInfo = { url: URL; method: string; body: string };
function repository(
  respond: (request: RequestInfo) => Response | Promise<Response>,
) {
  const calls: RequestInfo[] = [];
  const client = createClient(
    'https://gallery-test.supabase.co',
    'test-publishable-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          const request = {
            url: new URL(String(input)),
            method: init?.method ?? 'GET',
            body: typeof init?.body === 'string' ? init.body : '',
          };
          calls.push(request);
          return respond(request);
        },
      },
    },
  );
  return { api: createArtworkRepository(client), calls };
}

test('metadata and image validation rejects invalid slots, empty titles and unsafe formats', () => {
  assert.equal(validateDraft(draft).title, '새로운 빛');
  assert.throws(() => validateDraft({ ...draft, slot_id: '99' }));
  assert.throws(() => validateDraft({ ...draft, title: '  ' }));
  assert.throws(() =>
    validateDraft({ ...draft, description: '가'.repeat(2001) }),
  );
  assert.throws(() => validateImageFile({ type: 'image/svg+xml', size: 100 }));
  assert.throws(() =>
    validateImageFile({ type: 'image/jpeg', size: 11 * 1024 * 1024 }),
  );
  assert.throws(() => validateImageFile({ type: 'image/png', size: 0 }));
  validateImageFile({ type: 'image/webp', size: 100 });
  assert.deepEqual(imageSize(4000, 2000), { width: 1920, height: 960 });
  assert.deepEqual(imageSize(1000, 2000), { width: 960, height: 1920 });
  assert.deepEqual(imageSize(400, 300), { width: 400, height: 300 });
});

test('database works reuse validated scene slots instead of arbitrary coordinates', () => {
  const rendered = recordToArtwork(
    existing,
    'https://example.test/signed-photo.webp',
  );
  assert.deepEqual(rendered.position, artworks[0].position);
  assert.equal(rendered.title, '빛');
  assert.equal(rendered.image, 'https://example.test/signed-photo.webp');
  assert.match(slotLabel('01'), /A 전시실.*정면/);
  assert.throws(() =>
    recordToArtwork({ ...existing, slot_id: '999' }, 'image'),
  );
});

test('public catalogue explicitly requests only published works and signs their private images', async () => {
  const { api, calls } = repository((request) =>
    request.url.pathname.includes('/object/sign/')
      ? json([
          {
            path: oldPath,
            signedURL: `/object/sign/gallery-artworks/${oldPath}?token=test`,
          },
        ])
      : json([existing]),
  );
  const rows = await api.list(true);
  assert.equal(calls[0].url.searchParams.get('is_published'), 'eq.true');
  const urls = await api.imageUrls(rows);
  assert.match(urls.get(oldPath)!, /token=test/);
  assert.equal(JSON.parse(calls[1].body).expiresIn, 3600);
});

test('new upload followed by a failed DB insert cleans up only the new image', async () => {
  const { api, calls } = repository((request) => {
    if (request.url.pathname.startsWith('/rest/'))
      return json({ code: '23505', message: 'duplicate slot' }, 409);
    return json(request.method === 'DELETE' ? [] : { Key: 'new-file' });
  });
  await assert.rejects(
    () =>
      api.save(user, draft, null, new Blob(['photo'], { type: 'image/webp' })),
    /이미 이 위치/,
  );
  assert.equal(calls.length, 3);
  assert.match(calls[0].url.pathname, new RegExp(`/gallery-artworks/${user}/`));
  assert.equal(calls[1].method, 'POST');
  const removed = JSON.parse(calls[2].body).prefixes;
  assert.equal(removed.length, 1);
  assert.notEqual(removed[0], oldPath);
});

test('replacement updates DB before removing the old image and uses a concurrency guard', async () => {
  let savedPath = '';
  const { api, calls } = repository((request) => {
    if (request.method === 'PATCH') {
      savedPath = JSON.parse(request.body).image_path;
      return json({
        ...existing,
        ...JSON.parse(request.body),
        updated_at: '2026-11-13T01:00:00Z',
      });
    }
    return json(request.method === 'DELETE' ? [] : { Key: 'uploaded' });
  });
  const saved = await api.save(
    user,
    draft,
    existing,
    new Blob(['new'], { type: 'image/webp' }),
  );
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(
    calls[1].url.searchParams.get('updated_at'),
    `eq.${existing.updated_at}`,
  );
  assert.deepEqual(JSON.parse(calls[2].body).prefixes, [oldPath]);
  assert.equal(saved.record.image_path, savedPath);
  assert.equal(saved.warning, '');
});

test('metadata-only edits keep the current image and skip Storage operations', async () => {
  const { api, calls } = repository((request) =>
    json({ ...existing, ...JSON.parse(request.body) }),
  );
  const saved = await api.save(user, draft, existing, null);
  assert.equal(calls.length, 1);
  assert.equal(saved.record.image_path, oldPath);
  await assert.rejects(() => api.save(user, draft, null, null), /写真|사진/);
});

test('a rejected delete never removes the image; successful delete cleans up afterwards', async () => {
  const failed = repository(() =>
    json({ code: '42501', message: 'denied' }, 403),
  );
  await assert.rejects(() => failed.api.delete(existing), /권한/);
  assert.equal(failed.calls.length, 1);
  const success = repository((request) =>
    json(request.url.pathname.startsWith('/rest/') ? { id: existing.id } : []),
  );
  await success.api.delete(existing);
  assert.equal(success.calls[0].method, 'DELETE');
  assert.deepEqual(JSON.parse(success.calls[1].body).prefixes, [oldPath]);
});

test('cleanup failure reports a warning without rolling back the saved replacement', async () => {
  const { api, calls } = repository((request) => {
    if (request.method === 'PATCH')
      return json({ ...existing, ...JSON.parse(request.body) });
    if (request.method === 'DELETE')
      return json({ message: 'cleanup denied' }, 403);
    return json({ Key: 'uploaded' });
  });
  const result = await api.save(
    user,
    draft,
    existing,
    new Blob(['photo'], { type: 'image/webp' }),
  );
  assert.match(result.warning, /정리에 실패/);
  assert.equal(calls.length, 3);
  assert.notEqual(result.record.image_path, oldPath);
});


test('new artwork chooses the first free slot in the selected gallery', () => {
  assert.equal(firstAvailableSlot([], 'B'), '05');
  assert.equal(firstAvailableSlot([{slot_id:'05'}, {slot_id:'06'}], 'B'), '07');
  assert.equal(firstAvailableSlot([], 'C'), '09');
  assert.equal(firstAvailableSlot([{slot_id:'01'}], 'ALL'), '02');
});

test('a full gallery does not spill new artwork into another gallery', () => {
  const fullA = artworks.filter(slot => slot.zone === 'A').map(slot => ({slot_id:slot.id}));
  assert.equal(firstAvailableSlot(fullA, 'A'), '');
  assert.equal(firstAvailableSlot(fullA, 'B'), '05');
  assert.equal(firstAvailableSlot(artworks.map(slot => ({slot_id:slot.id})), 'ALL'), '');
});
