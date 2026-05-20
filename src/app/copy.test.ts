import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...collectFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

describe("Korean user-facing copy", () => {
  it("uses the preferred learner label in app source", () => {
    const bannedLearnerLabel = "학" + "생";
    const files = collectFiles(join(process.cwd(), "src", "app"));
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(bannedLearnerLabel));
    expect(offenders).toEqual([]);
  });

  it("does not mention legacy credential rules in app source", () => {
    const bannedTerms = ["전화" + "번호", "끝 " + "2자리", "끝 " + "4자리"];
    const files = collectFiles(join(process.cwd(), "src", "app"));
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return bannedTerms.some((term) => source.includes(term));
    });
    expect(offenders).toEqual([]);
  });
});
