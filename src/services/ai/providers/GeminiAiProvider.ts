import { injectable } from 'tsyringe';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { IAiProvider, InterviewSetupPayload, GeneratedQuestion, AnswerPayload, EvaluationResult, AiUsageMetadata } from '../../../domain/interview/types';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

@injectable()
export class GeminiAiProvider implements IAiProvider {
  private genAI: GoogleGenerativeAI;
  private modelName = 'gemini-3.6-flash';

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
          throw new Error(`[GeminiAI] Operation failed after ${MAX_RETRIES} attempts. Error: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
    throw new Error('Unreachable');
  }

  /**
   * Randomly picks N items from an array (Fisher-Yates shuffle).
   * Used to rotate knowledge domains so the same input produces different question sets.
   */
  private pickRandom<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Maps candidate level to appropriate difficulty distribution and depth guidance.
   */
  private getLevelGuidance(level: string): string {
    const normalized = level.toLowerCase();
    if (normalized.includes('intern') || normalized.includes('fresher')) {
      return `LEVEL GUIDANCE (Intern/Fresher):
- Difficulty distribution: 3 Easy + 2 Medium. No Hard questions.
- Depth: Focus on foundational understanding. Ask "what is" and "how does it work" style questions.
- Practical questions should involve simple, everyday scenarios (e.g., fixing a common bug, reading a short code snippet).
- Do NOT ask about system design, distributed systems, or advanced architectural patterns.`;
    }
    if (normalized.includes('junior')) {
      return `LEVEL GUIDANCE (Junior):
- Difficulty distribution: 2 Easy + 2 Medium + 1 Hard.
- Depth: Expect working knowledge. Ask "how would you implement" and "what happens when" style questions.
- Practical questions should involve real project scenarios (e.g., debugging a production issue, choosing between two approaches).
- Avoid deep system design but may include simple component-level design decisions.`;
    }
    if (normalized.includes('mid') || normalized.includes('middle')) {
      return `LEVEL GUIDANCE (Middle/Mid-level):
- Difficulty distribution: 1 Easy + 2 Medium + 2 Hard.
- Depth: Expect solid understanding of trade-offs. Ask "why would you choose X over Y" and "how would you optimize" style questions.
- Practical questions should involve multi-component scenarios (e.g., refactoring legacy code, handling race conditions, optimizing a slow API endpoint).
- Include at least one question about architectural decisions.`;
    }
    // Senior / Lead / Principal / Architect
    return `LEVEL GUIDANCE (Senior/Lead):
- Difficulty distribution: 0 Easy + 2 Medium + 3 Hard.
- Depth: Expect deep expertise, mentorship ability, and strategic thinking. Ask "how would you design", "how would you lead a team to solve", and "what are the long-term trade-offs" style questions.
- Practical questions should involve system-level challenges (e.g., designing for scale, handling data consistency across microservices, making build-vs-buy decisions).
- Include at least one question about mentoring, code review strategy, or technical leadership.`;
  }

  async generateQuestions(setupData: InterviewSetupPayload): Promise<{ data: GeneratedQuestion[], audit: AiUsageMetadata }> {
    console.log(`[GeminiAI] Generating questions with data:`, setupData);
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              order: { type: SchemaType.INTEGER },
              difficulty: { type: SchemaType.STRING, description: "Easy, Medium, or Hard" },
              category: { type: SchemaType.STRING, description: "The knowledge domain this question belongs to" },
              content: {
                type: SchemaType.OBJECT,
                properties: {
                  en: { type: SchemaType.STRING, description: "Question in English" },
                  vi: { type: SchemaType.STRING, description: "Question translated to Vietnamese" }
                },
                required: ["en", "vi"]
              }
            },
            required: ["order", "difficulty", "category", "content"]
          }
        }
      }
    });

    // Pool of possible knowledge domains — 5 are randomly picked each time
    const allDomains = [
      "Core Language Fundamentals",
      "Framework/Library Internals",
      "API Design & RESTful Patterns",
      "Database & ORM Optimization",
      "Authentication & Security",
      "Performance Tuning & Profiling",
      "Testing Strategy (Unit/Integration/E2E)",
      "CI/CD & DevOps Practices",
      "Error Handling & Logging",
      "State Management & Data Flow",
      "Caching & Network Optimization",
      "Code Review & Refactoring",
      "System Design & Architecture",
      "Concurrency & Async Patterns",
      "Debugging & Troubleshooting",
      "Deployment & Infrastructure",
    ];
    const selectedDomains = this.pickRandom(allDomains, 5);
    const levelGuidance = this.getLevelGuidance(setupData.level);

    let prompt = "";

    if (setupData.jdText) {
      // JD-based prompt
      prompt = `You are a Senior Tech Lead with 15 years of experience conducting technical interviews at top-tier companies. You are interviewing a candidate for a **${setupData.jobPosition}** position at the **${setupData.level}** level.
The candidate's tech stacks are: **${setupData.techStacks.join(", ")}**.

Here is the Job Description (JD) for the role:
---
${setupData.jdText}
---

YOUR TASK: Generate EXACTLY 5 interview questions that simulate a real-world technical interview, strictly tailored to the requirements, skills, and context found in the JD above.

${levelGuidance}

QUESTION DESIGN RULES:
1. **JD Alignment**: Each question MUST target a specific skill, responsibility, or technology mentioned in the JD. The category should describe the specific skill from the JD being tested.
2. **Theory vs Practice Mix**: At least 2 questions must be theoretical (concepts, mechanisms, "explain how X works") and at least 2 must be practical/scenario-based (debugging a real bug, making an architecture decision, optimizing a slow query). The 5th can be either.
3. **Realistic Interview Tone**: Write questions the way a real interviewer would ask them — conversational but precise. For scenario questions, provide a brief realistic context (e.g., "Your team's API response time has degraded from 200ms to 2s after a recent deployment. How would you diagnose and fix this?").
4. **No Repetition**: Do NOT ask generic textbook questions. Ask questions that require the candidate to demonstrate applied understanding of the JD requirements.
5. **Bilingual Output**: Provide each question in both English (content.en) and Vietnamese (content.vi). The Vietnamese version must be a natural translation, not a word-for-word translation.

OUTPUT FORMAT: Return an array of EXACTLY 5 JSON objects with fields: order (1-5), difficulty, category (the skill/domain from the JD), and content ({en, vi}).

Unique Session ID: ${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    } else {
      // Standard tech-stack based prompt
      prompt = `You are a Senior Tech Lead with 15 years of experience conducting technical interviews at top-tier companies. You are interviewing a candidate for a **${setupData.jobPosition}** position at the **${setupData.level}** level.
The candidate's tech stacks are: **${setupData.techStacks.join(", ")}**.

YOUR TASK: Generate EXACTLY 5 interview questions that simulate a real-world technical interview.

${levelGuidance}

QUESTION DESIGN RULES:
1. **Domain Assignment**: Each question MUST come from one of the following 5 knowledge domains (one question per domain, in order):
   - Q1: ${selectedDomains[0]}
   - Q2: ${selectedDomains[1]}
   - Q3: ${selectedDomains[2]}
   - Q4: ${selectedDomains[3]}
   - Q5: ${selectedDomains[4]}
2. **Theory vs Practice Mix**: At least 2 questions must be theoretical (concepts, mechanisms, "explain how X works") and at least 2 must be practical/scenario-based (debugging a real bug, making an architecture decision, optimizing a slow query). The 5th can be either.
3. **Realistic Interview Tone**: Write questions the way a real interviewer would ask them — conversational but precise. For scenario questions, provide a brief realistic context (e.g., "Your team's API response time has degraded from 200ms to 2s after a recent deployment. How would you diagnose and fix this?").
4. **No Repetition**: Do NOT ask generic textbook questions like "What is a closure?" or "Explain OOP". Instead, ask questions that require the candidate to demonstrate applied understanding.
5. **Bilingual Output**: Provide each question in both English (content.en) and Vietnamese (content.vi). The Vietnamese version must be a natural translation, not a word-for-word translation.

OUTPUT FORMAT: Return an array of EXACTLY 5 JSON objects with fields: order (1-5), difficulty, category (the domain name), and content ({en, vi}).

Unique Session ID: ${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }

    return await this.retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed: GeneratedQuestion[] = JSON.parse(cleanText);

      if (!Array.isArray(parsed) || parsed.length !== 5) {
        throw new Error(`AI Validation Error: Expected exactly 5 questions, got ${parsed?.length || 0}`);
      }

      const metadata = result.response.usageMetadata;
      const audit: AiUsageMetadata = {
        promptTokenCount: metadata?.promptTokenCount || 0,
        candidatesTokenCount: metadata?.candidatesTokenCount || 0,
        totalTokenCount: metadata?.totalTokenCount || 0,
      };

      console.log(`[GeminiAI] Generated questions from domains: ${selectedDomains.join(', ')}`);
      return { data: parsed, audit };
    });
  }

  async evaluateAnswers(questions: any[], answers: AnswerPayload[]): Promise<{ data: EvaluationResult, audit: AiUsageMetadata }> {
    console.log(`[GeminiAI] Evaluating answers...`);
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0.3,
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

    const QAndA = answers.map(ans => {
      const q = questions.find((item: any) => item._id?.toString() === ans.questionId || item.id === ans.questionId);
      return {
        questionId: ans.questionId,
        questionTextEn: q?.content?.en || 'Unknown question',
        questionTextVi: q?.content?.vi || 'Unknown question',
        candidateAnswer: ans.candidateAnswer || 'No answer provided'
      };
    });

    const prompt = `You are a Senior Tech Lead and Mentor evaluating a candidate for a ${questions[0]?.jobPosition || 'Software'} position.

Here is the complete interview history:
${JSON.stringify(QAndA, null, 2)}

CRITICAL REQUIREMENT: First, detect the language the candidate used in their "candidateAnswer". 
- If the candidate answered primarily in Vietnamese, write the "feedback.vi" addressing them directly in Vietnamese, and "feedback.en" as a translation.
- If the candidate answered primarily in English, write the "feedback.en" addressing them directly in English, and "feedback.vi" as a translation.

Task 1: Evaluate EACH answer on a scale of 0 to 10 based on technical accuracy, clarity, and completeness. Provide bilingual constructive feedback for each. Make sure to return the exact "questionId" for each evaluation.
Task 2: Provide an overallScore (integer 0-10).
Task 3: Based on their overall performance and weaknesses, provide a structured learning path with topics, priority (High/Medium/Low), and actionable suggestions.

Return a single JSON object containing "evaluations", "overallScore", and "learningPath".`;

    return await this.retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/^```json/gi, '').replace(/```$/gi, '').trim();
      const parsed: EvaluationResult = JSON.parse(cleanText);

      if (!parsed.evaluations || !Array.isArray(parsed.evaluations) || parsed.evaluations.length !== answers.length) {
        throw new Error(`AI Validation Error: Expected ${answers.length} evaluations, got ${parsed.evaluations?.length || 0}`);
      }

      const metadata = result.response.usageMetadata;
      const audit: AiUsageMetadata = {
        promptTokenCount: metadata?.promptTokenCount || 0,
        candidatesTokenCount: metadata?.candidatesTokenCount || 0,
        totalTokenCount: metadata?.totalTokenCount || 0,
      };

      return { data: parsed, audit };
    });
  }
}
