export type ChallengeLevel = "basic" | "advanced";

/** 23기 기술트리 티어. 1=기초(1점), 2=활용(1.25점), 3=심화(1.5점). */
export type ChallengeTier = 1 | 2 | 3;

export function normalizeChallengeTier(tier: number | string | null | undefined): ChallengeTier {
  const n = typeof tier === "string" ? Number(tier) : tier;
  return n === 2 || n === 3 ? n : 1;
}

export function challengeTierLabel(tier: ChallengeTier): string {
  return tier === 3 ? "심화 T3" : tier === 2 ? "활용 T2" : "기초 T1";
}

export interface EditableChallengeInput {
  title: string;
  description?: string | null;
  detail?: string | null;
  level?: string | null;
  area?: string | null;
}

export interface NormalizedChallengeUpdateInput {
  title: string;
  description: string | null;
  detail: string | null;
  level: ChallengeLevel;
  area: ChallengeAreaKey | null;
}

export interface ChallengeWithLevel {
  level?: string | null;
}

export interface ChallengeWithTitle extends ChallengeWithLevel {
  title: string;
  area?: string | null;
}

export type ChallengeAreaKey =
  | "start"
  | "channel"
  | "automation"
  | "content"
  | "operations"
  | "integrations"
  | "orchestration"
  | "build"
  | "voice-ui"
  | "edge"
  | "other";

export interface ChallengeAreaDefinition {
  key: ChallengeAreaKey;
  label: string;
  description: string;
}

export interface ChallengeAreaGroup<T> extends ChallengeAreaDefinition {
  items: T[];
}

const CHALLENGE_AREA_KEYS = [
  "start",
  "channel",
  "automation",
  "content",
  "operations",
  "integrations",
  "orchestration",
  "build",
  "voice-ui",
  "edge",
  "other",
] as const satisfies readonly ChallengeAreaKey[];

export const CHALLENGE_AREA_OPTIONS: ChallengeAreaDefinition[] = [
  { key: "start", label: "시작 준비", description: "설치, 성격 설정, 기억 가꾸기" },
  { key: "channel", label: "대화 채널", description: "텔레그램·슬랙·디스코드 등 대화 창구 넓히기" },
  { key: "content", label: "일상 작업 맡기기", description: "요약, 사진 분석, 정리 같은 실전 요청" },
  { key: "automation", label: "자동화 루틴", description: "크론잡, 브리핑, 감시 — 알아서 일하게 만들기" },
  { key: "operations", label: "점검·유지보수", description: "진단, 복구, 업데이트, 상시 운영" },
  { key: "integrations", label: "외부 서비스 연동", description: "구글, 노션, 옵시디언, MCP, 브라우저 붙이기" },
  { key: "orchestration", label: "에이전트 협업", description: "봇끼리 대화하고 작업을 나눠보기" },
  { key: "build", label: "만들고 탐색하기", description: "스킬, 웹 페이지, 모델 실험" },
  { key: "voice-ui", label: "음성으로 확장", description: "TTS 팟캐스트, 음성 메모 파이프라인" },
  { key: "edge", label: "주의해서 실험", description: "리스크를 이해하고 도전하는 담대한 과제" },
  { key: "other", label: "기타", description: "아직 영역을 정하지 않은 과제" },
];

const BASIC_AREA_DEFINITIONS: ChallengeAreaDefinition[] = CHALLENGE_AREA_OPTIONS.filter((area) =>
  ["start", "channel", "automation", "content", "operations", "other"].includes(area.key),
);

const ADVANCED_AREA_DEFINITIONS: ChallengeAreaDefinition[] = CHALLENGE_AREA_OPTIONS.filter((area) =>
  ["integrations", "orchestration", "build", "voice-ui", "edge", "other"].includes(area.key),
);

export function normalizeChallengeArea(area: string | null | undefined): ChallengeAreaKey | null {
  return CHALLENGE_AREA_KEYS.includes(area as ChallengeAreaKey) ? (area as ChallengeAreaKey) : null;
}

export function challengeAreaLabel(area: ChallengeAreaKey): string {
  return CHALLENGE_AREA_OPTIONS.find((definition) => definition.key === area)?.label ?? "기타";
}

export function normalizeChallengeLevel(level: string | null | undefined): ChallengeLevel {
  return level === "advanced" ? "advanced" : "basic";
}

export function challengeLevelLabel(level: ChallengeLevel): string {
  return level === "advanced" ? "고급 과제" : "기본 과제";
}

