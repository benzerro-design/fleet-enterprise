import { Controller, Get, Header, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES } from '../iam/role-sets';
import { PartnerReportsService } from './partner-reports.service';

@Controller('partner/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerReportsController {
  constructor(private readonly reports: PartnerReportsService) {}

  /** PARTNER-016 — sumar lunar JSON. */
  @Get('monthly')
  @Roles(...FLEET_READ_ROLES)
  monthly(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
  ) {
    return this.reports.monthlySummary(tenantSlug, access, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      supplierId,
      suppliers,
    });
  }

  /** PARTNER-016 — export CSV pe lună (volum / valoare pe WO). */
  @Get('monthly.csv')
  @Roles(...FLEET_READ_ROLES)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async monthlyCsv(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
  ): Promise<StreamableFile> {
    const { filename, csv } = await this.reports.monthlyCsv(tenantSlug, access, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      supplierId,
      suppliers,
    });
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
