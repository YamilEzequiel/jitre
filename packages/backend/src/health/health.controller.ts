import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Controller({ path: '', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('healthz')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  @ApiOkResponse({ description: 'Service is alive.' })
  liveness() {
    // Liveness only checks the process itself. Don't probe downstream
    // dependencies here — a transient DB hiccup must NOT cause an
    // orchestrator to restart the pod.
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  @Get('readyz')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — service can accept traffic' })
  @ApiOkResponse({ description: 'Service is ready to accept traffic.' })
  readiness() {
    // Readiness probes downstream dependencies. If any of these fail
    // the orchestrator should pull the pod out of rotation until it
    // recovers — without restarting it.
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.ping('redis'),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }
}
