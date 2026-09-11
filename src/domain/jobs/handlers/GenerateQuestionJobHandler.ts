import { IJobHandler } from '../IJobHandler';
import { inject, injectable } from 'tsyringe';
import { InterviewOperationProcessor } from '../../../services/InterviewOperationProcessor';

interface GenerateQuestionData {
  operationId: string;
}

@injectable()
export class GenerateQuestionJobHandler implements IJobHandler<GenerateQuestionData> {
  public readonly name = 'GENERATE_QUESTIONS';

  constructor(
    @inject(InterviewOperationProcessor) private processor: InterviewOperationProcessor
  ) {}

  async handle(data: GenerateQuestionData): Promise<void> {
    await this.processor.process(data.operationId, 'GENERATE_QUESTIONS');
  }
}
