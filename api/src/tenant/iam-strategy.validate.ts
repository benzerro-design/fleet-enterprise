import { BadRequestException } from '@nestjs/common';
import type { IamStrategyNode, IamStrategyPayload } from './iam-strategy.types';
import {
  IAM_STRATEGY_MAX_DEPTH,
  IAM_STRATEGY_MAX_NODES,
} from './iam-strategy.types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseNode(raw: unknown, depth: number, counter: { n: number }): IamStrategyNode {
  if (depth > IAM_STRATEGY_MAX_DEPTH) {
    throw new BadRequestException(`Adâncime maximă ${IAM_STRATEGY_MAX_DEPTH} depășită`);
  }
  if (!isRecord(raw)) throw new BadRequestException('Nod invalid');

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const levelLabel = typeof raw.levelLabel === 'string' ? raw.levelLabel.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!id || !levelLabel || !title) {
    throw new BadRequestException('Fiecare nod necesită id, levelLabel și title');
  }

  counter.n += 1;
  if (counter.n > IAM_STRATEGY_MAX_NODES) {
    throw new BadRequestException(`Maxim ${IAM_STRATEGY_MAX_NODES} noduri`);
  }

  const node: IamStrategyNode = { id, levelLabel, title };

  if (typeof raw.subtitle === 'string' && raw.subtitle.trim()) node.subtitle = raw.subtitle.trim();
  if (typeof raw.examples === 'string' && raw.examples.trim()) node.examples = raw.examples.trim();
  if (typeof raw.badge === 'string' && raw.badge.trim()) node.badge = raw.badge.trim();
  if (typeof raw.profileCode === 'string' && raw.profileCode.trim()) {
    node.profileCode = raw.profileCode.trim();
  }

  if (raw.status === 'live' || raw.status === 'planificat' || raw.status === 'viitor') {
    node.status = raw.status;
  }
  if (
    raw.tone === 'platform' ||
    raw.tone === 'tenant' ||
    raw.tone === 'client' ||
    raw.tone === 'driver' ||
    raw.tone === 'partner' ||
    raw.tone === 'finance' ||
    raw.tone === 'tech' ||
    raw.tone === 'logistics' ||
    raw.tone === 'full' ||
    raw.tone === 'neutral'
  ) {
    node.tone = raw.tone;
  }
  if (raw.branchStyle === 'solid' || raw.branchStyle === 'dashed') {
    node.branchStyle = raw.branchStyle;
  }

  if (Array.isArray(raw.children) && raw.children.length > 0) {
    node.children = raw.children.map((c) => parseNode(c, depth + 1, counter));
  }

  return node;
}

export function parseIamStrategyPayload(body: unknown): IamStrategyPayload {
  if (!isRecord(body)) throw new BadRequestException('Body invalid');
  if (!Array.isArray(body.nodes)) throw new BadRequestException('nodes[] obligatoriu');

  const counter = { n: 0 };
  const nodes = body.nodes.map((n) => parseNode(n, 1, counter));

  const ids = new Set<string>();
  function walk(list: IamStrategyNode[]) {
    for (const n of list) {
      if (ids.has(n.id)) throw new BadRequestException(`ID duplicat: ${n.id}`);
      ids.add(n.id);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);

  return { version: 1, nodes };
}

export function isIamStrategyPayload(raw: unknown): raw is IamStrategyPayload {
  try {
    parseIamStrategyPayload(raw);
    return true;
  } catch {
    return false;
  }
}

export function parseStoredIamStrategy(raw: unknown): IamStrategyNode[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return parseIamStrategyPayload({ version: 1, nodes: raw }).nodes;
  }
  if (isRecord(raw) && Array.isArray(raw.nodes)) {
    return parseIamStrategyPayload(raw).nodes;
  }
  return null;
}
