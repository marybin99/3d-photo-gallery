import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createAdminGuestbookRepository } from '../src/adminGuestbookRepository.ts';

const entry = {
  id: '11111111-1111-4111-8111-111111111111',
  nickname: '방문자',
  message: '잘 보고 갑니다.',
  is_visible: false,
  created_at: '2026-11-13T00:00:00Z',
};
function setup(status = 200, response: unknown = [entry]) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const client = createClient('https://test.supabase.co', 'test-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        calls.push({
          url: new URL(String(input)),
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        return new Response(JSON.stringify(response), {
          status,
          headers: {
            'content-type': 'application/json',
            'content-range': '20-39/45',
          },
        });
      },
    },
  });
  return { api: createAdminGuestbookRepository(client), calls };
}
test('admin listing includes hidden entries, stable ordering, count and pagination', async () => {
  const { api, calls } = setup();
  const result = await api.list('all', 1);
  assert.equal(result.entries[0].is_visible, false);
  assert.equal(result.count, 45);
  assert.equal(calls[0].url.searchParams.has('is_visible'), false);
  assert.equal(calls[0].url.searchParams.get('offset'), '20');
  assert.equal(calls[0].url.searchParams.get('limit'), '20');
  assert.equal(
    calls[0].url.searchParams.get('order'),
    'created_at.desc,id.desc',
  );
  await api.list('hidden', 0);
  await api.list('visible', 0);
  assert.equal(calls[1].url.searchParams.get('is_visible'), 'eq.false');
  assert.equal(calls[2].url.searchParams.get('is_visible'), 'eq.true');
});
test('moderation uses checked RPC with original visibility rather than direct table writes', async () => {
  const { api, calls } = setup(200, entry);
  for (const action of ['show', 'hide', 'delete'] as const) {
    await api.moderate(entry, action);
    const call = calls.at(-1)!;
    assert.equal(call.method, 'POST');
    assert.equal(call.url.pathname, '/rest/v1/rpc/moderate_guestbook');
    assert.deepEqual(call.body, {
      p_id: entry.id,
      p_action: action,
      p_expected_visible: false,
    });
  }
});
test('permission failures and concurrent moderation surface actionable errors', async () => {
  const denied = setup(403, { code: '42501', message: 'denied' });
  await assert.rejects(
    () => denied.api.moderate(entry, 'delete'),
    /운영자 권한/,
  );
  const conflict = setup(400, { code: 'P0001', message: 'GUESTBOOK_CONFLICT' });
  await assert.rejects(
    () => conflict.api.moderate(entry, 'hide'),
    /변경되거나 삭제/,
  );
  const missing = setup(404, { code: 'PGRST202', message: 'missing function' });
  await assert.rejects(() => missing.api.moderate(entry, 'show'), /SQL 적용/);
});
