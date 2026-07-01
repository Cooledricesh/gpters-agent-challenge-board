/**
 * case-note.mjs — 옵시디언 사례글 노트(.md) 파서.
 *
 * 노트 구조(22기 반려 에이전트 사례글):
 *   ---
 *   type: article
 *   aliases: [ - ... ]
 *   tags: [ - ... ]
 *   source_url: https://...
 *   source_author: <원작자>
 *   status: completed
 *   ---
 *   # <제목>
 *   ## 핵심 요약
 *   <요약 문단>
 *   ## 사용한 도구
 *   - <도구>
 *
 * 전체 YAML을 파싱하지 않고 필요한 필드만 line 기반으로 뽑는다(의존성 없음).
 */

/** frontmatter 블록(첫 `---`~두 번째 `---`)과 본문을 분리한다. */
export function splitFrontmatter(raw) {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: "", body: raw };
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      return { frontmatter: lines.slice(1, i).join("\n"), body: lines.slice(i + 1).join("\n") };
    }
  }
  return { frontmatter: "", body: raw };
}

/** frontmatter에서 `key: value` 스칼라를 읽는다(따옴표 제거). 없으면 null. */
export function scalarField(frontmatter, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = frontmatter.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if (!v) return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

/** `key:` 아래 `  - item` 목록을 읽는다. */
export function listField(frontmatter, key) {
  const lines = frontmatter.split("\n");
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (new RegExp(`^${key}:\\s*$`).test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const m = line.match(/^\s+-\s+(.*)$/);
      if (m) {
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        out.push(v);
      } else if (/^\S/.test(line)) {
        // 다음 최상위 키를 만나면 목록 종료.
        break;
      }
    }
  }
  return out;
}

/** 본문에서 특정 `## 제목` 섹션 내용을 다음 `## `(또는 끝)까지 뽑는다. */
export function section(body, heading) {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return "";
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

/** `## 제목` 섹션의 `- ` bullet 목록. */
export function sectionList(body, heading) {
  return section(body, heading)
    .split("\n")
    .map((l) => l.match(/^-\s+(.*)$/)?.[1]?.trim())
    .filter((v) => v);
}

/** 본문 첫 `# ` 제목. */
export function h1Title(body) {
  const m = body.match(/^#\s+(.*)$/m);
  return m ? m[1].trim() : null;
}

/**
 * 사례글 노트 한 개를 파싱한다.
 * @param {string} raw - 노트 파일 전체 텍스트
 * @param {string} file - 파일명(제목 폴백용)
 * @returns 구조화된 사례 메타. 사례글이 아니면(예: _index) null.
 */
export function parseCaseNote(raw, file) {
  const { frontmatter, body } = splitFrontmatter(raw);
  const type = scalarField(frontmatter, "type");
  const sourceUrl = scalarField(frontmatter, "source_url");
  // 사례글은 type: article + source_url 보유. 인덱스/기타 노트는 제외.
  if (type !== "article" || !sourceUrl) return null;

  const title = h1Title(body) || listField(frontmatter, "aliases")[0] || file.replace(/\.md$/, "");
  return {
    file,
    title,
    summary: section(body, "핵심 요약") || null,
    tools: sectionList(body, "사용한 도구"),
    tags: listField(frontmatter, "tags"),
    sourceUrl,
    sourceAuthor: scalarField(frontmatter, "source_author"),
  };
}
