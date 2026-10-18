import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MembershipRole } from '@prisma/client';
import { ClientRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export type ClientPortalMode = 'fleet' | 'driver';

export type JwtPayload = {
  sub: string;
  tenantSlug: string;
  email?: string;
  role?: MembershipRole;
  /** Set for client_user: fleet = manager; driver = șofer cu flotă redusă. */
  clientPortal?: ClientPortalMode;
  /** Set for supplier_user — portal partener. */
  partnerPortal?: boolean;
};

export type AuthTenantOption = {
  slug: string;
  name: string;
  role: MembershipRole;
};

export type LoginResult =
  | { accessToken: string }
  | { requiresTenant: true; tenants: AuthTenantOption[] };

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private mapTenantOptions(
    memberships: Array<{ role: MembershipRole; tenant: { slug: string; name: string } }>,
  ): AuthTenantOption[] {
    return memberships
      .map((m) => ({
        slug: m.tenant.slug,
        name: m.tenant.name,
        role: m.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }

  private async buildPayload(input: {
    userId: string;
    email: string;
    tenantId: string;
    tenantSlug: string;
    role: MembershipRole;
  }): Promise<JwtPayload> {
    const payload: JwtPayload = {
      sub: input.userId,
      tenantSlug: input.tenantSlug,
      email: input.email,
      role: input.role,
    };

    if (input.role === 'client_user') {
      const clientMemberships = await this.prisma.clientMembership.findMany({
        where: { userId: input.userId, tenantId: input.tenantId },
        select: { role: true },
      });
      const driverOnly =
        clientMemberships.length > 0 &&
        clientMemberships.every((m) => m.role === ClientRole.driver);
      payload.clientPortal = driverOnly ? 'driver' : 'fleet';
    }

    if (input.role === 'supplier_user') {
      payload.partnerPortal = true;
    }

    return payload;
  }

  async login(
    email: string,
    password: string,
    tenantSlugInput: string | undefined,
  ): Promise<LoginResult> {
    const emailNorm = email?.trim().toLowerCase();
    if (!emailNorm) {
      throw new BadRequestException('email is required');
    }
    if (!password) {
      throw new BadRequestException('password is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: emailNorm },
      include: { memberships: { include: { tenant: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.disabledAt) {
      throw new UnauthorizedException('Cont dezactivat. Contactează administratorul abonatului.');
    }

    const memberships = user.memberships;
    if (memberships.length === 0) {
      throw new UnauthorizedException('User has no tenant access');
    }

    let resolvedSlug = (tenantSlugInput ?? '').trim();
    if (!resolvedSlug) {
      if (memberships.length === 1) {
        resolvedSlug = memberships[0].tenant.slug;
      } else {
        // PARTNER-018 / multi-abonat: UI alege din listă după parolă validă.
        return {
          requiresTenant: true,
          tenants: this.mapTenantOptions(memberships),
        };
      }
    }

    const membership = memberships.find((m) => m.tenant.slug === resolvedSlug);
    if (!membership) {
      throw new UnauthorizedException('Invalid tenant for this user');
    }

    const payload = await this.buildPayload({
      userId: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      tenantSlug: resolvedSlug,
      role: membership.role,
    });
    return { accessToken: this.jwt.sign(payload) };
  }

  /** PARTNER-018 — listă abonați pentru userul autentificat. */
  async listTenantsForUser(userId: string): Promise<{ tenants: AuthTenantOption[] }> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId },
      include: { tenant: { select: { slug: true, name: true } } },
    });
    return { tenants: this.mapTenantOptions(memberships) };
  }

  /** PARTNER-018 — reînnoiește JWT pe alt abonat (aceeași sesiune). */
  async switchTenant(userId: string, tenantSlugInput: string): Promise<{ accessToken: string }> {
    const slug = tenantSlugInput?.trim();
    if (!slug) {
      throw new BadRequestException('tenantSlug is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, disabledAt: true },
    });
    if (!user || user.disabledAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenant: { slug } },
      include: { tenant: { select: { id: true, slug: true } } },
    });
    if (!membership) {
      throw new UnauthorizedException('Invalid tenant for this user');
    }

    const payload = await this.buildPayload({
      userId: user.id,
      email: user.email,
      tenantId: membership.tenant.id,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
    });
    return { accessToken: this.jwt.sign(payload) };
  }
}
