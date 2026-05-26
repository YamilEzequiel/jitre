import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

// Helper to extract the factory from a createParamDecorator
function getParamDecoratorFactory(decorator: () => ParameterDecorator) {
  class TestController {
    test(@decorator() _user: unknown) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
  const key = Object.keys(args)[0];
  return args[key].factory as (data: unknown, ctx: ExecutionContext) => unknown;
}

describe('@CurrentUser decorator', () => {
  it('should return the user object stored in request.user', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const user = { id: 'user-1', email: 'test@example.com' };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, ctx);
    expect(result).toEqual(user);
    expect((result as { id: string }).id).toBe('user-1');
  });

  it('should return null when request.user is not set', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, ctx);
    expect(result).toBeUndefined();
  });
});
