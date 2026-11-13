# 운영자 계정과 작품 관리 연결

관리자 주소는 **사이트 주소 뒤에 `/#/admin`**입니다. 예를 들어 로컬 서버가 `http://localhost:5174`이면 `http://localhost:5174/#/admin`으로 접속합니다. 별도의 Vercel 경로 재작성은 필요하지 않습니다.

Supabase가 없으면 기존 데모 전시가 열리고, 관리자 주소에서는 초기 설정 안내가 표시됩니다. Supabase를 연결하면 전시관은 DB의 공개 작품만 표시합니다. **첫 연결 직후 DB가 비어 있으면 액자도 비어 있습니다.**

## 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인하고 새 프로젝트를 만듭니다.
2. 프로젝트 이름, DB 비밀번호, 사용할 리전을 지정하고 준비가 끝날 때까지 기다립니다.
3. 프로젝트의 **Connect** 또는 **Settings → API Keys / Data API**에서 Project URL과 **Publishable key**를 확인합니다. 기존 프로젝트의 anon key도 지원합니다.

이 앱에는 공개 클라이언트 키만 필요합니다. DB 비밀번호, secret key, service_role key는 `.env`의 `VITE_*` 항목이나 프런트엔드 코드에 넣지 않습니다. [Supabase API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)

## 2. DB와 Storage 초기 설정

Supabase **SQL Editor → New query**에서 다음 파일 내용을 각각 붙여 넣고 실행합니다.

1. [`supabase/schema.sql`](../supabase/schema.sql): 기존 방명록 조회 테이블. 실제 공개 방명록 쓰기는 별도 개발 대상입니다.
2. [`supabase/artwork-management.sql`](../supabase/artwork-management.sql): 운영자 목록, 작품 테이블, 권한 함수, RLS 정책, 비공개 이미지 버킷.
3. [`supabase/room-names.sql`](../supabase/room-names.sql): 전시실 이름 테이블과 운영자 이름 수정 권한.

이미 작품 관리 설정을 끝낸 프로젝트는 **3번 파일만 추가 실행**하면 됩니다. 기존 작품과 사진은 변경되지 않습니다.

세 스크립트는 다시 실행할 수 있도록 작성했습니다. `gallery-artworks` 버킷은 private 상태로 사용하며 별도로 public으로 바꾸지 않습니다.

| 구성 | 역할 |
| --- | --- |
| `gallery_admins` | 운영자 Auth 사용자 UUID 목록. 브라우저에서 직접 수정 불가 |
| `is_gallery_admin()` | 현재 로그인한 사용자가 운영자인지 DB에서 확인 |
| `artworks` | 제목, 설명, 액자 위치, 사진 경로, 공개 여부, 수정 시각 |
| `gallery-artworks` | JPEG/PNG/WebP만 허용하는 비공개 Storage 버킷 |

방문자는 공개 작품만 조회할 수 있고, DB/Storage 쓰기는 운영자만 허용됩니다. 동일한 액자 위치에는 한 작품만 등록할 수 있습니다.

## 3. 운영자 계정 생성과 권한 부여

1. Supabase **Authentication → Users → Add user**에서 이메일과 비밀번호로 사용자를 생성합니다. 이 구현은 비밀번호 로그인용이므로, 초대 이메일을 보내는 방식보다 **Create user**에서 비밀번호를 직접 정하는 방식을 사용하세요.
2. 계정이 로그인 가능한 확인 상태인지 확인합니다. 앱 안에는 회원가입 화면이 없습니다.
3. SQL Editor에서 아래 이메일을 실제 계정 이메일로 바꿔 실행합니다.

```sql
insert into public.gallery_admins (user_id)
select id from auth.users where email = '실제운영자@example.com'
on conflict (user_id) do nothing;
```

등록 여부는 다음 쿼리로 확인할 수 있습니다. 결과가 없으면 계정 이메일을 확인하세요.

```sql
select u.id, u.email
from public.gallery_admins a
join auth.users u on u.id = a.user_id;
```

권한을 회수하려면 다음을 실행합니다. Auth 계정을 지우는 것과는 별개입니다.

```sql
delete from public.gallery_admins
where user_id in (select id from auth.users where email = '실제운영자@example.com');
```

