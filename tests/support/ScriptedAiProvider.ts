import {
  AiUsageMetadata,
  AnswerPayload,
  EvaluationResult,
  GeneratedQuestion,
  IAiProvider,
  InterviewSetupPayload
} from '../../src/domain/interview/types';

export class ControllableBarrier {
  private releaseBarrier!: () => void;
  readonly reached: Promise<void>;
  readonly wait: Promise<void>;

  constructor() {
    let markReached!: () => void;
    this.reached = new Promise((resolve) => { markReached = resolve; });
    this.wait = new Promise((resolve) => { this.releaseBarrier = resolve; });
    this.markReached = markReached;
  }

  private readonly markReached: () => void;

  async hold(): Promise<void> {
    this.markReached();
    await this.wait;
  }

  release(): void {
    this.releaseBarrier();
  }
}

type ProviderResult<T> = { data: T; audit: AiUsageMetadata };
type GenerateOutcome =
  | ProviderResult<GeneratedQuestion[]>
  | Error
  | ((setup: InterviewSetupPayload) => ProviderResult<GeneratedQuestion[]> | Promise<ProviderResult<GeneratedQuestion[]>>);
type EvaluateOutcome =
  | ProviderResult<EvaluationResult>
  | Error
  | ((questions: any[], answers: AnswerPayload[]) => ProviderResult<EvaluationResult> | Promise<ProviderResult<EvaluationResult>>);

export const generationUsage: AiUsageMetadata = {
  promptTokenCount: 10,
  candidatesTokenCount: 50,
  totalTokenCount: 60
};

export const evaluationUsage: AiUsageMetadata = {
  promptTokenCount: 20,
  candidatesTokenCount: 70,
  totalTokenCount: 90
};

export const validQuestions = (): GeneratedQuestion[] => Array.from({ length: 5 }, (_, index) => ({
  order: index + 1,
  difficulty: index < 2 ? 'Easy' : index < 4 ? 'Medium' : 'Hard',
  category: `category-${index + 1}`,
  content: { en: `Question ${index + 1}`, vi: `Câu hỏi ${index + 1}` }
}));

export const validEvaluation = (questions: any[]): EvaluationResult => ({
  evaluations: questions.map((question, index) => ({
    questionId: question._id?.toString() || question.id,
    feedback: { en: `Feedback ${index + 1}`, vi: `Nhận xét ${index + 1}` },
    score: 8 - index
  })),
  overallScore: 0,
  dimensions: [
    { name: 'TECHNICAL_ACCURACY', score: 8, reasoning: 'Accurate answers' },
    { name: 'PROBLEM_SOLVING', score: 7, reasoning: 'Sound approach' },
    { name: 'COMMUNICATION', score: 9, reasoning: 'Clear explanations' },
    { name: 'PRACTICAL_APPLICATION', score: 6, reasoning: 'Useful examples' }
  ],
  learningPath: [{
    topic: { en: 'Concurrency', vi: 'Tương tranh' },
    priority: 'High',
    suggestion: { en: 'Practise race tests', vi: 'Thực hành kiểm thử race' }
  }]
});

export class ScriptedAiProvider implements IAiProvider {
  generateCalls = 0;
  evaluateCalls = 0;

  constructor(
    private readonly generateOutcomes: GenerateOutcome[] = [],
    private readonly evaluateOutcomes: EvaluateOutcome[] = []
  ) {}

  async generateQuestions(setup: InterviewSetupPayload): Promise<ProviderResult<GeneratedQuestion[]>> {
    this.generateCalls += 1;
    const outcome = this.generateOutcomes.shift() ?? { data: validQuestions(), audit: generationUsage };
    if (outcome instanceof Error) throw outcome;
    return typeof outcome === 'function' ? outcome(setup) : outcome;
  }

  async evaluateAnswers(
    questions: any[],
    answers: AnswerPayload[]
  ): Promise<ProviderResult<EvaluationResult>> {
    this.evaluateCalls += 1;
    const outcome = this.evaluateOutcomes.shift() ?? {
      data: validEvaluation(questions),
      audit: evaluationUsage
    };
    if (outcome instanceof Error) throw outcome;
    return typeof outcome === 'function' ? outcome(questions, answers) : outcome;
  }
}
