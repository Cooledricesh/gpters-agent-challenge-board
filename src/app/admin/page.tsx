/**
 * 관리자 페이지 — 요약, 수강생 진척도(낮은 순), 챌린지·수강생 추가/관리 폼.
 *
 * 가드: admin 세션 필수.
 * 수강생 목록은 닉네임 노출. 공개 페이지와 정렬 방향이 반대.
 */

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { loadAllStudentProgress, toAdminView } from "@/lib/stats";
import { challengeLevelLabel, groupChallengesByLevel, type ChallengeLevel } from "@/lib/challenges";
import { loadChallengesOrdered, type ChallengeRowWithLevel } from "@/lib/load-challenges";
import { formatWeightedScore } from "@/lib/progress";
import AddChallengeForm from "./add-challenge-form";
import AddStudentForm from "./add-student-form";
import EditChallengeForm from "./edit-challenge-form";
import StudentActions from "./student-actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession("admin");
  if (!session) redirect("/login");

  const client = getSupabaseServiceClient();
  const [students, { data: challengeRows, error: chErr }, { data: completions, error: coErr }] =
    await Promise.all([
      loadAllStudentProgress(client),
      loadChallengesOrdered(client),
      client.from("completions").select("user_id, challenge_id"),
    ]);

  if (chErr || coErr) {
    return (
      <section className="py-12 text-center">
        <p className="text-sm text-red-600">데이터 로드 실패: {chErr?.message ?? coErr?.message}</p>
      </section>
    );
  }

  const adminView = toAdminView(students);
  const totalStudents = students.length;
  const totalCompletions = students.reduce((s, r) => s + r.completedCount, 0);
  const avgWeightedScore =
    totalStudents === 0
      ? 0
      : students.reduce((s, r) => s + r.weightedScore, 0) / totalStudents;

  const byChallenge = new Map<string, number>();
  const challengeTitleById = new Map(challengeRows.map((challenge) => [challenge.id, challenge.title]));
  const completedTitlesByStudent = new Map<string, string[]>();
  for (const row of (completions ?? []) as { user_id: string; challenge_id: string }[]) {
    byChallenge.set(row.challenge_id, (byChallenge.get(row.challenge_id) ?? 0) + 1);
    const title = challengeTitleById.get(row.challenge_id);
    if (title) {
      const titles = completedTitlesByStudent.get(row.user_id) ?? [];
      titles.push(title);
      completedTitlesByStudent.set(row.user_id, titles);
    }
  }
  const groupedChallenges = groupChallengesByLevel(challengeRows);

  return (
    <div className="flex flex-col gap-8 py-4">
      <header>
        <h1 className="text-2xl font-semibold">관리자</h1>
        <p className="mt-1 text-sm text-zinc-500">
          수강생 닉네임이 노출됩니다. 진척이 느린 수강생을 위에서 확인하세요.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="수강생" value={`${totalStudents}명`} />
        <Card label="챌린지" value={`${challengeRows.length}개`} />
        <Card label="완료 누적" value={`${totalCompletions}회`} />
        <Card label="평균 가중 점수" value={formatWeightedScore(avgWeightedScore)} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">수강생 진척도 (낮은 순 우선)</h2>
        {adminView.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 등록된 수강생이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">익명 라벨</th>
                  <th className="px-3 py-2">닉네임</th>
                  <th className="px-3 py-2">완료</th>
                  <th className="px-3 py-2">달성 챌린지</th>
                  <th className="px-3 py-2">가중 점수</th>
                  <th className="px-3 py-2">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {adminView.map((s) => {
                  const completedTitles = completedTitlesByStudent.get(s.id) ?? [];
                  return (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">{s.anonymousLabel}</td>
                      <td className="px-3 py-2 font-medium">{s.nickname}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                        {s.completedCount}/{s.totalChallenges}
                      </td>
                      <td className="max-w-xs px-3 py-2">
                        {completedTitles.length === 0 ? (
                          <span className="text-xs text-zinc-400">아직 없음</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {completedTitles.map((title) => (
                              <span
                                key={`${s.id}-${title}`}
                                className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-right tabular-nums">{formatWeightedScore(s.weightedScore)}</span>
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className="h-full bg-indigo-500"
                              style={{ width: `${Math.max(0, Math.min(100, s.progressPercent))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <StudentActions id={s.id} nickname={s.nickname} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">챌린지별 완료</h2>
        {challengeRows.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 등록된 챌린지가 없습니다.</p>
        ) : (
          <div className="space-y-5">
            <AdminChallengeSection
              level="basic"
              challenges={groupedChallenges.basic}
              byChallenge={byChallenge}
              totalStudents={totalStudents}
            />
            <AdminChallengeSection
              level="advanced"
              challenges={groupedChallenges.advanced}
              byChallenge={byChallenge}
              totalStudents={totalStudents}
            />
          </div>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold">챌린지 추가</h3>
          <AddChallengeForm />
        </div>
        <div className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold">수강생 추가</h3>
          <AddStudentForm />
        </div>
      </section>
    </div>
  );
}

function AdminChallengeSection({
  level,
  challenges,
  byChallenge,
  totalStudents,
}: {
  level: ChallengeLevel;
  challenges: ChallengeRowWithLevel[];
  byChallenge: Map<string, number>;
  totalStudents: number;
}) {
  if (challenges.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-base font-semibold">{challengeLevelLabel(level)}</h3>
      <ul className="space-y-2">
        {challenges.map((c) => {
          const completed = byChallenge.get(c.id) ?? 0;
          return (
            <li
              key={c.id}
              className="rounded border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <span className="font-medium">{c.title}</span>
                  {c.description && (
                    <p className="mt-0.5 text-xs text-zinc-500 whitespace-pre-line">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-start gap-3">
                  <span className="pt-1 text-zinc-500 tabular-nums">
                    {completed}/{totalStudents}
                  </span>
                  <EditChallengeForm
                    id={c.id}
                    initialTitle={c.title}
                    initialDescription={c.description}
                    initialDetail={c.detail}
                    initialLevel={c.level}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
