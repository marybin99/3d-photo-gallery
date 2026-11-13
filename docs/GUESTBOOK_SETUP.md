# 공개 방명록 등록 연결

로그인 없이 별명과 글을 남길 수 있습니다. 글 조회는 기존 Supabase RLS를 사용하고, 등록은 `guestbook-submit` Edge Function과 서버 전용 DB 함수를 거칩니다. 브라우저에는 테이블 직접 쓰기 권한이나 서버 비밀 키를 주지 않습니다.

코드만 프런트엔드에 배포하면 서버 함수는 생성되지 않습니다. 다음 SQL·함수·허용 주소 설정을 함께 적용하세요.

## 1. SQL 적용

Supabase SQL Editor에서 먼저 [`supabase/schema.sql`](../supabase/schema.sql), 다음으로 [`supabase/guestbook-writing.sql`](../supabase/guestbook-writing.sql)을 실행합니다. 이미 방명록 테이블이 있으면 두 번째 파일만 추가 적용할 수 있습니다. 기존 글은 유지됩니다.

추가되는 구성은 서버 전용 `submit_guestbook` 함수, 등록 횟수 테이블, 중복 요청 확인 테이블입니다. 공개 클라이언트는 보이는 글을 조회할 수 있지만 이 함수나 보조 테이블에는 접근할 수 없습니다.

## 2. Edge Function 배포

프로젝트 루트에서 아래 명령을 실행합니다. `YOUR_PROJECT_REF`는 Supabase 프로젝트의 참조 ID로 바꿉니다. `https://YOUR_PROJECT_REF.supabase.co`의 해당 부분입니다.

```bash
npx supabase login
npx supabase functions deploy guestbook-submit --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

함수 소스는 `supabase/functions/guestbook-submit/`과 `supabase/functions/_shared/`에 있습니다. `supabase/config.toml`에도 이 함수만 `verify_jwt = false`로 지정했습니다. 방문자는 로그인하지 않으므로 사용자 JWT를 요구하지 않습니다. 서버는 요청 형식·허용 Origin·등록 제한 및 선택적 Turnstile 검증을 수행합니다. [Supabase 함수 인증 안내](https://supabase.com/docs/guides/functions/auth)

## 3. 허용 사이트 주소 설정

Supabase의 **Edge Functions → Secrets**에 다음 값을 추가합니다.

| 이름 | 값 예시 |
| --- | --- |
| `GUESTBOOK_ALLOWED_ORIGINS` | `https://내전시관.vercel.app,http://localhost:5174` |

예시를 실제 배포 주소로 바꿉니다. 권장 형식은 `https://도메인`이며 여러 주소는 쉼표 또는 줄바꿈으로 구분합니다. 함수는 설정값의 마지막 `/`와 따옴표·경로를 정리해 Origin 단위로 비교합니다. 이 보완은 최신 함수 코드를 재배포해야 반영됩니다. 개발 서버가 5173 등 다른 포트이면 그 주소도 정확히 추가합니다. Vercel의 임시 Preview 주소는 사용할 때 별도로 추가해야 합니다.

Supabase 호스팅 환경의 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 서버에서 사용합니다. 기본 service_role key를 사용하지 않는 프로젝트는 **Edge Function Secrets**에 `GUESTBOOK_SECRET_KEY`라는 이름으로 프로젝트의 서버용 secret key를 설정할 수 있습니다. 서버 키는 `VITE_*` 환경변수나 프런트엔드 코드에 넣지 않습니다.

기본 연결에는 추가 프런트엔드 환경변수가 필요 없습니다. 기존 Supabase URL과 publishable/anon key를 그대로 사용합니다.

## 4. 프런트엔드 배포와 확인

개발 서버에서는 수정 내용이 반영된 페이지를 새로 엽니다. 배포 사이트에서는 변경을 GitHub에 푸시하고 Vercel 빌드가 끝난 뒤 확인합니다.

1. 로비의 책을 눌러 방명록을 엽니다.
2. 별명과 글을 입력하고 **방명록 남기기**를 누릅니다.
3. 성공 안내와 새 글이 즉시 보이는지 확인합니다.
4. 다른 브라우저나 시크릿 창에서 같은 사이트를 열어 글이 보이는지 확인합니다.
5. 바로 다시 등록하면 1분 제한 안내가 나와야 합니다.

## 등록 제한과 실패 처리

- 별명 1~24자, 내용 1~280자. 공백만 있는 글은 등록할 수 없습니다.
- 같은 브라우저 식별자로 60초 간격, 한 시간 최대 5건.
- 전시관 전체 한 시간 최대 300건. 값은 `guestbook-writing.sql`의 함수에서 조정 후 다시 적용할 수 있습니다.
- 횟수 검사와 글 저장은 같은 DB 트랜잭션에서 잠금으로 처리합니다. Edge Function 인스턴스별 메모리 카운터를 사용하지 않습니다.
- 같은 폼에서 내용을 유지한 채 재시도하면 동일한 요청 ID를 사용해 중복 저장을 피합니다. 페이지를 새로 열거나 내용을 바꾸면 새 요청입니다.
- 네트워크 오류나 등록 제한 때는 작성한 내용을 지우지 않습니다.
- 자동 입력 방지용 숨김 필드를 확인합니다. 브라우저 식별자는 서버에서 HMAC으로 변환하며 원시 IP 주소를 수집하지 않습니다.

