import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BotSessionStatus, BotFindingSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessContextService } from '../iam/access-context.service';
import { TripsService } from '../ops/trips.service';
import { BotGuardService } from './bot-guard.service';
import {
  BOT_FAULT_CATALOG,
  BOT_MODULE_REGISTRY,
  BOT_SCENARIO_PRESETS,
  getBotModule,
} from './bot-registry';
import type {
  BotFindingInput,
  BotFindingLink,
  BotFindingRecord,
  BotModuleOperations,
  BotRunConfig,
  BotSessionRecord,
  BotStepRecord,
  BotStepResult,
} from './bot.types';
import { runTripsBotModule, runTripFaultTests } from './modules/trips.bot-module';
import { runVehiclesBotModule } from './modules/vehicles.bot-module';

type StartSessionInput = {
  scenarioId?: string;
  division: BotRunConfig['division'];
  seed?: number;
  mode?: BotRunConfig['mode'];
  concurrentUsers?: number;
  modules: Record<string, BotModuleOperations>;
  faults?: string[];
};

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guard: BotGuardService,
    private readonly accessCtx: AccessContextService,
    private readonly trips: TripsService,
  ) {}

  getModules() {
    return {
      modules: BOT_MODULE_REGISTRY,
      scenarios: BOT_SCENARIO_PRESETS,
      faults: BOT_FAULT_CATALOG,
      constraints: {
        tenantSlug: 'demo',
        minRole: 'tenant_admin',
        multiUserNote:
          'concurrentUsers este stocat pentru simulări viitoare multi-user / mobile.',
        mobileNote: 'Modulele cu supportsMobile vor primi scenarii viewport în faza următoare.',
      },
      enabled: this.guard.isBotEnabled(),
      enabledHint: this.guard.isBotEnabled()
        ? null
        : 'Pe Cloud Run (NODE_ENV=production) setează BOT_ENABLED=true. Local funcționează fără flag.',
    };
  }

  async listSessions(tenantSlug: string, userId: string, limit = 20): Promise<BotSessionRecord[]> {
    await this.guard.assertCanRunBot(tenantSlug, userId);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return [];

    const rows = await this.prisma.botPopulationSession.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 50),
      include: {
        actor: { select: { email: true } },
        steps: true,
        findings: { orderBy: { id: 'asc' } },
      },
    });
    return rows.map((r) => this.toSessionRecord(r));
  }

  async getSession(tenantSlug: string, userId: string, sessionId: string): Promise<BotSessionRecord> {
    await this.guard.assertCanRunBot(tenantSlug, userId);
    const row = await this.prisma.botPopulationSession.findFirst({
      where: { id: sessionId, tenant: { slug: tenantSlug } },
      include: {
        actor: { select: { email: true } },
        steps: true,
        findings: { orderBy: { id: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Session not found');
    return this.toSessionRecord(row);
  }

  async startSession(
    tenantSlug: string,
    userId: string,
    input: StartSessionInput,
  ): Promise<BotSessionRecord> {
    const access = await this.guard.assertCanRunBot(tenantSlug, userId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } });

    const scenarioId = input.scenarioId?.trim() || 'custom';
    const seed = Math.max(1, input.seed ?? 42);
    const mode = input.mode ?? 'populate';
    const concurrentUsers = Math.max(1, Math.min(100, input.concurrentUsers ?? 1));

    const config: BotRunConfig = {
      scenarioId,
      division: input.division,
      seed,
      mode,
      concurrentUsers,
      modules: input.modules ?? {},
      faults: input.faults,
    };

    const session = await this.prisma.botPopulationSession.create({
      data: {
        tenantId: tenant.id,
        actorUserId: userId,
        scenarioId,
        division: input.division,
        seed,
        mode,
        concurrentUsers,
        config: config as object,
        status: BotSessionStatus.running,
      },
    });

    const findings: BotFindingInput[] = [];
    const onFinding = (f: BotFindingInput) => findings.push(f);

    const ctx = {
      tenantId: tenant.id,
      tenantSlug,
      actorUserId: userId,
      sessionId: session.id,
      division: input.division,
      seed,
      mode,
      concurrentUsers,
    };

    let anyFailed = false;
    let anySuccess = false;

    for (const [moduleId, ops] of Object.entries(config.modules)) {
      const def = getBotModule(moduleId);
      if (!def) continue;
      const hasWork =
        (ops.create ?? 0) > 0 || (ops.edit ?? 0) > 0 || (ops.delete ?? 0) > 0;
      if (!hasWork) continue;

      const started = Date.now();
      let stepResult: BotStepResult = {
        created: 0,
        edited: 0,
        deleted: 0,
        failed: 0,
        skipped: 0,
      };

      if (!def.implemented) {
        stepResult.skipped = (ops.create ?? 0) + (ops.edit ?? 0) + (ops.delete ?? 0);
        onFinding({
          moduleId,
          severity: 'info',
          message: `Modulul „${def.label}” nu este implementat încă — operațiile au fost sărite.`,
          links: [{ label: 'BOT Date', href: '/fleet/bot/date' }],
          remediation: 'Modulul va fi adăugat în registry fără schimbare UI.',
        });
      } else {
        try {
          if (moduleId === 'vehicles') {
            stepResult = await runVehiclesBotModule(this.prisma, ctx, ops, access, onFinding);
          } else if (moduleId === 'trips') {
            stepResult = await runTripsBotModule(this.prisma, this.trips, ctx, ops, access, onFinding);
          }
        } catch (e) {
          stepResult.failed++;
          onFinding({
            moduleId,
            severity: 'error',
            message: e instanceof Error ? e.message : 'Module run failed',
            links: [{ label: 'Raportare BOT', href: '/fleet/bot/raportare' }],
          });
        }
      }

      if (stepResult.failed > 0) anyFailed = true;
      if (stepResult.created + stepResult.edited + stepResult.deleted > 0) anySuccess = true;

      await this.prisma.botPopulationStep.create({
        data: {
          sessionId: session.id,
          moduleId,
          requested: ops as object,
          created: stepResult.created,
          edited: stepResult.edited,
          deleted: stepResult.deleted,
          failed: stepResult.failed,
          skipped: stepResult.skipped,
          durationMs: Date.now() - started,
          meta: stepResult.meta as object | undefined,
        },
      });
    }

    if (mode === 'fault_test' && input.faults?.length) {
      await runTripFaultTests(this.prisma, this.trips, ctx, input.faults, access, onFinding);
      if (input.faults.includes('rbac_viewer_write')) {
        await this.runRbacViewerFault(tenantSlug, ctx, onFinding);
      }
    }

    for (const f of findings) {
      await this.prisma.botPopulationFinding.create({
        data: {
          sessionId: session.id,
          moduleId: f.moduleId,
          severity: f.severity as BotFindingSeverity,
          faultId: f.faultId,
          expected: f.expected ?? false,
          message: f.message,
          links: (f.links ?? []) as object,
          remediation: f.remediation,
          entityRefs: f.entityRefs as object | undefined,
        },
      });
    }

    const unexpectedErrors = findings.filter(
      (f) => f.severity === 'error' && !f.expected,
    ).length;

    let status: BotSessionStatus = BotSessionStatus.success;
    if (unexpectedErrors > 0 && anySuccess) status = BotSessionStatus.partial;
    else if (unexpectedErrors > 0 || (anyFailed && !anySuccess)) status = BotSessionStatus.failed;
    else if (findings.some((f) => f.severity === 'warning')) status = BotSessionStatus.partial;

    const summary = this.buildSummary(status, findings, concurrentUsers);

    await this.prisma.botPopulationSession.update({
      where: { id: session.id },
      data: { status, finishedAt: new Date(), summary },
    });

    return this.getSession(tenantSlug, userId, session.id);
  }

  private async runRbacViewerFault(
    tenantSlug: string,
    ctx: { sessionId: string; tenantId: string },
    onFinding: (f: BotFindingInput) => void,
  ) {
    const viewer = await this.prisma.user.findUnique({
      where: { email: 'viewer@demo.local' },
    });
    if (!viewer) {
      onFinding({
        moduleId: 'trips',
        severity: 'warning',
        faultId: 'rbac_viewer_write',
        expected: true,
        message: 'viewer@demo.local lipsește — rulează db:seed',
        links: [{ label: 'Membri', href: '/fleet/members' }],
        remediation: 'npm run db:seed în api/',
      });
      return;
    }
    const viewerAccess = await this.accessCtx.resolve(viewer.id, tenantSlug);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    if (!vehicle) return;
    try {
      await this.trips.create(
        tenantSlug,
        {
          vehicleId: vehicle.id,
          reference: `BOT-FAULT-RBAC-${ctx.sessionId.slice(-4)}`,
          startedAt: new Date().toISOString(),
        },
        viewer.id,
        viewerAccess,
      );
      onFinding({
        moduleId: 'trips',
        severity: 'error',
        faultId: 'rbac_viewer_write',
        expected: true,
        message: 'Fault RBAC: viewer a putut crea cursă (neașteptat)',
        links: [
          { label: 'Membri', href: '/fleet/members' },
          { label: 'Audit', href: '/fleet/audit' },
        ],
        remediation: 'Verifică assertTripVehicleWrite pentru tenant_viewer.',
      });
    } catch (e) {
      onFinding({
        moduleId: 'trips',
        severity: 'expected',
        faultId: 'rbac_viewer_write',
        expected: true,
        message: `Fault RBAC: viewer respins corect — ${e instanceof Error ? e.message : '403'}`,
        links: [{ label: 'Audit', href: '/fleet/audit' }],
      });
    }
  }

  private buildSummary(
    status: BotSessionStatus,
    findings: BotFindingInput[],
    concurrentUsers: number,
  ): string {
    const errors = findings.filter((f) => f.severity === 'error' && !f.expected).length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    const expected = findings.filter((f) => f.expected).length;
    return `Status ${status}; erori ${errors}, avertismente ${warnings}, fault așteptate ${expected}; concurrentUsers=${concurrentUsers} (rezervat viitor).`;
  }

  private toSessionRecord(row: {
    id: string;
    scenarioId: string;
    division: string;
    seed: number;
    mode: string;
    status: BotSessionStatus;
    concurrentUsers: number;
    impersonatedAs: string | null;
    summary: string | null;
    config: unknown;
    startedAt: Date;
    finishedAt: Date | null;
    actor?: { email: string };
    steps: Array<{
      id: string;
      moduleId: string;
      requested: unknown;
      created: number;
      edited: number;
      deleted: number;
      failed: number;
      skipped: number;
      durationMs: number;
      meta: unknown;
    }>;
    findings: Array<{
      id: string;
      moduleId: string;
      severity: BotFindingSeverity;
      faultId: string | null;
      expected: boolean;
      message: string;
      links: unknown;
      remediation: string | null;
      entityRefs: unknown;
    }>;
  }): BotSessionRecord {
    return {
      id: row.id,
      scenarioId: row.scenarioId,
      division: row.division,
      seed: row.seed,
      mode: row.mode,
      status: row.status,
      concurrentUsers: row.concurrentUsers,
      impersonatedAs: row.impersonatedAs,
      summary: row.summary,
      config: row.config as BotRunConfig,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      actorEmail: row.actor?.email,
      steps: row.steps.map(
        (s): BotStepRecord => ({
          id: s.id,
          moduleId: s.moduleId,
          requested: s.requested as BotModuleOperations,
          created: s.created,
          edited: s.edited,
          deleted: s.deleted,
          failed: s.failed,
          skipped: s.skipped,
          durationMs: s.durationMs,
          meta: s.meta as Record<string, unknown> | null,
        }),
      ),
      findings: row.findings.map(
        (f): BotFindingRecord => ({
          id: f.id,
          moduleId: f.moduleId,
          severity: f.severity,
          faultId: f.faultId,
          expected: f.expected,
          message: f.message,
          links: (f.links as BotFindingLink[]) ?? [],
          remediation: f.remediation,
          entityRefs: f.entityRefs as BotFindingRecord['entityRefs'],
        }),
      ),
    };
  }
}
