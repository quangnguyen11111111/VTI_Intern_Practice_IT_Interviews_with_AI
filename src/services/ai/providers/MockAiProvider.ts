import { injectable } from 'tsyringe';
import { IAiProvider, InterviewSetupPayload, GeneratedQuestion, AnswerPayload, EvaluationResult } from '../../../domain/interview/types';

@injectable()
export class MockAiProvider implements IAiProvider {
  async generateQuestions(setupData: InterviewSetupPayload): Promise<GeneratedQuestion[]> {
    console.log(`[MockAI] Generating questions with data:`, setupData);
    // Simulate background work...
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    
    return [
      {
        order: 1,
        difficulty: 'Easy',
        content: { en: 'What is a variable?', vi: 'Biến là gì?' }
      },
      {
        order: 2,
        difficulty: 'Medium',
        content: { en: 'Explain closure in JavaScript.', vi: 'Giải thích closure trong JavaScript.' }
      },
      {
        order: 3,
        difficulty: 'Medium',
        content: { en: 'What is the difference between let and const?', vi: 'Sự khác biệt giữa let và const là gì?' }
      },
      {
        order: 4,
        difficulty: 'Hard',
        content: { en: 'Explain the event loop.', vi: 'Giải thích event loop.' }
      },
      {
        order: 5,
        difficulty: 'Hard',
        content: { en: 'How does prototypal inheritance work?', vi: 'Kế thừa nguyên mẫu (prototypal inheritance) hoạt động như thế nào?' }
      }
    ];
  }

  async evaluateAnswers(questions: any[], answers: AnswerPayload[]): Promise<EvaluationResult> {
    console.log(`[MockAI] Evaluating answers...`);
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    
    const evaluations = answers.map(ans => {
      const score = Math.floor(Math.random() * 10) + 1; // Random score 1-10
      return {
        questionId: ans.questionId,
        feedback: {
          en: `Mock feedback for answer: ${ans.candidateAnswer}. Score: ${score}/10.`,
          vi: `Nhận xét giả lập cho câu trả lời: ${ans.candidateAnswer}. Điểm: ${score}/10.`
        },
        score
      };
    });

    return {
      evaluations,
      overallScore: 8,
      learningPath: [
        {
          topic: 'JavaScript Fundamentals',
          priority: 'High',
          suggestion: 'Review closure and event loop.'
        }
      ]
    };
  }
}