브라우저 식별자를 초기화하는 고급 봇까지 이 제한만으로 막을 수는 없습니다. 추가적인 봇 방지가 필요하면 아래 Turnstile 검증을 연결합니다. 전체 횟수 제한은 식별자 변경으로 우회되지 않습니다.

## 선택: Cloudflare Turnstile 연결

1. Cloudflare Turnstile에서 위젯을 만들고 실제 사이트 호스트와 개발용 `localhost`를 등록합니다.
2. **프런트엔드** `.env` 및 Vercel 환경변수에 `VITE_TURNSTILE_SITE_KEY`로 공개 site key를 추가하고 개발 서버 재시작/재배포합니다.
3. **Supabase Edge Function Secrets**에 `TURNSTILE_SECRET_KEY`로 secret key를 추가합니다.
4. 위젯의 방문자 인증 후 등록이 되는지 확인합니다. 서버는 인증 성공, `guestbook` action, 허용 사이트 hostname을 함께 확인합니다.

서버에 Turnstile secret을 설정하면 유효한 토큰 없이는 글을 등록할 수 없습니다. 따라서 프런트엔드 site key도 함께 설정해야 합니다. 두 키가 없으면 기본 등록 제한과 숨김 필드 검사를 사용합니다. 인증 토큰은 등록 시도 후 갱신합니다. [Turnstile 서버 검증 안내](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

## 오류 확인

- `404` 또는 함수 호출 실패: 함수가 같은 Supabase 프로젝트에 배포됐는지 확인합니다.
- `401`: 함수가 로그인 없는 공개 호출을 허용하도록 JWT 검사를 껐는지 확인합니다.
- `403` 또는 CORS 오류: `GUESTBOOK_ALLOWED_ORIGINS`에 현재 브라우저 주소의 Origin이 정확히 있는지 확인합니다.
- `429`: 등록 간격·시간당 한도에 도달했습니다.
- `500`: SQL 적용과 함수의 서버 키 설정을 확인합니다. `submit_guestbook`는 `service_role`만 실행할 수 있습니다.
- 방문자 인증 오류: site key·secret key가 같은 위젯의 키인지, 실제 호스트가 등록되어 있는지 확인합니다.

관리자 화면의 **방명록 관리**에서 글을 숨기거나 다시 공개하고 삭제할 수 있습니다. 추가 DB 권한 설정은 [관리자 설정 안내의 방명록 관리 연결](ADMIN_SETUP.md#방명록-관리-연결)을 참고하세요.

## 검증 범위

자동 테스트는 입력 검증, 요청 크기·Origin 검사, HMAC 식별자, 서버 오류·등록 제한 응답, 선택적 CAPTCHA 검증, 프런트엔드의 Edge 호출 경로를 확인합니다. 네트워크 응답과 DB 쓰기는 테스트에서 대체합니다. 실제 Edge 배포, SQL의 실행·경쟁 상태, 실제 Cloudflare 인증과 모바일 입력은 서비스 연결 후 확인해야 합니다.

## CORS 사전 요청이 차단될 때

브라우저의 `No Access-Control-Allow-Origin` 문구만으로는 Origin 불일치, JWT 거절, 함수 누락·시작 실패를 구분할 수 없습니다. Network 탭의 **OPTIONS 요청 상태와 응답**을 확인하거나 터미널에서 아래 읽기 전용 검사를 실행합니다. 이 요청은 글을 등록하지 않습니다.

```bash
curl -i -X OPTIONS \
  -H 'Origin: http://localhost:5174' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: apikey,content-type,x-client-info' \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/guestbook-submit'
```

정상은 `204`와 `Access-Control-Allow-Origin: http://localhost:5174`입니다.

- `403`: **Edge Functions → Secrets**의 `GUESTBOOK_ALLOWED_ORIGINS`에 실제 Origin이 들어 있는지 확인합니다.
- `401`: 해당 함수의 **Verify JWT with legacy secret**을 끄거나 `--no-verify-jwt`로 배포합니다.
- `404`: 같은 프로젝트에 `guestbook-submit` 이름으로 배포됐는지 확인합니다.
- `503` 또는 `BOOT_ERROR`: 함수의 시작 로그와 `handler.ts`, `_shared/guestbook.ts`를 포함해 배포했는지 확인합니다.

Auth의 Site URL/Redirect URL 설정은 Edge Function의 Origin 설정과 별개입니다. 프런트엔드의 오류 표시는 HTTP 상태와 네트워크 연결 실패를 구분하도록 보완했습니다.
