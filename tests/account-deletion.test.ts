import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeleteAccountHandler } from '../supabase/functions/admin-delete-account/handler.ts';

const target = '00000000-0000-4000-8000-000000000002';
const expected = '2026-01-01T00:00:00+00:00';
const input = { user_id: target, expected_updated_at: expected };
function request(
  body: unknown = input,
  origin = 'https://gallery.test',
  authorization = 'Bearer caller-token',
) {
  return new Request('https://db.test/functions/v1/admin-delete-account', {
    method: 'POST',
    headers: { origin, authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function fixture(
  options: {
    owner?: boolean;
    error?: { code: string; message: string };
    auth?: boolean;
    finish?: boolean;
    resolvedId?: string;
  } = {},
) {
  const calls: unknown[][] = [];
  const handler = createDeleteAccountHandler(['https://gallery.test'], {
    async isOwner(token) {
      calls.push(['owner', token]);
      return options.owner !== false;
    },
    async prepare(token, id, version) {
      calls.push(['prepare', token, id, version]);
      return { userId: options.resolvedId ?? id, error: options.error ?? null };
    },
    async deleteAuth(id) {
      calls.push(['auth', id]);
      return options.auth !== false;
    },
    async finish(id) {
      calls.push(['finish', id]);
      return options.finish !== false;
    },
  });
  return { handler, calls };
}
test('account deletion rejects untrusted origins, missing login and non-owners before preparing a deletion', async () => {
  const { handler, calls } = fixture();
  assert.equal(
    (await handler(request(input, 'https://attacker.test'))).status,
    403,
  );
  assert.equal(
    (await handler(request(input, 'https://gallery.test', ''))).status,
    401,
  );
  assert.deepEqual(calls, []);
  const denied = fixture({ owner: false });
  assert.equal((await denied.handler(request())).status, 403);
  assert.deepEqual(denied.calls, [['owner', 'caller-token']]);
});
test('account deletion requires a valid user ID and version before calling the checked RPC', async () => {
  for (const body of [
    { ...input, user_id: 'other' },
    { ...input, expected_updated_at: null },
    { ...input, expected_updated_at: 'yesterday' },
    { user_id: target },
  ]) {
    const { handler, calls } = fixture();
    assert.equal((await handler(request(body))).status, 400);
    assert.deepEqual(calls, [['owner', 'caller-token']]);
  }
});
test('server-side last-owner, self-deletion and stale-version refusals never reach the Auth deletion API', async () => {
  for (const message of [
    '마지막 최고 관리자 계정은 삭제할 수 없습니다.',
    '현재 로그인한 계정은 삭제할 수 없습니다.',
    '계정 정보가 변경되거나 삭제되었습니다.',
  ]) {
    const { handler, calls } = fixture({ error: { code: 'P0001', message } });
    const response = await handler(request());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, message);
    assert.equal(calls.length, 2);
  }
  const revoked = fixture({ error: { code: '42501', message: '권한 없음' } });
  assert.equal((await revoked.handler(request())).status, 403);
  assert.equal(revoked.calls.length, 2);
});
test('deletion reserves and revokes DB access before deleting Auth and removes the account from the list only after Auth succeeds', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(calls, [
    ['owner', 'caller-token'],
    ['prepare', 'caller-token', target, expected],
    ['auth', target],
    ['finish', target],
  ]);
});
test('a mismatched preparation result cannot delete a different user', async () => {
  const { handler, calls } = fixture({
    resolvedId: '00000000-0000-4000-8000-000000000003',
  });
  assert.equal((await handler(request())).status, 409);
  assert.equal(calls.length, 2);
});
test('partial failures never report success and preserve a retry path', async () => {
  const authFailed = fixture({ auth: false });
  const response = await authFailed.handler(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /접근은 차단/);
  assert.equal(authFailed.calls.length, 3);
  const finalizeFailed = fixture({ finish: false });
  const finalResponse = await finalizeFailed.handler(request());
  assert.equal(finalResponse.status, 502);
  assert.match((await finalResponse.json()).error, /목록 정리/);
  const retry = fixture();
  assert.equal((await retry.handler(request())).status, 200);
});
