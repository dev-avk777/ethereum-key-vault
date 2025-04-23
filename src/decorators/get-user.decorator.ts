import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Decorator for getting authenticated user from request object.
 * This decorator can be used to extract user data from the request after JWT authentication.
 *
 * @example
 * // Using in controller method to get full user object
 * @Get('profile')
 * getProfile(@GetUser() user: User) {
 *   return user;
 * }
 *
 * @example
 * // Using to extract specific user property
 * @Get('email')
 * getEmail(@GetUser('email') email: string) {
 *   return { email };
 * }
 */
export const GetUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()

  if (!request.user) {
    return null
  }

  if (data) {
    return request.user[data]
  }

  return request.user
})
