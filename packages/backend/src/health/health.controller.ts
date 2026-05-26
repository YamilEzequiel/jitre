import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller({ path: '', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('healthz')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  @ApiOkResponse({ description: 'Service is alive.' })
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  @Get('readyz')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — service can accept traffic' })
  @ApiOkResponse({ description: 'Service is ready to accept traffic.' })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }
}
