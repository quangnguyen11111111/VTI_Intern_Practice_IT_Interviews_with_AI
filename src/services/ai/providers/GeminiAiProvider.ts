import { injectable } from 'tsyringe';

import {
  GoogleGenerativeAI,
  SchemaType
} from '@google/generative-ai';

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
import { PromptTemplate } from '../../../utils/PromptTemplate';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const FALLBACK_GENERATION_PROMPT = `You are a Senior Tech Lead with 15 years of experience conducting technical interviews at top-tier companies. You are interviewing a candidate for {{positionText}}{{levelText}}.{{techStacksText}}

{{jdContext}}

YOUR TASK: Generate EXACTLY 5 interview questions that simulate a real-world technical interview{{taskContext}}.

{{levelGuidance}}

QUESTION DESIGN RULES:
{{designRules}}
2. **Theory vs Practice Mix**: At least 2 questions must be theoretical (concepts, mechanisms) and at least 2 must be practical/scenario-based.
3. **Realistic Interview Tone**: Write questions the way a real interviewer would ask them. For practical questions, provide a brief realistic context.
4. **Strict Difficulty Enforcement**: You MUST respect the LEVEL GUIDANCE above. Do not ask architecture questions to an Intern. Do not ask syntax questions to a Senior. Tailor the depth strictly to the experience level.
5. **No Repetition**: Do NOT ask generic textbook questions. Ask questions that require the candidate to demonstrate applied understanding.
6. **Bilingual Output**: Provide each question in both English (content.en) and Vietnamese (content.vi). The Vietnamese version must be a natural translation.

OUTPUT FORMAT: Return an array of EXACTLY 5 JSON objects with fields: order (1-5), difficulty, category ({{categoryDescription}}), and content ({en, vi}).

Unique Session ID: {{sessionId}}`;

const FALLBACK_EVALUATION_PROMPT = `You are a Senior Tech Lead conducting a technical interview.
You will be given a set of questions and the candidate's answers.

YOUR TASKS:
1. Provide constructive, bilingual (en, vi) feedback for EACH question and score it from 0 to 10.
2. Evaluate the candidate overall across exactly 5 standard dimensions: "Technical Depth", "Problem Solving", "System Design & Best Practices", "Communication", "Practical Experience". Give each a score (0-10) and brief reasoning.
3. Provide an overall score (0-10).
4. Provide a personalized learning path with topics and suggestions (both bilingual en/vi) based on the candidate's weaknesses. Priorities should be "High", "Medium", or "Low".

Input Data:
{{QAndA}}

CRITICAL REQUIREMENT: First, detect the language the candidate used in their "candidateAnswer". 
- If the candidate answered primarily in English, write the "feedback.en" addressing them directly in English, and "feedback.vi" as a translation.
- If the candidate answered primarily in Vietnamese, write the "feedback.vi" addressing them directly in Vietnamese, and "feedback.en" as a translation.

EVALUATION RUBRIC (0-10 Scale):
- 9-10 (Excellent): Flawless technical accuracy. Explanations are crystal clear and complete. Demonstrates deep understanding, mentions edge cases, trade-offs, or best practices.
- 7-8 (Good/Solid): Technically accurate but might miss minor nuances. Clear and mostly complete explanation. Shows good working knowledge.
- 5-6 (Average/Basic): Has the general idea correct but lacks depth. May contain minor technical inaccuracies. Explanation is somewhat vague or incomplete.
- 3-4 (Poor/Incomplete): Fundamentally misunderstands the core concept or gives highly inaccurate information. Very hard to follow.
- 1-2 (Fail): Completely wrong or mostly irrelevant.
- 0: Did not answer ("I don't know", empty, or skipped).

Task 1: Evaluate EACH answer on the 0-10 scale STRICTLY using the EVALUATION RUBRIC above. Consider technical accuracy, clarity, and completeness. Provide bilingual constructive feedback (mentioning what was good and what was missing). Make sure to return the exact "questionId" for each evaluation.
Task 2: Provide an overallScore (integer 0-10) reflecting their overall interview performance.
Task 3: Based on their overall performance and weaknesses, provide a structured learning path with topics, priority (High/Medium/Low), and actionable suggestions.

Return a single JSON object containing "evaluations", "overallScore", and "learningPath".`;

