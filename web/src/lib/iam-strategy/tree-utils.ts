import type { IamStrategyNode } from "./types";

export type NodeLocation = {
  list: IamStrategyNode[];
  index: number;
  node: IamStrategyNode;
  parent: IamStrategyNode | null;
};

function cloneNodes(nodes: IamStrategyNode[]): IamStrategyNode[] {
  return JSON.parse(JSON.stringify(nodes)) as IamStrategyNode[];
}

export function findNodeLocation(
  nodes: IamStrategyNode[],
  id: string,
  parent: IamStrategyNode | null = null,
): NodeLocation | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === id) return { list: nodes, index, node, parent };
    if (node.children?.length) {
      const found = findNodeLocation(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

export function updateNodeInTree(
  nodes: IamStrategyNode[],
  id: string,
  patch: Partial<IamStrategyNode>,
): IamStrategyNode[] {
  const next = cloneNodes(nodes);
  const loc = findNodeLocation(next, id);
  if (!loc) return nodes;
  loc.list[loc.index] = { ...loc.list[loc.index], ...patch };
  return next;
}

export function deleteNodeFromTree(nodes: IamStrategyNode[], id: string): IamStrategyNode[] {
  const next = cloneNodes(nodes);
  const loc = findNodeLocation(next, id);
  if (!loc) return nodes;
  loc.list.splice(loc.index, 1);
  return next;
}

export function addRootNode(nodes: IamStrategyNode[], node: IamStrategyNode): IamStrategyNode[] {
  return [...cloneNodes(nodes), node];
}

export function addChildNode(
  nodes: IamStrategyNode[],
  parentId: string,
  node: IamStrategyNode,
): IamStrategyNode[] {
  const next = cloneNodes(nodes);
  const loc = findNodeLocation(next, parentId);
  if (!loc) return nodes;
  const children = loc.list[loc.index].children ?? [];
  loc.list[loc.index].children = [...children, node];
  return next;
}

export function addSiblingAfter(
  nodes: IamStrategyNode[],
  siblingId: string,
  node: IamStrategyNode,
): IamStrategyNode[] {
  const next = cloneNodes(nodes);
  const loc = findNodeLocation(next, siblingId);
  if (!loc) return nodes;
  loc.list.splice(loc.index + 1, 0, node);
  return next;
}

export function moveNode(
  nodes: IamStrategyNode[],
  id: string,
  direction: -1 | 1,
): IamStrategyNode[] {
  const next = cloneNodes(nodes);
  const loc = findNodeLocation(next, id);
  if (!loc) return nodes;
  const target = loc.index + direction;
  if (target < 0 || target >= loc.list.length) return nodes;
  const [item] = loc.list.splice(loc.index, 1);
  loc.list.splice(target, 0, item);
  return next;
}

export type DragPosition = "before" | "after" | "inside";

export function moveNodeRelative(
  nodes: IamStrategyNode[],
  dragId: string,
  targetId: string,
  position: DragPosition,
): IamStrategyNode[] {
  if (dragId === targetId) return nodes;

  const next = cloneNodes(nodes);
  const dragLoc = findNodeLocation(next, dragId);
  const targetLoc = findNodeLocation(next, targetId);
  if (!dragLoc || !targetLoc) return nodes;

  if (isDescendant(dragLoc.node, targetId)) return nodes;

  const [dragged] = dragLoc.list.splice(dragLoc.index, 1);
  const refreshedTarget = findNodeLocation(next, targetId);
  if (!refreshedTarget) return nodes;

  if (position === "inside") {
    const children = refreshedTarget.list[refreshedTarget.index].children ?? [];
    refreshedTarget.list[refreshedTarget.index].children = [...children, dragged];
    return next;
  }

  const insertAt = position === "before" ? refreshedTarget.index : refreshedTarget.index + 1;
  refreshedTarget.list.splice(insertAt, 0, dragged);
  return next;
}

function isDescendant(node: IamStrategyNode, targetId: string): boolean {
  if (!node.children?.length) return false;
  for (const child of node.children) {
    if (child.id === targetId) return true;
    if (isDescendant(child, targetId)) return true;
  }
  return false;
}

export function countNodes(nodes: IamStrategyNode[]): number {
  let n = 0;
  function walk(list: IamStrategyNode[]) {
    for (const node of list) {
      n += 1;
      if (node.children?.length) walk(node.children);
    }
  }
  walk(nodes);
  return n;
}
