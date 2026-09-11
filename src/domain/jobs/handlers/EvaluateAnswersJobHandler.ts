import { IJobHandler } from '../IJobHandler';
import { inject, injectable } from 'tsyringe';
import { InterviewOperationProcessor } from '../../../services/InterviewOperationProcessor';

interface EvaluateAnswersData {
  operationId: string;
}

@injectable()
export class EvaluateAnswersJobHandler implements IJobHandler<EvaluateAnswersData> {
  public readonly name = 'EVALUATE_ANSWERS';

  constructor(
    @inject(InterviewOperationProcessor) private processor: InterviewOperationProcessor
  ) {}

  async handle(data: EvaluateAnswersData): Promise<void> {
    await this.processor.process(data.operationId, 'SUBMIT_ANSWERS');
  }
}
