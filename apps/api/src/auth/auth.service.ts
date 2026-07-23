import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthResponse, AuthUser } from '@inventory/contracts';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { env } from '../config/env';

const authUserInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithPermissions = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email, status: 'ACTIVE' },
      include: authUserInclude,
    });
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { include: authUserInclude },
      },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt <= new Date() ||
      stored.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException('Refresh token đã được sử dụng');
    }

    return this.issueSession(stored.user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { id: user.id, companyId: user.companyId, status: 'ACTIVE' },
    });
    if (!existing || !(await compare(currentPassword, existing.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }
    if (await compare(newPassword, existing.passwordHash)) {
      throw new UnauthorizedException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await hash(newPassword, 12) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          actorId: existing.id,
          entityType: 'User',
          entityId: existing.id,
          action: 'CHANGE_PASSWORD',
        },
      }),
    ]);
  }

  private async issueSession(user: UserWithPermissions): Promise<AuthResponse> {
    const authUser = this.toAuthUser(user);
    const accessToken = await this.jwt.signAsync(
      { ...authUser, sub: user.id },
      {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_TTL as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return { accessToken, refreshToken, user: authUser };
  }

  private toAuthUser(user: UserWithPermissions | User): AuthUser {
    const permissions =
      'userRoles' in user
        ? [
            ...new Set(
              user.userRoles.flatMap((userRole) =>
                userRole.role.rolePermissions.map(
                  (rolePermission) => rolePermission.permission.code,
                ),
              ),
            ),
          ]
        : [];
    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      fullName: user.fullName,
      permissions,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
