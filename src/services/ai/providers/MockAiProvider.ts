import { injectable } from 'tsyringe';

import {
  IAiProvider,
  InterviewSetupPayload,
  GeneratedQuestion,
  AnswerPayload,
  EvaluationResult,
  AiUsageMetadata,
  SystemPromptContext,
  LearningPathResult
} from '../../../domain/interview/types';

@injectable()
export class MockAiProvider
  implements IAiProvider
{
  async generateQuestions(
    setupData: InterviewSetupPayload,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: GeneratedQuestion[];
    audit: AiUsageMetadata;
  }> {
    console.log(
      '[MockAI] Generating questions with data:',
      setupData
    );

    if (systemPrompt) {
      console.log(
        `[MockAI] Using generation prompt version ${systemPrompt.version}`
      );
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 2000)
    );

    const data: GeneratedQuestion[] = [
      {
        order: 1,
        difficulty: 'Easy',
        content: {
          en: 'What is a variable?',
          vi: 'Biến là gì?'
        }
      },
      {
        order: 2,
        difficulty: 'Medium',
        content: {
          en: 'Explain closure in JavaScript.',
          vi: 'Giải thích closure trong JavaScript.'
        }
      },
      {
        order: 3,
        difficulty: 'Medium',
        content: {
          en: 'What is the difference between let and const?',
          vi: 'Sự khác biệt giữa let và const là gì?'
        }
      },
      {
        order: 4,
        difficulty: 'Hard',
        content: {
          en: 'Explain the event loop.',
          vi: 'Giải thích event loop trong JavaScript.'
        }
      },
      {
        order: 5,
        difficulty: 'Hard',
        content: {
          en: 'How does prototypal inheritance work?',
          vi: 'Kế thừa nguyên mẫu hoạt động như thế nào?'
        }
      }
    ];

    return {
      data,
      audit: {
        promptTokenCount: 10,
        candidatesTokenCount: 50,
        totalTokenCount: 60
      }
    };
  }

  async evaluateAnswers(
    questions: any[],
    answers: AnswerPayload[],
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: EvaluationResult;
    audit: AiUsageMetadata;
  }> {
    console.log(
      '[MockAI] Evaluating answers...'
    );

    if (systemPrompt) {
      console.log(
        `[MockAI] Using evaluation prompt version ${systemPrompt.version}`
      );
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 2000)
    );

    const evaluations =
      answers.map((ans) => {
        const score =
          Math.floor(
            Math.random() * 10
          ) + 1;

        return {
          questionId: ans.questionId,
          feedback: {
            en: `Mock feedback for answer: ${ans.candidateAnswer}. Score: ${score}/10.`,
            vi: `Nhận xét giả lập cho câu trả lời: ${ans.candidateAnswer}. Điểm: ${score}/10.`
          },
          score
        };
      });

    const data: EvaluationResult = {
      evaluations,
      overallScore: 8,
      learningPath: [
        {
          topic:
            'JavaScript Fundamentals',
          priority: 'High',
          suggestion:
            'Review closure and event loop.'
        }
      ]
    };

    return {
      data,
      audit: {
        promptTokenCount: 20,
        candidatesTokenCount: 100,
        totalTokenCount: 120
      }
    };
  }

  async generateLearningPath(
    questions: any[],
    answers: AnswerPayload[],
    evaluation: EvaluationResult,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: LearningPathResult;
    audit: AiUsageMetadata;
  }> {
    console.log(
      '[MockAI] Generating learning path...'
    );

    if (systemPrompt) {
      console.log(
        `[MockAI] Using learning-path prompt version ${systemPrompt.version}`
      );
    }

    /*
     * Keep the parameters referenced so the mock
     * remains compatible with the real provider contract.
     */
    void questions;
    void answers;

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 1000)
    );

    return {
      data: {
        learningPath:
          evaluation.learningPath
      },
      audit: {
        promptTokenCount: 10,
        candidatesTokenCount: 30,
        totalTokenCount: 40
      }
    };
  }
}