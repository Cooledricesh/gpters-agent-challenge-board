/**
 * tech-tree.ts — prerequisite_id 사슬을 실제 트리 구조로 변환한다.
 * 시각 트리 뷰(/, /my)가 사용. 단위 테스트: tech-tree.test.ts
 */

export interface TreeSourceItem {
  id: string;
  prerequisiteId: string | null;
  tier: number;
}

export interface TreeNode<T extends TreeSourceItem> {
  item: T;
  children: TreeNode<T>[];
}

/**
 * 평평한 목록 → 뿌리 목록(보통 1개). 자식은 (tier, 입력 순서)로 정렬해
 * 얕은 가지가 위에 오게 한다. 고아(선행 id가 목록에 없음)는 뿌리로 승격시켜
 * 데이터 오류가 있어도 화면에서 사라지지 않게 한다.
 */
export function buildChallengeTree<T extends TreeSourceItem>(items: readonly T[]): TreeNode<T>[] {
  const ids = new Set(items.map((it) => it.id));
  const nodeById = new Map<string, TreeNode<T>>(
    items.map((it) => [it.id, { item: it, children: [] }]),
  );

  const roots: TreeNode<T>[] = [];
  for (const it of items) {
    const node = nodeById.get(it.id)!;
    if (it.prerequisiteId && ids.has(it.prerequisiteId)) {
      nodeById.get(it.prerequisiteId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (node: TreeNode<T>) => {
    node.children.sort((a, b) => a.item.tier - b.item.tier);
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);
  return roots;
}

/** 트리 전체 노드 수(테스트·완주 표시용). */
export function countTreeNodes<T extends TreeSourceItem>(nodes: readonly TreeNode<T>[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countTreeNodes(n.children), 0);
}