const FALLBACK_LEARNING_PATH_PROMPT = `You are a Senior Tech Lead and Mentor creating a learning path for a candidate.

Interview questions:
{{questions}}

Candidate answers:
{{answers}}

Evaluation:
{{evaluation}}

TASK:
Create a structured learning path based on the candidate's weaknesses.

Requirements:
1. Focus on the most important technical weaknesses.
2. Assign priority: High, Medium, or Low.
3. Provide an actionable suggestion for every topic.
4. Avoid duplicating the entire evaluation feedback.
5. Return a JSON object containing only "learningPath".`;

@injectable()
export class GeminiAiProvider
  implements IAiProvider
{
  private genAI: GoogleGenerativeAI;

  private modelName = 'gemini-3.6-flash';

  constructor() {
    const apiKey =
      process.env.GEMINI_API_KEY || '';

    this.genAI =
      new GoogleGenerativeAI(apiKey);
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;

        console.error(
          `[GeminiAI] Attempt ${attempt} failed:`,
          error.message
        );

        if (attempt >= MAX_RETRIES) {
          throw new Error(
            `[GeminiAI] Operation failed after ${MAX_RETRIES} attempts. Error: ${error.message}`
          );
        }

        await new Promise<void>(
          (resolve) =>
            setTimeout(
              resolve,
              RETRY_DELAY_MS * attempt
            )
        );
      }
    }

    throw new Error('Unreachable');
  }

  private pickRandom<T>(
    arr: T[],
    count: number
  ): T[] {
    const shuffled = [...arr].sort(
      () => Math.random() - 0.5
    );

    return shuffled.slice(0, count);
  }

  async generateQuestions(
    setupData: InterviewSetupPayload,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: GeneratedQuestion[];
    audit: AiUsageMetadata;
  }> {
    console.log(
      `[GeminiAI] Generating questions with data:`,
      setupData
    );

    const model =
      this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 1.0,
          responseMimeType:
            'application/json',

          responseSchema: {
            type: SchemaType.ARRAY,

            items: {
              type: SchemaType.OBJECT,

              properties: {
                order: {
                  type: SchemaType.INTEGER
                },

                difficulty: {
                  type: SchemaType.STRING,
                  description:
                    'Easy, Medium, or Hard'
                },

                category: {
                  type: SchemaType.STRING,
                  description:
                    'The knowledge domain this question belongs to'
                },

                content: {
                  type: SchemaType.OBJECT,

                  properties: {
                    en: {
                      type: SchemaType.STRING,
                      description:
                        'Question in English'
                    },

                    vi: {
                      type: SchemaType.STRING,
                      description:
                        'Question translated to Vietnamese'
                    }
                  },

                  required: [
                    'en',
                    'vi'
                  ]
                }
              },

              required: [
                'order',
                'difficulty',
                'category',
                'content'
              ]
            }
          }
        }
      });

    const allDomains = [
      'Core Language Fundamentals',
      'Framework/Library Internals',
      'API Design & RESTful Patterns',
      'Database & ORM Optimization',
      'Authentication & Security',
      'Performance Tuning & Profiling',
      'Testing Strategy (Unit/Integration/E2E)',
      'CI/CD & DevOps Practices',
      'Error Handling & Logging',
      'State Management & Data Flow',
      'Caching & Network Optimization',
      'Code Review & Refactoring',
      'System Design & Architecture',
      'Concurrency & Async Patterns',
      'Debugging & Troubleshooting',
      'Deployment & Infrastructure'
    ];

    const selectedDomains =
      this.pickRandom(
        allDomains,
        5
      );
      
    // Calculate template variables
    const positionText = setupData.jobPosition ? `a **${setupData.jobPosition}** position` : 'a position';
    const levelText = setupData.level ? ` at the **${setupData.level}** level` : '';
    const techStacksText = setupData.techStacks && setupData.techStacks.length > 0
      ? `\nThe candidate's tech stacks are: **${setupData.techStacks.join(', ')}**.`
      : '';
      
    const jdContext = setupData.jdText 
      ? `Here is the Job Description (JD) for the role:\n---\n${setupData.jdText}\n---`
      : '';
      
    const taskContext = setupData.jdText
      ? `, strictly tailored to the requirements, skills, and context found in the JD above`
      : ``;
      
    const categoryDescription = setupData.jdText
      ? `the skill/domain from the JD`
      : `the domain name`;
      
    let designRules = '';
    if (setupData.jdText) {
      designRules = `1. **JD Alignment**: Each question MUST target a specific skill, responsibility, or technology mentioned in the JD. The category should describe the specific skill from the JD being tested.`;
    } else {
      designRules = `1. **Domain Assignment**: Each question MUST come from one of the following 5 knowledge domains (one question per domain, in order):
   - Q1: ${selectedDomains[0]}
   - Q2: ${selectedDomains[1]}
   - Q3: ${selectedDomains[2]}
   - Q4: ${selectedDomains[3]}
   - Q5: ${selectedDomains[4]}`;
    }
    
    // Level guidance map
    let levelGuidance = `LEVEL GUIDANCE (General / Unknown Level):\n- Difficulty distribution: 2 Easy + 2 Medium + 1 Hard.\n- Tone & Expectation: Assess core knowledge and some practical problem-solving.\n- Depth: Ensure foundational concepts are strong before moving to complex scenarios.\n- Make sure to keep the questions balanced.`;
    const normalizedLevel = (setupData.level || '').toLowerCase();
    
    if (setupData.jdText) {
      levelGuidance = `LEVEL GUIDANCE (From JD):\n- Depth and difficulty: Base the technical depth and difficulty of questions entirely on the context and requirements stated in the Job Description.\n- Focus: Ask practical questions that evaluate the candidate's ability to perform the exact responsibilities mentioned.`;
    } else if (normalizedLevel.includes('intern') || normalizedLevel.includes('fresher')) {
      levelGuidance = `LEVEL GUIDANCE (Intern/Fresher - 0 to 6 months experience):\n- Difficulty distribution: 4 Easy + 1 Medium. STRICTLY NO HARD QUESTIONS.\n- Tone & Expectation: The candidate is a student or recent graduate. Treat them as a beginner.\n- Depth: Focus ONLY on very basic, foundational concepts (e.g., "What is OOP?", "Difference between let and var", "What is a primary key?").\n- Practical questions: Keep it extremely simple (e.g., reading a 5-line code snippet, writing a basic SELECT SQL query, or finding a simple syntax/logic bug).\n- RESTRICTION: DO NOT ask about system design, microservices, clean architecture, design patterns, or complex performance optimization.`;
    } else if (normalizedLevel.includes('junior')) {
      levelGuidance = `LEVEL GUIDANCE (Junior - 1 to 2 years experience):\n- Difficulty distribution: 2 Easy + 3 Medium. STRICTLY NO HARD QUESTIONS.\n- Tone & Expectation: The candidate has limited working experience. They know how to code but need guidance on architecture.\n- Depth: Focus on everyday practical tasks and framework basics. Ask "How do you implement X?" or "How do you debug Y?".\n- Practical questions: Real project scenarios but localized to a single component (e.g., handling form validation, writing a simple CRUD API, fixing a UI bug).\n- RESTRICTION: DO NOT ask about deep system design, distributed systems, or high-scale performance tuning.`;
    } else if (normalizedLevel.includes('mid') || normalizedLevel.includes('middle')) {
      levelGuidance = `LEVEL GUIDANCE (Middle/Mid-level - 3 to 5 years experience):\n- Difficulty distribution: 1 Easy + 3 Medium + 1 Hard.\n- Tone & Expectation: The candidate is an independent contributor.\n- Depth: Expect solid understanding of trade-offs. Ask "Why would you choose X over Y?" and "How would you optimize this?".\n- Practical questions: Multi-component scenarios (e.g., refactoring legacy code, handling database race conditions, optimizing a slow API endpoint).\n- Include basic architectural decisions (e.g., caching strategies, database indexing).`;
    } else if (normalizedLevel.includes('senior') || normalizedLevel.includes('lead') || normalizedLevel.includes('principal') || normalizedLevel.includes('architect')) {
      levelGuidance = `LEVEL GUIDANCE (Senior/Lead - 5+ years experience):\n- Difficulty distribution: 0 Easy + 2 Medium + 3 Hard.\n- Tone & Expectation: The candidate is an expert, mentor, and technical leader.\n- Depth: Expect deep expertise and strategic thinking. Ask "How would you design a scalable system for...", "How would you handle data consistency across microservices?".\n- Practical questions: System-level challenges (e.g., designing for high availability, handling bottlenecks, making build-vs-buy decisions).\n- Include questions about mentoring, code review strategy, and technical leadership.`;
    }

    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Inject variables into prompt template
    const templateContent = systemPrompt?.content || FALLBACK_GENERATION_PROMPT;
    const finalPrompt = PromptTemplate.injectVariables(templateContent, {
      positionText,
      levelText,
      techStacksText,
      jdContext,
      taskContext,
      levelGuidance,
      designRules,
      categoryDescription,
      sessionId
    });

    if (systemPrompt) {
      console.log(
        `[GeminiAI] Using generation prompt version ${systemPrompt.version}`
      );
    }

    return this.retryWithBackoff(
      async () => {
        const result =
          await model.generateContent(
            finalPrompt
          );

        const text =
          result.response.text();

        const cleanText =
          text
            .replace(
              /```json/gi,
              ''
            )
            .replace(
              /```/gi,
              ''
            )
            .trim();

        const parsed:
          GeneratedQuestion[] =
          JSON.parse(cleanText);

        if (
          !Array.isArray(parsed) ||
          parsed.length !== 5
        ) {
          throw new Error(
            `AI Validation Error: Expected exactly 5 questions, got ${parsed?.length || 0}`
          );
        }

        const metadata =
          result.response
            .usageMetadata;

        const audit:
          AiUsageMetadata = {
          promptTokenCount:
            metadata?.promptTokenCount ||
            0,

          candidatesTokenCount:
            metadata?.candidatesTokenCount ||
            0,

          totalTokenCount:
            metadata?.totalTokenCount ||
            0
        };

        console.log(
          `[GeminiAI] Generated questions from domains: ${selectedDomains.join(', ')}`
        );

        return {
          data: parsed,
          audit
        };
      }
    );
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
      `[GeminiAI] Evaluating answers...`
    );

    const model =
      this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 0.3,
          responseMimeType:
            'application/json',

          responseSchema: {
            type: SchemaType.OBJECT,

            properties: {
              evaluations: {
                type: SchemaType.ARRAY,

                items: {
                  type: SchemaType.OBJECT,

                  properties: {
                    questionId: {
                      type: SchemaType.STRING
                    },

                    feedback: {
                      type: SchemaType.OBJECT,

                      properties: {
                        en: {
                          type: SchemaType.STRING
                        },

                        vi: {
                          type: SchemaType.STRING
                        }
                      },

                      required: [
                        'en',
                        'vi'
                      ]
                    },

                    score: {
                      type: SchemaType.INTEGER
                    }
                  },

                  required: [
                    'questionId',
                    'feedback',
                    'score'
                  ]
                }
              },
              overallScore: { type: SchemaType.INTEGER },
              dimensions: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    name: { type: SchemaType.STRING },
                    score: { type: SchemaType.INTEGER },
                    reasoning: { type: SchemaType.STRING }
                  },
                  required: ["name", "score", "reasoning"]
                }
              },
              learningPath: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    topic: { 
                      type: SchemaType.OBJECT,
                      properties: { en: { type: SchemaType.STRING }, vi: { type: SchemaType.STRING } }
                    },
                    priority: { type: SchemaType.STRING },
                    suggestion: { 
                      type: SchemaType.OBJECT,
                      properties: { en: { type: SchemaType.STRING }, vi: { type: SchemaType.STRING } }
                    }
                  },
                  required: ["topic", "priority", "suggestion"]
                }
              }
            },
            required: ["evaluations", "overallScore", "dimensions", "learningPath"]
        }
      }
    });

    const QAndA = questions.map(q => {
      const questionId = q._id?.toString() || q.id;
      const ans = answers.find(a => a.questionId === questionId);
      return {
        questionId,
        questionTextEn: q.content?.en || 'Unknown question',
        questionTextVi: q.content?.vi || 'Unknown question',
        candidateAnswer: ans?.candidateAnswer
      };
    });
    
    // Inject variables into prompt template
    const templateContent = systemPrompt?.content || FALLBACK_EVALUATION_PROMPT;
    const finalPrompt = PromptTemplate.injectVariables(templateContent, {
      QAndA
    });

    if (systemPrompt) {
      console.log(
        `[GeminiAI] Using evaluation prompt version ${systemPrompt.version}`
      );
    }

    return this.retryWithBackoff(
      async () => {
        const result =
          await model.generateContent(
            finalPrompt
          );

        const text =
          result.response.text();

        const cleanText =
          text
            .replace(
              /^```json/gi,
              ''
            )
            .replace(
              /```$/gi,
              ''
            )
            .trim();

        const parsed:
          EvaluationResult =
          JSON.parse(cleanText);

        if (
          !parsed.evaluations ||
          !Array.isArray(
            parsed.evaluations
          ) ||
          parsed.evaluations.length !==
            answers.length
        ) {
          throw new Error(
            `AI Validation Error: Expected ${answers.length} evaluations, got ${parsed.evaluations?.length || 0}`
          );
        }

        const metadata =
          result.response
            .usageMetadata;

        const audit:
          AiUsageMetadata = {
          promptTokenCount:
            metadata?.promptTokenCount ||
            0,

          candidatesTokenCount:
            metadata?.candidatesTokenCount ||
            0,

          totalTokenCount:
            metadata?.totalTokenCount ||
            0
        };

        return {
          data: parsed,
          audit
        };
      }
    );
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
      '[GeminiAI] Generating learning path...'
    );

    const model =
      this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 0.3,
          responseMimeType:
            'application/json',

          responseSchema: {
            type: SchemaType.OBJECT,

            properties: {
              learningPath: {
                type: SchemaType.ARRAY,

                items: {
                  type: SchemaType.OBJECT,

                  properties: {
                    topic: {
                      type: SchemaType.STRING
                    },

                    priority: {
                      type: SchemaType.STRING
                    },

                    suggestion: {
                      type: SchemaType.STRING
                    }
                  },

                  required: [
                    'topic',
                    'priority',
                    'suggestion'
                  ]
                }
              }
            },

            required: [
              'learningPath'
            ]
          }
        }
      });

    const finalPrompt = PromptTemplate.injectVariables(systemPrompt?.content || FALLBACK_LEARNING_PATH_PROMPT, {
      questions,
      answers,
      evaluation
    });

    if (systemPrompt) {
      console.log(
        `[GeminiAI] Using learning-path prompt version ${systemPrompt.version}`
      );
    }

    return this.retryWithBackoff(
      async () => {
        const result =
          await model.generateContent(
            finalPrompt
          );

        const text =
          result.response.text();

        const cleanText =
          text
            .replace(
              /^```json/gi,
              ''
            )
            .replace(
              /```$/gi,
              ''
            )
            .trim();

        const parsed:
          LearningPathResult =
          JSON.parse(cleanText);

        if (
          !parsed.learningPath ||
          !Array.isArray(
            parsed.learningPath
          )
        ) {
          throw new Error(
            'AI Validation Error: Expected learningPath to be an array'
          );
        }

        const metadata =
          result.response
            .usageMetadata;

        const audit:
          AiUsageMetadata = {
          promptTokenCount:
            metadata?.promptTokenCount ||
            0,

          candidatesTokenCount:
            metadata?.candidatesTokenCount ||
            0,

          totalTokenCount:
            metadata?.totalTokenCount ||
            0
        };

        return {
          data: parsed,
          audit
        };
      }
    );
  }
}