export function groupChallengesByLevel<T extends ChallengeWithLevel>(items: readonly T[]): {
  basic: T[];
  advanced: T[];
} {
  const grouped: { basic: T[]; advanced: T[] } = { basic: [], advanced: [] };
  for (const item of items) {
    grouped[normalizeChallengeLevel(item.level)].push(item);
  }
  return grouped;
}

export function getChallengeArea(item: ChallengeWithTitle): ChallengeAreaKey {
  const storedArea = normalizeChallengeArea(item.area);
  if (storedArea) return storedArea;

  const title = item.title.toLowerCase().replace(/\s+/g, " ");
  const level = normalizeChallengeLevel(item.level);

  if (level === "basic") {
    if (
      title.includes("설치") ||
      title.includes("soul") ||
      title.includes("대시보드")
    ) {
      return "start";
    }
    if (
      title.includes("텔레그램") ||
      title.includes("두번째") ||
      title.includes("두 번째") ||
      title.includes("구글 이메일") ||
      title.includes("캘린더")
    ) {
      return "channel";
    }
    if (title.includes("크론") || title.includes("날씨") || title.includes("일정 보고")) {
      return "automation";
    }
    if (
      title.includes("폴더") ||
      title.includes("유튜브") ||
      title.includes("요약") ||
      title.includes("이미지")
    ) {
      return "content";
    }
    if (
      title.includes("심폐소생술") ||
      title.includes("검문소") ||
      title.includes("유지 보수") ||
      title.includes("업데이트")
    ) {
      return "operations";
    }
    return "other";
  }

  if (
    title.includes("k-skill") ||
    title.includes("rtk") ||
    title.includes("옵시디언") ||
    title.includes("슬랙") ||
    title.includes("디스코드") ||
    title.includes("카카오톡") ||
    title.includes("클로드 cli")
  ) {
    return "integrations";
  }
  if (
    title.includes("봇투봇") ||
    title.includes("session_send") ||
    title.includes("칸반") ||
    title.includes("그룹톡")
  ) {
    return "orchestration";
  }
  if (
    title.includes("대시보드") ||
    title.includes("llm-wiki") ||
    title.includes("모델") ||
    title.includes("검은소") ||
    title.includes("누렁소") ||
    title.includes("프레젠테이션") ||
    title.includes("ppt") ||
    title.includes("발표자료")
  ) {
    return "build";
  }
  if (title.includes("tts") || title.includes("목소리") || title.includes("gui") || title.includes("팟캐스트")) {
    return "voice-ui";
  }
  if (title.includes("자동 결제")) {
    return "edge";
  }
  return "other";
}

/**
 * 기술트리 표시용 그룹핑: 레벨 구분 없이 모든 가지(area)를 정의 순서대로 묶는다.
 * 입력이 이미 (tier, order_index) 순으로 정렬되어 있으면 그룹 안에서도 그 순서가 유지된다.
 */
export function groupChallengesForTree<T extends ChallengeWithTitle>(
  items: readonly T[],
): ChallengeAreaGroup<T>[] {
  const grouped = new Map<ChallengeAreaKey, T[]>();
  for (const definition of CHALLENGE_AREA_OPTIONS) grouped.set(definition.key, []);
  for (const item of items) {
    const area = getChallengeArea(item);
    grouped.set(area, [...(grouped.get(area) ?? []), item]);
  }
  return CHALLENGE_AREA_OPTIONS.map((definition) => ({
    ...definition,
    items: grouped.get(definition.key) ?? [],
  })).filter((section) => section.items.length > 0);
}

export function groupChallengesByArea<T extends ChallengeWithTitle>(
  level: ChallengeLevel,
  items: readonly T[],
): ChallengeAreaGroup<T>[] {
  const definitions = level === "advanced" ? ADVANCED_AREA_DEFINITIONS : BASIC_AREA_DEFINITIONS;
  const grouped = new Map<ChallengeAreaKey, T[]>();
  for (const definition of definitions) grouped.set(definition.key, []);

  for (const item of items) {
    const area = getChallengeArea(item);
    grouped.set(area, [...(grouped.get(area) ?? []), item]);
  }

  return definitions
    .map((definition) => ({
      ...definition,
      items: grouped.get(definition.key) ?? [],
    }))
    .filter((section) => section.items.length > 0);
}

export function normalizeChallengeUpdateInput(input: EditableChallengeInput): NormalizedChallengeUpdateInput {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    detail: input.detail?.trim() || null,
    level: normalizeChallengeLevel(input.level),
    area: normalizeChallengeArea(input.area),
  };
}
