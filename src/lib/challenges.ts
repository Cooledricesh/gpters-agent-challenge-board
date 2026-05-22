export type ChallengeLevel = "basic" | "advanced";

export interface EditableChallengeInput {
  title: string;
  description?: string | null;
  detail?: string | null;
  level?: string | null;
}

export interface NormalizedChallengeUpdateInput {
  title: string;
  description: string | null;
  detail: string | null;
  level: ChallengeLevel;
}

export interface ChallengeWithLevel {
  level?: string | null;
}

export interface ChallengeWithTitle extends ChallengeWithLevel {
  title: string;
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

const BASIC_AREA_DEFINITIONS: ChallengeAreaDefinition[] = [
  { key: "start", label: "시작 준비", description: "설치, 대시보드, 기본 성격 설정" },
  { key: "channel", label: "연결하기", description: "텔레그램과 구글 계정 연결" },
  { key: "automation", label: "자동화 루틴", description: "정해진 시간에 알아서 보고받기" },
  { key: "content", label: "일상 작업 맡기기", description: "요약, 정리, 이미지 생성 같은 실전 요청" },
  { key: "operations", label: "점검·유지보수", description: "진단, 복구, 업데이트로 안정화" },
  { key: "other", label: "기타", description: "아직 영역을 정하지 않은 기본 과제" },
];

const ADVANCED_AREA_DEFINITIONS: ChallengeAreaDefinition[] = [
  { key: "integrations", label: "외부 도구 연결", description: "노트, 메신저, CLI, 확장 기능 붙이기" },
  { key: "orchestration", label: "에이전트 협업", description: "봇끼리 대화하고 작업을 나눠보기" },
  { key: "build", label: "만들고 탐색하기", description: "대시보드, 지식체계, 모델 실험" },
  { key: "voice-ui", label: "음성·화면 자동화", description: "TTS와 GUI 자동화로 경험 확장" },
  { key: "edge", label: "주의해서 실험", description: "위험하거나 의도가 강한 실험" },
  { key: "other", label: "기타", description: "아직 영역을 정하지 않은 고급 과제" },
];

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
    title.includes("누렁소")
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
  };
}
