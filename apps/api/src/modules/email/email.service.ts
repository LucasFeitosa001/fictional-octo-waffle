import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Thin Resend client over the HTTP API (POST https://api.resend.com/emails),
 * called with the global `fetch` so we don't add an npm dependency (avoids the
 * pnpm-strict hoisting issue in the container). Fails soft: when RESEND_API_KEY
 * is unset, or the request errors, it logs and returns instead of throwing, so
 * email never blocks a booking.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from = process.env.EMAIL_FROM ?? 'Salonpass <nao-responda@salonpass.com.br>';

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY ausente — e-mail para ${input.to} não enviado ("${input.subject}").`,
      );
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Resend respondeu ${res.status} para ${input.to}: ${body}`);
      }
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${input.to}`, err as Error);
    }
  }
}
