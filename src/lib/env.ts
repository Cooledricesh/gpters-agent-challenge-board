/**
 * env.ts — 서버 환경변수 안전 로드.
 * 누락된 키는 명확한 에러 메시지를 던져 디버깅을 쉽게 한다.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. .env.local 또는 배포 환경변수를 확인하세요.`,
    );
  }
  return value;
}

/**
 * 서버 전용 환경변수. 클라이언트 컴포넌트에서 import 금지.
 * 동적 getter로 감싸 호출 시점에만 검증한다(빌드 시 누락 검증 회피).
 */
export const serverEnv = {
  get adminPassword(): string {
    return required("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
  },
  get sessionSecret(): string {
    return required("SESSION_SECRET", process.env.SESSION_SECRET);
  },
  get mutationsPaused(): boolean {
    const value = process.env.MUTATIONS_PAUSED ?? "false";
    if (value !== "true" && value !== "false") {
      throw new Error("MUTATIONS_PAUSED must be 'true' or 'false'.");
    }
    return value === "true";
  },
  get nasApiBaseUrl(): string {
    const value = required("NAS_API_BASE_URL", process.env.NAS_API_BASE_URL);
    const url = new URL(value);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error("NAS_API_BASE_URL must use HTTPS in production.");
    }
    return url.toString().replace(/\/$/, "");
  },
  get nasApiServiceToken(): string {
    return required("NAS_API_SERVICE_TOKEN", process.env.NAS_API_SERVICE_TOKEN);
  },
};
