import {
  inject,
  injectable
} from 'tsyringe';

import {
  Request,
  Response
} from 'express';

import {
  ISystemPromptService
} from '../services/interfaces/ISystemPromptService';

@injectable()
export class SystemPromptController {
  constructor(
    @inject('ISystemPromptService')
    private readonly service: ISystemPromptService
  ) {}

  createDraft = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const actorId = req.user?._id?.toString();

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: 'Yêu cầu xác thực'
        });
        return;
      }

      const {
        promptKey,
        type,
        language,
        content
      } = req.body;

      const result =
        await this.service.createDraft({
          promptKey,
          type,
          language,
          content,
          actorId
        });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  getPrompt = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.service.getPrompt(
          req.params.id as string
        );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  };

  listVersions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        promptKey,
        type,
        language
      } = req.query;

      const result =
        await this.service.listVersions(
          String(promptKey),
          type as any,
          language as any
        );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  publish = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const actorId = req.user?._id?.toString();

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: 'Yêu cầu xác thực'
        });
        return;
      }

      const result =
        await this.service.publish(
          req.params.id as string,
          actorId
        );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  rollback = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const actorId = req.user?._id?.toString();

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: 'Yêu cầu xác thực'
        });
        return;
      }

      const result =
        await this.service.rollback(
          req.params.id as string,
          actorId
        );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };
}