권한은 사용자 메타데이터나 이메일 문자열로 추정하지 않습니다. 별도 운영자 테이블에 등록된 사용자만 관리할 수 있습니다. [Supabase RLS 안내](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 4. 로컬 환경변수 연결

프로젝트 루트에서 `.env.example`을 `.env`로 복사하고 다음 값을 채웁니다.

```dotenv
VITE_SUPABASE_URL=https://실제프로젝트.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=실제_publishable_key
```

기존 anon key를 사용할 경우 `VITE_SUPABASE_PUBLISHABLE_KEY` 대신 `VITE_SUPABASE_ANON_KEY`를 설정합니다. 두 키를 모두 넣으면 publishable key가 우선합니다.

개발 서버를 중단한 뒤 `npm run dev`로 다시 시작합니다. 터미널에 표시된 주소 뒤에 `/#/admin`을 붙이고, 3단계의 이메일·비밀번호로 로그인합니다. `.env`는 Git에 커밋하지 않습니다.

## 전시실 이름 변경

관리자 화면의 **전시실 이름**에서 A/B/C 각각의 새 이름을 입력하고 **이름 저장**을 누릅니다. 공백만 있는 이름과 줄바꿈은 허용하지 않으며 최대 24자입니다. 이름이 바뀌어도 전시 위치 코드·사진·액자 배치는 유지됩니다.

변경한 이름은 전시실 입구, 미니맵, 현재 위치, 작품 상세, 전시실 필터와 위치 선택에 반영됩니다. 다른 전시관 창에서는 새로고침·창 재활성화 또는 주기적 갱신 시 반영됩니다. 이름 테이블이 아직 없거나 일시적으로 조회가 실패하면 방문자 화면은 기본 전시실 이름을 유지합니다.

관리자에서 전시관으로 돌아가면 `/`로 이동해 주소 끝의 해시가 제거됩니다.

## 5. 작품 등록

1. **새 작품**에서 전시 위치를 고릅니다. A/B/C 전시실의 정면·왼쪽·오른쪽 벽에 각각 4개 위치가 있습니다. 좌우는 로비에서 전시실로 입장하는 방향 기준입니다.
2. JPG/PNG/WebP 사진을 선택합니다. 원본 파일은 최대 10MB이며, 브라우저에서 긴 변 1,920px 이내로 조정하고 WebP로 변환해 저장합니다. WebP 출력이 지원되지 않는 브라우저는 PNG를 사용할 수 있습니다. 원본 파일은 별도로 보관하세요.
3. 제목·설명을 입력합니다. 기본은 비공개이며, **전시관에 공개**를 체크해 등록하면 방문자에게 보입니다.
4. **전시관 보기**로 돌아가 확인합니다. 이미 전시관을 열고 있는 방문자에게는 새로고침 또는 창 재활성화 시 변경 사항이 반영됩니다. 등록되지 않았거나 비공개인 위치는 사진·제목 없이 빈 액자로 표시됩니다.
5. 수정할 때는 목록에서 작품을 선택합니다. 새 사진을 선택하지 않으면 기존 사진을 유지합니다. 위치 변경·제목·설명·공개 여부 수정도 가능합니다.
6. 삭제 버튼을 누르면 한 번 더 확인하고, 작품 정보 삭제 후 사용하지 않는 사진 파일을 정리합니다.

동시에 다른 창에서 수정된 작품은 덮어쓰거나 삭제하지 않고 새로고침을 안내합니다. 업로드 후 DB 저장 실패 시 새 파일을 정리합니다. 네트워크 문제로 파일 정리에 실패한 경우 Storage에 사용하지 않는 파일이 남을 수 있습니다. 다른 작품이 사용하는 파일은 삭제 정책에서 보호합니다.

이미지는 1시간 유효한 서명 URL로 전달하고, 열린 전시관에서는 만료 전에 갱신합니다. 비공개로 바꾼 뒤에도 이미 발급된 이미지 URL은 최대 1시간 유효할 수 있습니다. [Storage 접근 제어 안내](https://supabase.com/docs/guides/storage/security/access-control)

## 6. Vercel 연결

Vercel 프로젝트의 **Settings → Environment Variables**에 동일한 Project URL과 publishable key를 추가합니다. 사용할 배포 환경에 적용한 뒤 **재배포**해야 합니다. Vite의 환경변수는 빌드 시 반영됩니다.

배포 주소에 `/#/admin`을 붙여 로그인하고 사진을 관리하면, 작품 변경은 Supabase에 저장되므로 사진이나 전시실 이름을 바꿀 때마다 소스를 재배포할 필요는 없습니다.

## 연결 후 확인할 동작

Supabase 프로젝트가 아직 없어 실서비스 Auth/DB/Storage 연동은 실행하지 못했습니다. 최초 설정 후 다음을 확인하세요.

- 로그아웃 상태의 시크릿 창: 공개 작품만 보이고 비공개 작품은 조회되지 않는지
- 운영자 목록에 없는 계정: 로그인해도 관리 화면 접근이 거절되는지
- 운영자: 사진 업로드, 공개 전환, 제목·설명·사진 교체, 위치 변경, 삭제가 되는지
- 같은 위치에 두 번 등록: 중복 오류로 차단되는지
- 두 관리자 창에서 같은 작품 수정: 이전 버전으로 저장한 쪽이 충돌 안내를 받는지
- 로그아웃 또는 권한 회수 후 DB/Storage 쓰기가 거절되는지

자동 검증은 이미지·메타데이터 검사, API 요청·실패 복구, 로그인 후 역할 확인·로그아웃 경쟁 상태를 포함합니다. API 테스트는 네트워크 응답을 대체하며 실제 Supabase RLS 실행 검증은 아닙니다.

## 이번 작업에 포함되지 않은 것

공개 방명록 등록용 Edge Function, 방명록 숨김·삭제, 앱 내 회원가입·비밀번호 재설정·MFA, 원본 사진 보관은 별도 구현 대상입니다. 운영자 비밀번호 관리는 현재 Supabase Dashboard에서 수행합니다.
