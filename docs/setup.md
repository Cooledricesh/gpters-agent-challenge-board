# 지피터스 반려 에이전트 챌린지 보드 — setup/deploy notes

이 애플리케이션은 NAS API와 NAS PostgreSQL만 사용합니다. 브라우저나 Vercel 함수가 PostgreSQL에 직접 연결하지 않습니다.

```text
Browser → Vercel Next.js → Cloudflare Tunnel → NAS API → NAS PostgreSQL (gpters_challenge_board)
```

## 필수 환경변수

로컬 `.env.local` 및 Vercel Project Settings에 아래 서버 전용 값을 설정합니다.

```bash
NAS_API_BASE_URL="https://gpters-api.rebridge.work"
NAS_API_SERVICE_TOKEN="긴_서비스_토큰"
MUTATIONS_PAUSED="false"
ADMIN_PASSWORD="관리자_비밀번호"
SESSION_SECRET="긴_랜덤_문자열_32자_이상"
```

- `NAS_API_SERVICE_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`은 클라이언트에 노출하거나 커밋하지 않습니다.
- `NAS_API_BASE_URL`은 Production에서 HTTPS여야 합니다.
- Vercel Production·Preview의 주 경로는 전용 Cloudflare hostname을 사용합니다. 기존 `https://baclava-nas.tailb06fb8.ts.net/gpters-api`는 운영 롤백 값이며 기본 주 경로로 되돌리지 않습니다.
- 긴급 점검 시 `MUTATIONS_PAUSED=true`로 애플리케이션 mutation을 차단할 수 있습니다.
- 데이터 원본은 NAS PostgreSQL의 `gpters_challenge_board` 하나뿐입니다.

## 관리자 및 수강생 흐름

1. `/login`에서 관리자 또는 수강생 닉네임과 비밀번호로 로그인합니다.
2. 관리자는 `/admin`에서 수강생과 챌린지를 관리합니다.
3. 수강생은 `/my`에서 챌린지 완료 여부를 체크합니다.
4. 공개 `/` 페이지에는 익명 라벨과 진행률만 표시됩니다.

## 배포

1. GitHub 저장소를 Vercel 프로젝트에 연결합니다.
2. Framework Preset은 Next.js로 둡니다.
3. 위 환경변수를 Production에 설정합니다.
4. 배포 후 공개 페이지와 로그인 페이지를 확인합니다.
5. 운영 요청이 NAS API의 `GET /v1/board`로 도달하는지 로그로 검증합니다.
6. Cloudflare tunnel 요청 카운터와 NAS API 로그를 함께 확인해 canonical 요청이 새 ingress를 통과했는지 검증합니다.

## 로컬 확인

```bash
npm install
npm test
npm run lint
npm run build
```

## 데이터 백업과 복원

NAS PostgreSQL 플랫폼의 `dbctl backup`과 프로젝트별 restore drill을 사용합니다. JSON 마이그레이션 스크립트나 외부 DB fallback은 운영 복구 수단이 아닙니다.
