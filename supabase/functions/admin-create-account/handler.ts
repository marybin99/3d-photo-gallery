import {
  normalizeUsername,
  usernameEmail,
  validateAccountPassword,
} from '../_shared/adminAccount.ts';
export type NewAccount = {
  username: string;
  password: string;
  role: 'owner' | 'manager' | 'editor';
  is_active: boolean;
  room_ids: string[] | null;
};
export function createAccountHandler(
  origins: string[],
  services: {
    isOwner: (token: string) => Promise<boolean>;
    validRooms: (token: string, rooms: string[]) => Promise<boolean>;
    create: (
      email: string,
      password: string,
    ) => Promise<{ id: string } | { error: 'duplicate' | 'failed' }>;
    grant: (
      token: string,
      email: string,
      account: Omit<NewAccount, 'password'>,
    ) => Promise<boolean>;
    removeUnassigned: (userId: string) => Promise<void>;
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
        return reply(403, '최고 관리자만 계정을 추가할 수 있습니다.');
      let body;
      try {
        body = await request.json();
      } catch {
        return reply(400, '계정 정보를 확인해 주세요.');
      }
      const { username, password, role, is_active, room_ids } = body ?? {};
      if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !['owner', 'manager', 'editor'].includes(role) ||
        typeof is_active !== 'boolean' ||
        !(
          room_ids === null ||
          (Array.isArray(room_ids) &&
            room_ids.every((id) => typeof id === 'string'))
        )
      )
        return reply(400, '계정 정보를 확인해 주세요.');
      let cleanUsername: string;
      try {
        cleanUsername = normalizeUsername(username);
        validateAccountPassword(password);
      } catch (error) {
        return reply(400, (error as Error).message);
      }
      if (
        room_ids !== null &&
        role !== 'owner' &&
        !(await services.validRooms(token, room_ids))
      )
        return reply(400, '담당 전시실을 확인해 주세요.');
      const email = usernameEmail(cleanUsername);
      const result = await services.create(email, password);
      if ('error' in result)
        return reply(
          result.error === 'duplicate' ? 409 : 400,
          result.error === 'duplicate'
            ? '이미 사용 중인 아이디입니다.'
            : '계정을 만들지 못했습니다. 비밀번호 정책과 서버 설정을 확인해 주세요.',
        );
      let granted = false;
      try {
        // Permissions are rechecked by the DB RPC after Auth creates the user.
        // Neither password nor a client-supplied address reaches the role RPC.
        granted = await services.grant(token, email, {
          username: cleanUsername,
          role,
          is_active,
          room_ids,
        });
      } finally {
        if (!granted) await services.removeUnassigned(result.id);
      }
      if (!granted)
        return reply(
          409,
          '계정 권한을 등록하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
        );
      return new Response(
        JSON.stringify({ created: true, username: cleanUsername }),
        { status: 201, headers },
      );
    } catch {
      return reply(
        500,
        '계정을 추가하지 못했습니다. 서버 연결과 계정 생성 함수 설정을 확인해 주세요.',
      );
    }
  };
}
