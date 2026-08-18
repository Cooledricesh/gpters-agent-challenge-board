import type { ChallengeAreaKey, ChallengeLevel, ChallengeTier } from "@/lib/challenges";

export type DataBackend = "supabase" | "nas";

export interface StudentDataRow {
  id: string;
  nickname: string;
  role: string;
  anonymous_label: string | null;
  anonymous_index: number | null;
}

export interface AuthUserDataRow {
  id: string;
  nickname: string;
  role: string;
  password_hash: string | null;
}

export interface ChallengeDataRow {
  id: string;
  title: string;
  description: string | null;
  detail: string | null;
  order_index: number;
  level: ChallengeLevel;
  area: ChallengeAreaKey | null;
  tier: ChallengeTier;
  prerequisite_id: string | null;
}

export interface ExampleDataRow {
  id: string;
  challenge_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_author: string | null;
}

export interface CompletionDataRow {
  id?: string;
  user_id: string;
  challenge_id: string;
  completed_at?: string;
}

export interface CreateStudentInput {
  nickname: string;
  passwordHash: string;
}

export interface CreateChallengeInput {
  title: string;
  description?: string | null;
  detail?: string | null;
  level?: ChallengeLevel;
  area?: ChallengeAreaKey | null;
  tier?: ChallengeTier;
  prerequisiteId?: string | null;
}

export interface UpdateChallengeInput extends Partial<CreateChallengeInput> {
  id: string;
}

export interface DataRepository {
  listStudents(): Promise<StudentDataRow[]>;
  listChallenges(): Promise<ChallengeDataRow[]>;
  listExamples(): Promise<ExampleDataRow[]>;
  listCompletions(userId?: string): Promise<CompletionDataRow[]>;
  findUserByNickname(nickname: string): Promise<AuthUserDataRow | null>;
  toggleCompletion(input: { userId: string; challengeId: string; done: boolean }): Promise<void>;
  createStudent(input: CreateStudentInput): Promise<{
    id: string;
    nickname: string;
    anonymous_label: string | null;
    anonymous_index: number | null;
  }>;
  updateStudentPassword(input: { id: string; passwordHash: string }): Promise<{ id: string; nickname: string } | null>;
  deleteStudent(id: string): Promise<{ id: string; nickname: string } | null>;
  createChallenge(input: CreateChallengeInput): Promise<Record<string, unknown>>;
  updateChallenge(input: UpdateChallengeInput): Promise<Record<string, unknown> | null>;
}
