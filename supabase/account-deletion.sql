-- Apply after account-permissions.sql. Safe to re-run.
begin;
alter table public.gallery_admins add column if not exists is_deleting boolean not null default false;
-- Keep only the login label required to retry a partially completed deletion.
alter table public.gallery_admins add column if not exists deletion_email text;
do $$
begin
  if exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='gallery_admins' and column_name='deletion_before') then
    update public.gallery_admins set deletion_email=coalesce(deletion_email,deletion_before->>'account_email')
      where is_deleting;
  end if;
end;
$$;

-- A pending deletion must never be reactivated by a stale permission form.
create or replace function public.guard_pending_gallery_account()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.is_deleting and (new.is_active or not new.is_deleting or new.role<>old.role
    or new.deletion_email is distinct from old.deletion_email) then
    raise exception '삭제 중인 계정은 권한을 변경할 수 없습니다. 삭제를 다시 시도해 주세요.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_pending_gallery_account on public.gallery_admins;
create trigger guard_pending_gallery_account before update on public.gallery_admins
  for each row execute function public.guard_pending_gallery_account();

create or replace function public.list_gallery_accounts_with_deletions()
returns table(user_id uuid,email text,role text,is_active boolean,room_ids text[],updated_at timestamptz,is_deleting boolean)
language plpgsql security definer set search_path='' as $$
begin
  if not public.gallery_has_role(array['owner']) then
    raise exception '최고 관리자만 계정을 관리할 수 있습니다.' using errcode='42501';
  end if;
  return query select a.user_id,coalesce(a.deletion_email,u.email::text),
    a.role,a.is_active,a.room_ids,a.updated_at,a.is_deleting
    from public.gallery_admins a join auth.users u on u.id=a.user_id order by a.created_at,a.user_id;
end;
$$;

-- Serialize with role changes: reserve the deletion and revoke access BEFORE
-- the server calls Auth. Retrying a reserved deletion is safe and idempotent.
create or replace function public.prepare_gallery_account_deletion(p_user_id uuid,p_expected timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  previous public.gallery_admins%rowtype;
  target_email text;
begin
  lock table public.gallery_admins in exclusive mode;
  if not public.gallery_has_role(array['owner']) then
    raise exception '최고 관리자만 계정을 삭제할 수 있습니다.' using errcode='42501';
  end if;
  select * into previous from public.gallery_admins a where a.user_id=p_user_id;
  if previous.user_id is null or p_expected is null or previous.updated_at<>p_expected then
    raise exception '계정 정보가 변경되거나 삭제되었습니다. 새로고침 후 다시 시도해 주세요.';
  end if;
  if previous.role='owner' and previous.is_active and not exists(
    select 1 from public.gallery_admins a where a.user_id<>p_user_id and a.role='owner' and a.is_active
  ) then raise exception '마지막 최고 관리자 계정은 삭제할 수 없습니다.'; end if;
  if p_user_id=auth.uid() then
    raise exception '현재 로그인한 계정은 삭제할 수 없습니다. 다른 최고 관리자 계정으로 로그인해 주세요.';
  end if;
  if previous.is_deleting then return p_user_id; end if;
  select u.email::text into target_email from auth.users u where u.id=p_user_id;
  update public.gallery_admins a set is_active=false,is_deleting=true,
    deletion_email=target_email,updated_at=clock_timestamp()
    where a.user_id=p_user_id;
  return p_user_id;
end;
$$;

-- Only the server may finalize, and only after Auth confirms deletion.
create or replace function public.finish_gallery_account_deletion(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  previous public.gallery_admins%rowtype;
begin
  lock table public.gallery_admins in exclusive mode;
  select * into previous from public.gallery_admins a where a.user_id=p_user_id;
  if previous.user_id is null then return; end if;
  if not previous.is_deleting then
    raise exception '계정 삭제 요청이 없습니다.';
  end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id and u.deleted_at is not null) then
    raise exception '인증 계정 삭제가 완료되지 않았습니다.';
  end if;
  delete from public.gallery_admins a where a.user_id=p_user_id;
end;
$$;
revoke all on function public.list_gallery_accounts_with_deletions(),public.prepare_gallery_account_deletion(uuid,timestamptz) from public,anon;
grant execute on function public.list_gallery_accounts_with_deletions(),public.prepare_gallery_account_deletion(uuid,timestamptz) to authenticated;
revoke all on function public.finish_gallery_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.finish_gallery_account_deletion(uuid) to service_role;

-- Remove the retired logging API, persisted history and unused snapshots.
-- Reapply account-permissions.sql first to remove old writes from its functions.
drop function if exists public.list_gallery_access_log();
drop table if exists public.gallery_access_log;
alter table public.gallery_admins drop column if exists deletion_requested_by;
alter table public.gallery_admins drop column if exists deletion_before;
commit;
