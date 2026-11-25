import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseRoom, parseAccess } from '../src/features/admin/adminAccess.ts';
import { createAccountHandler } from '../supabase/functions/admin-create-account/handler.ts';
import {
  accountLabel,
  loginEmail,
  normalizeUsername,
  usernameEmail,
  validateAccountPassword,
} from '../supabase/functions/_shared/adminAccount.ts';

test('access parsing fails closed and room scope distinguishes all, none, assigned and suspended accounts', () => {
  for (const invalid of [
    true,
    false,
    null,
    {},
    { role: 'owner' },
    { role: 'owner', is_active: true, room_ids: [1] },
    { role: 'superadmin', is_active: true, room_ids: null },
  ])
    assert.equal(parseAccess(invalid), null);
  const editor = parseAccess({
    role: 'editor',
    is_active: true,
    room_ids: ['B'],
  })!;
  assert.equal(canUseRoom(editor, 'A'), false);
  assert.equal(canUseRoom(editor, 'B'), true);
  assert.equal(canUseRoom({ ...editor, room_ids: [] }, 'B'), false);
  assert.equal(canUseRoom({ ...editor, room_ids: null }, 'A'), true);
  assert.equal(canUseRoom({ ...editor, role: 'owner' }, 'A'), true);
  assert.equal(
    canUseRoom({ ...editor, role: 'owner', is_active: false }, 'A'),
    false,
  );
});

test('username login uses a normalized internal identifier, without requiring an email account', () => {
  assert.equal(normalizeUsername(' Staff01 '), 'staff01');
  assert.equal(usernameEmail('Staff01'), 'staff01@accounts.gallery.invalid');
  assert.equal(loginEmail(' Staff01 '), usernameEmail('staff01'));
  assert.equal(accountLabel(usernameEmail('staff01')), 'staff01');
  assert.equal(loginEmail(' legacy@example.test '), 'legacy@example.test');
  assert.equal(accountLabel('legacy@example.test'), 'legacy@example.test');
  for (const username of [
    '',
    'ab',
    'with space',
    'real@example.test',
    '../admin',
    'a'.repeat(33),
  ])
    assert.throws(() => normalizeUsername(username));
  assert.throws(() => validateAccountPassword('short'));
  assert.throws(() => validateAccountPassword('a'.repeat(73)));
  assert.doesNotThrow(() => validateAccountPassword('safe-password'));
});

function fixture(
  options: {
    owner?: boolean;
    valid?: boolean;
    grant?: boolean;
    duplicate?: boolean;
    throwGrant?: boolean;
  } = {},
) {
  const calls: unknown[][] = [];
  const handler = createAccountHandler(['https://gallery.test'], {
    async isOwner(token) {
      calls.push(['owner', token]);
      return options.owner !== false;
    },
    async validRooms(token, rooms) {
      calls.push(['rooms', token, rooms]);
      return options.valid !== false;
    },
    async create(email, password) {
      calls.push(['create', email, password]);
      return options.duplicate
        ? { error: 'duplicate' }
        : { id: 'created-user' };
    },
    async grant(token, email, account) {
      calls.push(['grant', token, email, account]);
      if (options.throwGrant) throw new Error('network error');
      return options.grant !== false;
    },
    async removeUnassigned(id) {
      calls.push(['cleanup', id]);
    },
  });
  return { calls, handler };
}
const input = {
  username: 'staff01',
  password: 'test-password-123',
  role: 'editor',
  is_active: true,
  room_ids: ['B'],
};
function request(
  body: unknown = input,
  origin = 'https://gallery.test',
  authorization = 'Bearer caller-token',
) {
  return new Request('https://db.test/functions/v1/admin-create-account', {
    method: 'POST',
    headers: { origin, authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
test('account creation rejects foreign origins, missing authentication and non-owners before creating users', async () => {
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
test('account creation validates username, password, role and assigned rooms before calling Auth', async () => {
  for (const bad of [
    { ...input, username: 'real@example.test' },
    { ...input, password: 'short' },
    { ...input, role: 'root' },
  ]) {
    const invalid = fixture();
    assert.equal((await invalid.handler(request(bad))).status, 400);
    assert.equal(invalid.calls.length, 1);
  }
  const scoped = fixture({ valid: false });
  assert.equal((await scoped.handler(request())).status, 400);
  assert.equal(scoped.calls.length, 2);
});
test('new username accounts get a password directly and permissions never contain that password', async () => {
  const success = fixture();
  const response = await success.handler(
    request({ ...input, username: ' Staff01 ', email: 'ignore@example.test' }),
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    created: true,
    username: 'staff01',
  });
  assert.deepEqual(success.calls[2], [
    'create',
    'staff01@accounts.gallery.invalid',
    input.password,
  ]);
  assert.deepEqual(success.calls[3], [
    'grant',
    'caller-token',
    'staff01@accounts.gallery.invalid',
    { username: 'staff01', role: 'editor', is_active: true, room_ids: ['B'] },
  ]);
  assert.equal(success.calls.length, 4);
});
test('duplicate usernames never grant permissions or change an existing account password', async () => {
  const { handler, calls } = fixture({ duplicate: true });
  const response = await handler(request());
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /이미 사용 중/);
  assert.equal(calls.length, 3);
});
test('failed or interrupted permission grants clean up only the new unassigned user', async () => {
  for (const option of [{ grant: false }, { throwGrant: true }]) {
    const { handler, calls } = fixture(option);
    const response = await handler(request());
    assert.ok(response.status >= 400);
    assert.deepEqual(calls.at(-1), ['cleanup', 'created-user']);
    assert.equal((await response.text()).includes(input.password), false);
  }
});
