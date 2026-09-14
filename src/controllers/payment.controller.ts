import { Request, Response } from 'express';
import { container, inject, injectable } from 'tsyringe';

import { IPaymentService } from '../services/interfaces/IPaymentService';

@injectable()
export class PaymentController {
  constructor(
    @inject('IPaymentService') private service: IPaymentService,
  ) {}

  checkout = async (req: Request, res: Response) => {
    const key = String(req.headers['idempotency-key'] || '').trim();

    if (!key || key.length > 255) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_IDEMPOTENCY_KEY_INVALID',
      });
    }

    const data = await this.service.createCheckout(
      req.user!._id.toString(),
      req.body.planCode,
      key,
      req.requestId!,
    );

    res.status(201).json({
      success: true,
      message: 'Tạo checkout thành công',
      data,
    });
  };

  get = async (req: Request, res: Response) =>
    res.json({
      success: true,
      data: await this.service.getPayment(
        req.user!._id.toString(),
        req.params.id as string,
      ),
    });

  webhook = async (req: Request, res: Response) => {
    const provider = (
      req.params as Record<string, string | undefined>
    ).provider;

    const result = await this.service.handleWebhook(
      req.headers as Record<string, string | string[] | undefined>,
      (req as Request & { rawBody?: string }).rawBody ??
        JSON.stringify(req.body),
      req.requestId!,
      provider,
    );

    res.json({
      success: true,
      data: result,
    });
  };
}

export const paymentController = container.resolve(PaymentController);