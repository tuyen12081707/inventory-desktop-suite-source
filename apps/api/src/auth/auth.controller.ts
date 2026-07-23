import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  LoginSchema,
  LogoutSchema,
  RefreshSchema,
  type AuthResponse,
  type AuthUser,
} from '@inventory/contracts';
import type { z } from 'zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { AuthService } from './auth.service';

type LoginInput = z.infer<typeof LoginSchema>;
type RefreshInput = z.infer<typeof RefreshSchema>;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodValidationPipe(LoginSchema)) input: LoginInput): Promise<AuthResponse> {
    return this.authService.login(input.email, input.password);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) input: RefreshInput): Promise<AuthResponse> {
    return this.authService.refresh(input.refreshToken);
  }

  @HttpCode(204)
  @Public()
  @Post('logout')
  async logout(@Body(new ZodValidationPipe(LogoutSchema)) input: RefreshInput): Promise<void> {
    await this.authService.logout(input.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
