import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  tenantSlug: string;
  email?: string;
  role?: MembershipRole;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(
    email: string,
    password: string,
    tenantSlugInput: string | undefined,
  ): Promise<{ accessToken: string }> {
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

    const memberships = user.memberships;
    if (memberships.length === 0) {
      throw new UnauthorizedException('User has no tenant access');
    }

    let resolvedSlug = (tenantSlugInput ?? '').trim();
    if (!resolvedSlug) {
      if (memberships.length === 1) {
        resolvedSlug = memberships[0].tenant.slug;
      } else {
        throw new BadRequestException(
          'tenantSlug is required when the user belongs to more than one tenant',
        );
      }
    }

    const membership = memberships.find((m) => m.tenant.slug === resolvedSlug);
    if (!membership) {
      throw new UnauthorizedException('Invalid tenant for this user');
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantSlug: resolvedSlug,
      email: user.email,
      role: membership.role,
    };
    const accessToken = this.jwt.sign(payload);
    return { accessToken };
  }
}
