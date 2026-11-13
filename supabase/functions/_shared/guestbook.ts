export type GuestbookEntry = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
};
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateGuestbookText(nickname: unknown, message: unknown) {
  if (typeof nickname !== 'string' || typeof message !== 'string')
    throw new Error('별명과 내용을 입력해 주세요.');
  const nick = nickname.trim(),
    text = message.replace(/\r\n?/g, '\n').trim();
  if (
    !nick ||
    Array.from(nick).length > 24 ||
    /[\u0000-\u001f\u007f]/.test(nick)
  )
    throw new Error('별명은 줄바꿈 없이 1~24자로 입력해 주세요.');
  if (
    !text ||
    Array.from(text).length > 280 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
  )
    throw new Error('내용은 1~280자로 입력해 주세요.');
  return { nickname: nick, message: text };
}
export function validateGuestbookRequest(body: unknown) {
  if (!body || typeof body !== 'object')
    throw new Error('등록 내용을 확인해 주세요.');
  const value = body as Record<string, unknown>;
  const text = validateGuestbookText(value.nickname, value.message);
  if (
    typeof value.clientId !== 'string' ||
    !uuidPattern.test(value.clientId) ||
    typeof value.requestId !== 'string' ||
    !uuidPattern.test(value.requestId)
  )
    throw new Error('페이지를 새로고침한 뒤 다시 등록해 주세요.');
  if (value.website !== '' && value.website !== undefined)
    throw new Error('등록 내용을 확인해 주세요.');
  if (
    value.token !== undefined &&
    (typeof value.token !== 'string' || value.token.length > 2048)
  )
    throw new Error('방문자 인증을 다시 진행해 주세요.');
  return {
    ...text,
    clientId: value.clientId,
    requestId: value.requestId,
    token: typeof value.token === 'string' ? value.token : '',
  };
}
