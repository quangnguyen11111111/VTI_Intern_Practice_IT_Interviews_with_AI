import { inject, injectable } from 'tsyringe';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppEnv } from '../../../config/env';
import { logger } from '../../../infrastructure/logging/logger';
import { IAiProvider, InterviewSetupPayload, AnswerPayload } from '../../../domain/interview/types';
import {
  EvaluationQuestion,
  generationPrompt,
  evaluationPrompt,
  parseProviderJson,
  validateGeneration,
  validateEvaluation,
  validateUsage,
  outputError,
} from '../prompt-security';
import { providerRetry } from '../provider-retry';

@injectable()
export class GeminiAiProvider implements IAiProvider {
  private readonly genAI: GoogleGenerativeAI;

  constructor(@inject('AppEnv') env: AppEnv) {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  private async request(systemInstruction: string, userContent: string) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction,
      generationConfig: {
        temperature: 0.5,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
    });
    const result = await providerRetry(
      (signal) => model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
      }, { signal }),
    );
    if (
      result.response.promptFeedback?.blockReason ||
      result.response.candidates?.length !== 1 ||
      result.response.candidates[0].finishReason !== 'STOP'
    ) {
      throw outputError();
    }
    let value: unknown;
    try {
      value = parseProviderJson(result.response.text());
    } catch {
      throw outputError();
    }
    const usage = result.response.usageMetadata;
    const audit = validateUsage({
      promptTokenCount: usage?.promptTokenCount ?? 0,
      candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
      totalTokenCount: usage?.totalTokenCount ?? 0,
    });
    return { value, audit };
  }

  async generateQuestions(setupData: InterviewSetupPayload) {
    const prompt = generationPrompt(setupData);
    logger.info('ai.generating');
    const { value, audit } = await this.request(prompt.systemInstruction, prompt.userContent);
    return { data: validateGeneration(value), audit };
  }

  async evaluateAnswers(questions: EvaluationQuestion[], answers: AnswerPayload[]) {
    const prompt = evaluationPrompt(questions, answers);
    logger.info('ai.evaluating');
    const { value, audit } = await this.request(prompt.systemInstruction, prompt.userContent);
    return { data: validateEvaluation(value, prompt.questions, prompt.answers), audit };
  }
}
