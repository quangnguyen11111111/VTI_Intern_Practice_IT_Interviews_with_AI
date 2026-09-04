import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';

import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { EvaluatingState } from './EvaluatingState';
import { GeneratePayload, SubmitPayload } from '../types';

export class InProgressState implements IInterviewState {
  getName(): InterviewStatus {
    return 'IN_PROGRESS';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Questions have already been generated. The interview is currently IN_PROGRESS.');
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    console.log(`[InProgressState] Submitting answers for interview: ${context.getInterviewId()}`);
    
    // Chuyển sang trạng thái chấm bài
    await context.changeState(new EvaluatingState());
    
    // Gọi logic AI chấm bài ở đây
    try {
      if (payload && payload.jobScheduler) {
          // Queue job instead of waiting
          await payload.jobScheduler.enqueue('EVALUATE_ANSWERS', {
            interviewId: context.getInterviewId(),
            data: payload.data
          });
      } else if (payload && payload.aiProvider) {
         // Fallback sync logic
         const session = await context.getRepository().findById(context.getInterviewId());
         if (!session || !session.questions) {
           throw new Error("Cannot find questions for this session.");
         }
         
         const { data: evaluationResult, audit } = await payload.aiProvider.evaluateAnswers(session.questions, payload.data);
         
         // save feedback
         for (const evalResult of evaluationResult.evaluations) {
            await context.getRepository().updateQuestionFeedback(evalResult.questionId, evalResult.feedback, evalResult.score);
         }
         
         // save overallScore and learningPath
         await context.getRepository().update(context.getInterviewId(), { 
            overallScore: evaluationResult.overallScore,
            learningPath: evaluationResult.learningPath 
         });

         // save token usage
         await context.getRepository().updateTokenUsage(context.getInterviewId(), audit);
         
         // Success -> COMPLETED
         const { CompletedState } = await import('./CompletedState');
         await context.changeState(new CompletedState());
      }
    } catch (error) {
      // Fail -> FAILED
      const { FailedState } = await import('./FailedState');
      await context.changeState(new FailedState());
      throw error;
    }
  }

  async saveProgress(context: InterviewContext, payload: import('../types').SaveProgressPayload): Promise<void> {
    console.log(`[InProgressState] Saving progress for interview: ${context.getInterviewId()}`);
    // Cập nhật câu trả lời vào DB mà không chuyển trạng thái
    for (const ans of payload.answers) {
      await context.getRepository().updateQuestionAnswer(ans.questionId, ans.candidateAnswer);
    }
  }
}
