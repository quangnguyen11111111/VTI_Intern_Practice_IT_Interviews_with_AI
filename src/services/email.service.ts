import nodemailer, { type Transporter } from 'nodemailer';
import { AppEnv, getEnv } from '../config/env';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface IEmailProvider {
  sendEmail(options: SendEmailOptions): Promise<void>;
}

export class NodemailerEmailProvider implements IEmailProvider {
  private transporter: Transporter | null = null;
  constructor(private readonly env: AppEnv) {}

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.env.SMTP_HOST,
        port: this.env.SMTP_PORT,
        secure: this.env.SMTP_SECURE,
        auth: this.env.SMTP_USER
          ? {
              user: this.env.SMTP_USER,
              pass: this.env.SMTP_PASS,
            }
          : undefined,
      });
    }
    return this.transporter;
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}

export class EmailService {
  private provider: IEmailProvider;

  constructor(provider?: IEmailProvider) {
    this.provider = provider || new NodemailerEmailProvider(getEnv());
  }

  public setProvider(provider: IEmailProvider): void {
    this.provider = provider;
  }

  public getProvider(): IEmailProvider {
    return this.provider;
  }

  public async sendPasswordResetOtp(to: string, otp: string, _isSynthetic = false): Promise<void> {
    await this.provider.sendEmail({
      to,
      subject: 'Mã xác thực đặt lại mật khẩu - IT Interview AI',
      text: `Mã xác thực đặt lại mật khẩu của bạn là: ${otp}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.`,
      html: `<p>Mã xác thực đặt lại mật khẩu của bạn là: <strong>${otp}</strong>.</p><p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.</p>`,
    });
  }
}

export const emailService = new EmailService();
