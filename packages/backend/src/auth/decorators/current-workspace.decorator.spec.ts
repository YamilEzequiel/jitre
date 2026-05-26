import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentWorkspace } from './current-workspace.decorator';

function getParamDecoratorFactory(decorator: () => ParameterDecorator) {
  class TestController {
    test(@decorator() _ws: unknown) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
  const key = Object.keys(args)[0];
  return args[key].factory as (data: unknown, ctx: ExecutionContext) => unknown;
}

describe('@CurrentWorkspace decorator', () => {
  it('should return workspaceId from x-workspace-id header', () => {
    const factory = getParamDecoratorFactory(CurrentWorkspace);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-workspace-id': 'ws-uuid-123' },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, ctx);
    expect(result).toBe('ws-uuid-123');
  });

  it('should return undefined when x-workspace-id header is missing', () => {
    const factory = getParamDecoratorFactory(CurrentWorkspace);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, ctx);
    expect(result).toBeUndefined();
  });
});
