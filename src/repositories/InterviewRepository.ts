import {
  IInterviewRepository,
  InterviewEntity,
  InterviewQuestionEntity,
  InterviewPromptVersion
} from './IInterviewRepository';

import {
  InterviewStatus
} from '../domain/interview/IInterviewState';

import {
  InterviewSetupPayload,
  LocalizedContent,
  AiUsageMetadata
} from '../domain/interview/types';

import {
  InterviewSessionModel
} from '../models/InterviewSession';

import {
  InterviewQuestionModel
} from '../models/InterviewQuestion';

export class InterviewRepository
  implements IInterviewRepository
{
  async create(
    data: InterviewSetupPayload,
    userId?: string
  ): Promise<InterviewEntity> {
    const session =
      await InterviewSessionModel.create({
        userId,
        status: 'PENDING',
        setupData: data
      });

    return this.mapSessionToEntity(
      session,
      []
    );
  }

  async findById(
    id: string
  ): Promise<InterviewEntity | null> {
    const session =
      await InterviewSessionModel.findById(
        id
      ).lean();

    if (!session) {
      return null;
    }

    const questions =
      await InterviewQuestionModel.find({
        sessionId: id
      })
        .sort({ order: 1 })
        .lean();

    return this.mapSessionToEntity(
      session,
      questions
    );
  }

  async updateStatus(
    id: string,
    status: InterviewStatus
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      { status }
    );
  }

  async update(
    id: string,
    data: Partial<InterviewEntity>
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      { $set: data }
    );
  }

  async updateTokenUsage(
    id: string,
    usage: AiUsageMetadata
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      {
        $inc: {
          'metadata.promptTokens':
            usage.promptTokenCount,
          'metadata.candidatesTokens':
            usage.candidatesTokenCount,
          'metadata.totalTokens':
            usage.totalTokenCount
        }
      }
    );
  }

  async updatePromptVersion(
    id: string,
    type:
      | 'generation'
      | 'evaluation'
      | 'learningPath',
    promptVersion: InterviewPromptVersion
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          [`promptVersions.${type}`]:
            promptVersion
        }
      }
    );
  }

  async createQuestions(
    sessionId: string,
    questionsData: Omit<
      InterviewQuestionEntity,
      | 'id'
      | 'sessionId'
      | 'createdAt'
      | 'updatedAt'
      | 'candidateAnswer'
      | 'feedback'
      | 'score'
    >[]
  ): Promise<InterviewQuestionEntity[]> {
    const docsToInsert =
      questionsData.map((q) => ({
        sessionId,
        order: q.order,
        difficulty: q.difficulty,
        content: q.content
      }));

    const insertedDocs =
      await InterviewQuestionModel.insertMany(
        docsToInsert
      );

    return insertedDocs.map((doc) =>
      this.mapQuestionToEntity(doc)
    );
  }

  async updateQuestionAnswer(
    questionId: string,
    answer: string
  ): Promise<void> {
    await InterviewQuestionModel.findByIdAndUpdate(
      questionId,
      {
        candidateAnswer: answer
      }
    );
  }

  async updateQuestionFeedback(
    questionId: string,
    feedback: LocalizedContent,
    score: number
  ): Promise<void> {
    await InterviewQuestionModel.findByIdAndUpdate(
      questionId,
      {
        feedback,
        score
      }
    );
  }

  private mapSessionToEntity(
    sessionDoc: any,
    questionsDoc: any[]
  ): InterviewEntity {
    return {
      id: sessionDoc._id.toString(),
      userId: sessionDoc.userId,
      status: sessionDoc.status,
      setupData: sessionDoc.setupData,
      overallScore: sessionDoc.overallScore,
      learningPath: sessionDoc.learningPath,
      promptVersions:
        sessionDoc.promptVersions,
      metadata: sessionDoc.metadata,
      createdAt: sessionDoc.createdAt,
      updatedAt: sessionDoc.updatedAt,
      questions:
        questionsDoc.map((q) =>
          this.mapQuestionToEntity(q)
        )
    };
  }

  private mapQuestionToEntity(
    questionDoc: any
  ): InterviewQuestionEntity {
    return {
      id: questionDoc._id.toString(),
      sessionId:
        questionDoc.sessionId.toString(),
      order: questionDoc.order,
      difficulty: questionDoc.difficulty,
      content: questionDoc.content,
      candidateAnswer:
        questionDoc.candidateAnswer,
      feedback: questionDoc.feedback,
      score: questionDoc.score,
      createdAt: questionDoc.createdAt,
      updatedAt: questionDoc.updatedAt
    };
  }
}