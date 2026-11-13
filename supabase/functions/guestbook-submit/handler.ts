import {
  validateGuestbookRequest,
  type GuestbookEntry,
} from '../_shared/guestbook.ts';

export type GuestbookServerConfig = {
  origins: string[];
  rateSecret: string;
  turnstileSecret?: string;
};
export type GuestbookWriter = (input: {
  nickname: string;
  message: string;
  rateKey: string;
  requestId: string;
}) => Promise<GuestbookEntry | null>;
async function readJson(request: Request) {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new Error('INVALID_BODY');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        throw new Error('BODY_TOO_LARGE');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('INVALID_BODY');
  }
}
async function rateHash(clientId: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(clientId),
  );
  return Array.from(new Uint8Array(signature), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}
export function createGuestbookHandler(
  config: GuestbookServerConfig,
  write: GuestbookWriter,
  fetcher: typeof fetch = fetch,
) {
  const origins = [...new Set(config.origins.flatMap(value => {
    try {
      const url = new URL(value.trim().replace(/^["']|["']$/g, ''));
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
      return [url.origin];
    } catch { return []; }
  }))];
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') ?? '';
    const allowed = origins.includes(origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    if (allowed) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] =
        'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-runtime, x-supabase-client-platform-version, x-supabase-client-runtime-version, x-retry-count, traceparent, tracestate, baggage';
    }
    const respond = (
      status: number,
      body: unknown,
      extra: Record<string, string> = {},
    ) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, ...extra },
      });
    if (!allowed)
      return respond(403, {
        error: '이 주소에서는 방명록을 등록할 수 없습니다.',
      });
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    if (request.method !== 'POST')
      return respond(
        405,
        { error: '지원하지 않는 요청입니다.' },
        { Allow: 'POST, OPTIONS' },
      );
    if (!config.rateSecret)
      return respond(503, {
        error: '현재 방명록을 등록할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      });
    let input: ReturnType<typeof validateGuestbookRequest>;
    try {
      input = validateGuestbookRequest(await readJson(request));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      return respond(message === 'BODY_TOO_LARGE' ? 413 : 400, {
        error:
          message === 'INVALID_BODY' || message === 'BODY_TOO_LARGE'
            ? '등록 내용을 확인해 주세요.'
            : message || '등록 내용을 확인해 주세요.',
      });
    }
    if (config.turnstileSecret) {
      if (!input.token)
        return respond(400, { error: '방문자 인증을 완료해 주세요.' });
      try {
        const response = await fetcher(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            body: new URLSearchParams({
              secret: config.turnstileSecret,
              response: input.token,
              idempotency_key: input.requestId,
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        const result = (await response.json()) as {
          success?: boolean;
          action?: string;
          hostname?: string;
        };
        const hosts = origins.map((url) => new URL(url).hostname);
        if (
          !response.ok ||
          !result.success ||
          result.action !== 'guestbook' ||
          !hosts.includes(result.hostname ?? '')
        )
          return respond(400, {
            error:
              '방문자 인증이 만료되었거나 실패했습니다. 다시 진행해 주세요.',
          });
      } catch {
        return respond(503, {
          error: '방문자 인증에 연결하지 못했습니다. 다시 시도해 주세요.',
        });
      }
    }
    try {
      const rateKey = await rateHash(input.clientId, config.rateSecret);
      const entry = await write({
        nickname: input.nickname,
        message: input.message,
        requestId: input.requestId,
        rateKey,
      });
      if (!entry)
        return respond(409, {
          error: '이미 처리된 글입니다. 방명록을 새로 열어 확인해 주세요.',
        });
      return respond(201, { entry });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      if (message.includes('GUESTBOOK_RATE_LIMIT'))
        return respond(
          429,
          { error: '글을 남긴 뒤 1분 후에 다시 등록할 수 있습니다.' },
          { 'Retry-After': '60' },
        );
      if (message.includes('GUESTBOOK_HOURLY_LIMIT'))
        return respond(
          429,
          { error: '등록 횟수가 많습니다. 한 시간 뒤 다시 이용해 주세요.' },
          { 'Retry-After': '3600' },
        );
      if (message.includes('GUESTBOOK_GLOBAL_LIMIT'))
        return respond(
          429,
          {
            error: '지금은 방명록 이용이 많습니다. 잠시 후 다시 시도해 주세요.',
          },
          { 'Retry-After': '3600' },
        );
      return respond(500, {
        error: '방명록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  };
}
