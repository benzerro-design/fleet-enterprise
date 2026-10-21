import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const GRID_VIEW_KEYS = ['tickets', 'work_orders'] as const;
export type GridViewKey = (typeof GRID_VIEW_KEYS)[number];
export const DEFAULT_GRID_VIEW_NAME = '__default__';

function assertGridKey(gridKey: string): GridViewKey {
  if (!GRID_VIEW_KEYS.includes(gridKey as GridViewKey)) {
    throw new BadRequestException(`gridKey must be one of: ${GRID_VIEW_KEYS.join(', ')}`);
  }
  return gridKey as GridViewKey;
}

@Injectable()
export class GridViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefault(userId: string, tenantId: string, gridKey: string) {
    assertGridKey(gridKey);
    const row = await this.prisma.userGridView.findUnique({
      where: {
        userId_gridKey_name: { userId, gridKey, name: DEFAULT_GRID_VIEW_NAME },
      },
      select: { layout: true, updatedAt: true },
    });
    return {
      gridKey,
      name: DEFAULT_GRID_VIEW_NAME,
      layout: row?.layout ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  async upsertDefault(userId: string, tenantId: string, gridKey: string, layout: unknown) {
    assertGridKey(gridKey);
    if (layout == null || typeof layout !== 'object' || Array.isArray(layout)) {
      throw new BadRequestException('layout must be a JSON object');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.userGridView.upsert({
      where: {
        userId_gridKey_name: { userId, gridKey, name: DEFAULT_GRID_VIEW_NAME },
      },
      create: {
        tenantId,
        userId,
        gridKey,
        name: DEFAULT_GRID_VIEW_NAME,
        layout: layout as Prisma.InputJsonValue,
      },
      update: {
        layout: layout as Prisma.InputJsonValue,
      },
      select: { layout: true, updatedAt: true },
    });

    return {
      gridKey,
      name: DEFAULT_GRID_VIEW_NAME,
      layout: row.layout,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
