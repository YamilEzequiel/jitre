import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../request-context/request-context.service';
import { DateRangeHelper } from './helpers/date-range.helper';
import { AiUsageQuery } from './ai-queries/ai-usage.query';
import { AiUsageByUserQuery } from './ai-queries/ai-usage-by-user.query';
import { AiUsageByOperationQuery } from './ai-queries/ai-usage-by-operation.query';
import { AiUsageFailureRateQuery } from './ai-queries/ai-usage-failure-rate.query';
import type {
  AiUsagePointDto,
  AiUsageByUserDto,
  AiUsageByOperationDto,
  AiFailureRatePointDto,
} from './dto';
import type { AnalyticsPeriod } from './helpers/time-bucket.helper';

@Injectable()
export class AiAnalyticsService {
  constructor(
    private readonly aiUsageQuery: AiUsageQuery,
    private readonly aiUsageByUserQuery: AiUsageByUserQuery,
    private readonly aiUsageByOperationQuery: AiUsageByOperationQuery,
    private readonly aiUsageFailureRateQuery: AiUsageFailureRateQuery,
    private readonly requestContext: RequestContextService,
  ) {}

  private get workspaceId(): string {
    return this.requestContext.getWorkspaceId() ?? '';
  }

  async aiUsage(input: {
    period: AnalyticsPeriod;
    from: string;
    to: string;
  }): Promise<AiUsagePointDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.aiUsageQuery.execute({
      workspaceId: this.workspaceId,
      ...input,
    });
  }

  async aiUsageByUser(input: {
    from: string;
    to: string;
  }): Promise<AiUsageByUserDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.aiUsageByUserQuery.execute({
      workspaceId: this.workspaceId,
      ...input,
    });
  }

  async aiUsageByOperation(input: {
    from: string;
    to: string;
  }): Promise<AiUsageByOperationDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.aiUsageByOperationQuery.execute({
      workspaceId: this.workspaceId,
      ...input,
    });
  }

  async aiUsageFailureRate(input: {
    period: AnalyticsPeriod;
    from: string;
    to: string;
  }): Promise<AiFailureRatePointDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.aiUsageFailureRateQuery.execute({
      workspaceId: this.workspaceId,
      ...input,
    });
  }
}
