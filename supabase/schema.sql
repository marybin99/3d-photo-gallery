-- Supabase SQL Editor에서 실행하세요.
create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 24),
  message text not null check (char_length(message) between 1 and 280),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.guestbook_entries enable row level security;
create policy "Anyone can read visible notes" on public.guestbook_entries
  for select to anon, authenticated using (is_visible = true);
-- 운영 공개 전에 아래 직접 INSERT 정책 대신 Turnstile 검증을 수행하는
-- 서버/Edge Function으로 기록을 받도록 설정하세요.
-- 공개 클라이언트에 INSERT 권한을 열면 스팸 공격에 취약할 수 있습니다.
-- 개발 테스트 전용: Supabase SQL Editor에서 직접 추가하여 목록 표시를 확인할 수 있습니다.
-- insert into public.guestbook_entries(nickname,message) values ('첫 관람객','전시 잘 보고 갑니다.');
