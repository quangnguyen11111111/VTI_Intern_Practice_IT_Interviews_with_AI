import { injectable } from 'tsyringe';
import { IAiProvider, InterviewSetupPayload, GeneratedQuestion, AnswerPayload, EvaluationResult, AiUsageMetadata } from '../../../domain/interview/types';

@injectable()
export class MockAiProvider implements IAiProvider {
  async generateQuestions(setupData: InterviewSetupPayload): Promise<{ data: GeneratedQuestion[], audit: AiUsageMetadata }> {
    console.log(`[MockAI] Generating questions with data:`, setupData);
    // Simulate background work...
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    
    const data = [
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

    return {
      data,
      audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 }
    };
  }

  async evaluateAnswers(questions: any[], answers: AnswerPayload[]): Promise<{ data: EvaluationResult, audit: AiUsageMetadata }> {
    console.log(`[MockAI] Evaluating answers...`);
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    
    const evaluations = questions.map(q => {
      const questionId = q._id?.toString() || q.id;
      const ans = answers.find(a => a.questionId === questionId);
      
      let score = Math.floor(Math.random() * 10) + 1; // Random score 1-10
      if (ans?.candidateAnswer?.includes('[System]')) {
         score = 0;
      }

      return {
        questionId,
        feedback: {
          en: `Mock feedback for answer: ${ans?.candidateAnswer}. Score: ${score}/10.`,
          vi: `Nhận xét giả lập cho câu trả lời: ${ans?.candidateAnswer}. Điểm: ${score}/10.`
        },
        score
      };
    });

    const data: EvaluationResult = {
      evaluations,
      overallScore: 8,
      dimensions: [
          { name: "Technical Depth", score: 8, reasoning: "Good understanding of core concepts." },
          { name: "Problem Solving", score: 7, reasoning: "Approached the problem well but missed some edge cases." },
          { name: "System Design & Best Practices", score: 7, reasoning: "Basic understanding of architecture." },
          { name: "Communication", score: 9, reasoning: "Explained ideas very clearly." },
          { name: "Practical Experience", score: 6, reasoning: "Lacked some hands-on experience." }
        ],
        learningPath: [
          { 
            topic: { en: "Advanced React Patterns", vi: "Các pattern React nâng cao" }, 
            priority: "High", 
            suggestion: { en: "Study HOCs and custom hooks.", vi: "Học HOCs và custom hooks." }
          },
          { 
            topic: { en: "System Design Basics", vi: "Cơ bản về thiết kế hệ thống" }, 
            priority: "Medium", 
            suggestion: { en: "Read grokking the system design interview.", vi: "Đọc sách grokking the system design interview." }
          }
        ]
    };

    return {
      data,
      audit: { promptTokenCount: 20, candidatesTokenCount: 100, totalTokenCount: 120 }
    };
  }
}
