import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from '@react-three/fiber';
import { useAdminSession } from '../src/useAdminSession.ts';

test('admin hook waits for server permission, denies normal users and ignores a late grant after logout', async () => {
  let callback: ((event: string, session: unknown) => void) | undefined;
  let resolveRole: ((value: unknown) => void) | undefined;
  let unsubscribed = false;
  const client = {
    auth: {
      onAuthStateChange(fn: typeof callback) {
        callback = fn;
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribed = true;
              },
            },
          },
        };
      },
      signInWithPassword: async () => ({
        error: { message: 'invalid password' },
      }),
      signOut: async () => {
        callback?.('SIGNED_OUT', null);
        return { error: null };
      },
    },
    rpc: () =>
      new Promise((resolve) => {
        resolveRole = resolve;
      }),
  };
  let result: ReturnType<typeof useAdminSession> | undefined;
  function Harness() {
    result = useAdminSession(client as any);
    return null;
  }
  const canvas = {
    width: 100,
    height: 100,
    style: {},
    addEventListener() {},
    removeEventListener() {},
  };
  const root = createRoot(canvas as unknown as HTMLCanvasElement);
  const previous = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await root.configure({
      gl: {
        render() {},
        setSize() {},
        setPixelRatio() {},
        getPixelRatio() {
          return 1;
        },
        shadowMap: {},
        xr: {
          addEventListener() {},
          removeEventListener() {},
          setAnimationLoop() {},
        },
      } as any,
      frameloop: 'never',
      dpr: 1,
      size: { width: 100, height: 100, top: 0, left: 0 },
    });
    await act(async () => {
      root.render(createElement(Harness));
    });
    assert.equal(result!.loading, true);
    await act(async () => {
      callback?.('INITIAL_SESSION', null);
    });
    assert.equal(result!.allowed, false);
    assert.equal(result!.loading, false);
    await assert.rejects(
      () => result!.signIn('test@example.test', 'wrong'),
      /로그인하지 못했습니다/,
    );
    const session = { user: { id: 'user-a', email: 'a@example.test' } };
    await act(async () => {
      callback?.('SIGNED_IN', session);
    });
    assert.equal(result!.allowed, false);
    assert.equal(result!.loading, true);
    await act(async () => {
      resolveRole?.({ data: false, error: null });
    });
    assert.equal(result!.allowed, false);
    assert.equal(result!.loading, false);
    await act(async () => {
      result!.retry();
    });
    await act(async () => {
      resolveRole?.({ data: true, error: null });
    });
    assert.equal(result!.allowed, true);
    await act(async () => {
      callback?.('SIGNED_IN', {
        user: { id: 'user-b', email: 'b@example.test' },
      });
    });
    assert.equal(
      result!.allowed,
      false,
      'Previous user permission must not carry over',
    );
    const late = resolveRole;
    await act(async () => {
      await result!.signOut();
    });
    await act(async () => {
      late?.({ data: true, error: null });
    });
    assert.equal(result!.session, null);
    assert.equal(
      result!.allowed,
      false,
      'Late permission response must not restore access',
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previous;
  }
  assert.ok(unsubscribed);
});
