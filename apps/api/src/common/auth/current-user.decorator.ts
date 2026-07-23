import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@inventory/contracts';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
