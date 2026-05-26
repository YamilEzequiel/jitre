import { HttpException, HttpStatus } from '@nestjs/common';

export class BudgetExceededException extends HttpException {
  constructor(spent: string, budget: number) {
    super(
      {
        message: `Daily AI budget exceeded: spent ${spent} USD of ${budget} USD limit`,
        code: 'AI_BUDGET_EXCEEDED',
        spent,
        budget,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
