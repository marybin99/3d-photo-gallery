type DatabaseError = { code?: string; message: string };
export function createDeleteAccountHandler(
  origins: string[],
  services: {
    isOwner: (token: string) => Promise<boolean>;
    prepare: (
      token: string,
      userId: string,
      expected: string,
    ) => Promise<{ userId: string | null; error: DatabaseError | null }>;
    deleteAuth: (userId: string) => Promise<boolean>;
    finish: (userId: string) => Promise<boolean>;
  },
) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') || '';
    const headers = {
      'Access-Control-Allow-Origin': origins.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    };
    const reply = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), { status, headers });
    if (!origins.includes(origin))
      return reply(403, '허용되지 않은 주소입니다.');
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    if (request.method !== 'POST')
      return reply(405, '지원하지 않는 요청입니다.');
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ') || !authorization.slice(7).trim())
      return reply(401, '로그인해 주세요.');
    const token = authorization.slice(7);
    try {
      if (!(await services.isOwner(token)))
        return reply(403, '최고 관리자만 계정을 삭제할 수 있습니다.');
      let body;
      try {
        body = await request.json();
      } catch {
        return reply(400, '삭제할 계정 정보를 확인해 주세요.');
      }
      const { user_id, expected_updated_at } = body ?? {};
      if (
        typeof user_id !== 'string' ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(user_id) ||
        typeof expected_updated_at !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T/.test(expected_updated_at) ||
        !Number.isFinite(Date.parse(expected_updated_at))
      )
        return reply(400, '삭제할 계정 정보를 확인해 주세요.');
      const result = await services.prepare(
        token,
        user_id,
        expected_updated_at,
      );
      if (result.error)
        return reply(
          result.error.code === '42501' ? 403 : 409,
          result.error.code === 'P0001'
            ? result.error.message
            : '계정을 삭제할 수 없습니다. 최고 관리자 권한과 계정 삭제 SQL 적용 여부를 확인해 주세요.',
        );
      if (result.userId !== user_id)
        return reply(
          409,
          '삭제 요청 결과를 확인하지 못했습니다. 계정 목록을 새로고침해 주세요.',
        );
      if (!(await services.deleteAuth(user_id)))
        return reply(
          502,
          '계정 접근은 차단했지만 인증 계정 삭제를 완료하지 못했습니다. 삭제를 다시 시도해 주세요.',
        );
      if (!(await services.finish(user_id)))
        return reply(
          502,
          '인증 계정은 삭제했지만 목록 정리를 완료하지 못했습니다. 삭제를 다시 시도해 주세요.',
        );
      return new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers,
      });
    } catch {
      return reply(
        500,
        '계정 삭제를 완료하지 못했습니다. 목록을 새로고침한 뒤 삭제를 다시 시도해 주세요.',
      );
    }
  };
}
