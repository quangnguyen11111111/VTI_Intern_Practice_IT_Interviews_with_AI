import { injectable } from 'tsyringe';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { IAiProvider, InterviewSetupPayload, GeneratedQuestion, AnswerPayload, EvaluationResult } from '../../../domain/interview/types';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

@injectable()
export class GeminiAiProvider implements IAiProvider {
  private genAI: GoogleGenerativeAI;
  // Use gemini-1.5-flash as the default model based on user selection
  private modelName = 'gemini-1.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async retryWithBackoff<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        console.error(`[GeminiAI] Attempt ${attempt} failed:`, error.message);
        if (attempt >= MAX_RETRIES) {
          throw new Error(`[GeminiAI] Operation failed after ${MAX_RETRIES} attempts.`);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
    throw new Error('Unreachable');
  }

  async generateQuestions(setupData: InterviewSetupPayload): Promise<GeneratedQuestion[]> {
    console.log(`[GeminiAI] Generating questions with data:`, setupData);
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0.8, // Good for diversity
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              order: { type: SchemaType.INTEGER },
              difficulty: { type: SchemaType.STRING },
              content: {
                type: SchemaType.OBJECT,
                properties: {
                  en: { type: SchemaType.STRING },
                  vi: { type: SchemaType.STRING }
                },
                required: ["en", "vi"]
              }
            },
            required: ["order", "difficulty", "content"]
          }
        }
      }
    });

    const prompt = `
      You are an expert IT interviewer. Generate exactly 5 diverse interview questions for a candidate.
      Job Position: ${setupData.jobPosition}
      Level: ${setupData.level}
      Tech Stacks: ${setupData.techStacks.join(', ')}

      Requirements:
      - Start from order 1 to 5.
      - Difficulty should vary (e.g., Easy, Medium, Hard).
      - Provide the question content in both English (en) and Vietnamese (vi).
      - Ensure questions are practical and test real knowledge of the specified tech stacks.
    `;

    const resultText = await this.retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    try {
      const questions: GeneratedQuestion[] = JSON.parse(resultText);
      return questions;
    } catch (e) {
      console.error("[GeminiAI] Failed to parse generated JSON:", resultText);
      throw new Error("Failed to parse AI response into questions array");
    }
  }

  async evaluateAnswers(questions: any[], answers: AnswerPayload[]): Promise<EvaluationResult> {
    console.log(`[GeminiAI] Evaluating answers...`);
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0.3, // Lower temperature for more objective grading
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            evaluations: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  questionId: { type: SchemaType.STRING },
                  feedback: {
                    type: SchemaType.OBJECT,
                    properties: {
                      en: { type: SchemaType.STRING },
                      vi: { type: SchemaType.STRING }
                    },
                    required: ["en", "vi"]
                  },
                  score: { type: SchemaType.INTEGER }
                },
                required: ["questionId", "feedback", "score"]
              }
            },
            overallScore: { type: SchemaType.INTEGER },
            learningPath: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  topic: { type: SchemaType.STRING },
                  priority: { type: SchemaType.STRING },
                  suggestion: { type: SchemaType.STRING }
                },
                required: ["topic", "priority", "suggestion"]
              }
            }
          },
          required: ["evaluations", "overallScore", "learningPath"]
        }
      }
    });

    // Match answers to questions
    const QAndA = answers.map(ans => {
      const q = questions.find((item: any) => item._id?.toString() === ans.questionId || item.id === ans.questionId);
      return {
        questionId: ans.questionId,
        questionTextEn: q?.content?.en || 'Unknown question',
        candidateAnswer: ans.candidateAnswer
      };
    });

    const prompt = `
      You are an expert IT interviewer. Evaluate the candidate's answers based on the following questions.
      
      Questions and Answers:
      ${JSON.stringify(QAndA, null, 2)}

      Requirements:
      1. For each answer, provide feedback in English (en) and Vietnamese (vi). Mention what was good and what could be improved. Identify the language the candidate used and reply appropriately in the localized feedback, though you must provide both en and vi fields.
      2. Score each answer from 1 to 10 (integer).
      3. Provide an overall score out of 10 for the entire interview.
      4. Based on the candidate's weaknesses, provide a learning path with topics, priorities (High/Medium/Low), and actionable suggestions.
    `;

    const resultText = await this.retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    try {
      const evaluationResult: EvaluationResult = JSON.parse(resultText);
      return evaluationResult;
    } catch (e) {
      console.error("[GeminiAI] Failed to parse evaluation JSON:", resultText);
      throw new Error("Failed to parse AI response into evaluation result");
    }
  }
}
