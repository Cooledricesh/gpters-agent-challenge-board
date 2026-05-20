# 지피터스 반려 에이전트 챌린지 보드 — setup/deploy notes

짧은 운영 순서: Supabase 프로젝트를 만들고 `supabase/schema.sql`을 적용한 뒤, Vercel에 환경변수를 넣어 배포합니다.

## 1. Supabase 준비

1. Supabase에서 새 프로젝트를 생성합니다.
2. Project Settings → API에서 아래 값을 복사합니다.
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - publishable/anon key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - service role key → `SUPABASE_SERVICE_ROLE_KEY`
3. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
   - 테이블: `app_users`, `challenges`, `completions`
   - 비밀번호는 `password_hash`만 저장합니다.
   - 공개 페이지용 라벨은 `anonymous_label` (`챌린저 01` 등)입니다.
   - 이전 버전에서 만든 `phone_last2` 컬럼은 스키마 실행 시 제거됩니다.

## 2. 필수 환경변수

로컬 `.env.local`과 Vercel Project Settings → Environment Variables에 동일하게 설정합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
ADMIN_PASSWORD="5231"
SESSION_SECRET="긴_랜덤_문자열_32자_이상_권장"
```

중요:
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 비밀키입니다. 클라이언트에 노출하거나 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.
- `SESSION_SECRET`은 라이브 사용 전에 반드시 강한 랜덤 값으로 설정해야 합니다. 예: `openssl rand -base64 32`
- 기본 관리자 로그인은 닉네임 `admin`, 비밀번호 `5231`입니다. 실제 운영 전에는 `ADMIN_PASSWORD`를 바꾸는 것을 권장합니다.

## 3. 관리자 초기 사용

1. `/login`에서 닉네임 `admin`, 비밀번호 `ADMIN_PASSWORD`로 로그인합니다.
2. 첫 관리자 로그인 시 DB에 `admin` row가 없으면 앱이 자동 생성합니다.
3. `/admin`에서 수강생과 챌린지를 추가합니다.
   - 수강생: 아이디/닉네임 + 관리자가 정한 비밀번호를 입력합니다. 앱은 비밀번호 해시만 저장합니다.
   - 챌린지: 제목과 선택 설명을 입력합니다. 날짜는 없고 등록 순서(`order_index`)대로 표시됩니다.
4. 관리자 화면은 진행률이 낮은 수강생부터 보여 줍니다.
5. 잘못 만든 수강생은 관리자 화면에서 삭제할 수 있고, 비밀번호도 새 값으로 변경할 수 있습니다.

## 4. 수강생 사용 흐름

1. 수강생은 `/login`에서 본인 닉네임과 관리자가 알려준 비밀번호로 로그인합니다.
2. `/my`에서 본인 챌린지 완료 여부를 체크/해제합니다.
3. 공개 `/` 페이지에는 닉네임이 나오지 않고 `챌린저 01` 같은 익명 라벨과 진행률만 표시됩니다. 공개 정렬은 진행률 높은 순입니다.

## 5. Vercel 배포

1. GitHub repo를 Vercel에 Import합니다.
2. Framework Preset은 Next.js로 둡니다.
3. Environment Variables에 2번의 모든 값을 추가합니다.
   - Preview/Production 모두 같은 Supabase를 쓸지, 별도 Supabase를 쓸지 먼저 정하고 넣으세요.
4. Deploy를 실행합니다.
5. 배포 후 확인:
   - `/` 공개 페이지가 익명 라벨만 보여 주는지 확인
   - `/login` → admin 로그인
   - `/admin`에서 테스트 수강생/챌린지 추가
   - 수강생 계정으로 로그인해 `/my` 체크/해제 확인

## 6. 로컬 확인 명령

```bash
npm install
npm test
npm run lint
npm run build
```

현재 MVP 범위에는 메모, 링크, 사진 업로드, CSV 기능이 없습니다.
