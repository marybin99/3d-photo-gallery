// Supabase Auth uses an email-shaped internal identifier. These addresses are
// never shown for username accounts and are never used to send mail.
const accountDomain = '@accounts.gallery.invalid';
export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(username))
    throw new Error(
      '아이디는 영문·숫자·밑줄(_), 하이픈(-)으로 3~32자 입력해 주세요.',
    );
  return username;
}
export function usernameEmail(value: string) {
  return normalizeUsername(value) + accountDomain;
}
export function loginEmail(value: string) {
  const trimmed = value.trim();
  // Existing administrator email logins continue to work during migration.
  return trimmed.includes('@') ? trimmed : usernameEmail(trimmed);
}
export function accountLabel(email: string | null | undefined) {
  if (!email) return '삭제된 계정';
  return email.endsWith(accountDomain)
    ? email.slice(0, -accountDomain.length)
    : email;
}
export function validateAccountPassword(password: string) {
  if (password.length < 8 || password.length > 72)
    throw new Error('비밀번호는 8~72자로 입력해 주세요.');
}
