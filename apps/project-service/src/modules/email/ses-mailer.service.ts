import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { buildInvitationUrl } from '../workspaces/invitation-url';

export interface SendInviteEmailOptions {
  to: string;
  name: string;
  role: string;
  orgName: string;
  orgSlug: string;
  inviterName: string;
  inviteToken: string;
}

@Injectable()
export class SesMailerService {
  private readonly logger = new Logger(SesMailerService.name);
  private sesClient: SESClient | null = null;
  private readonly senderEmail: string;
  private readonly region: string;
  private readonly configurationError: string | null;

  constructor() {
    this.region =
      process.env.SES_REGION || process.env.AWS_SES_REGION || 'ap-southeast-1';
    this.senderEmail =
      process.env.SES_FROM_EMAIL || process.env.AWS_SES_SENDER || 'no-reply@capylabs.io';

    const accessKeyId =
      process.env.SES_ACCESS_KEY_ID || process.env.AWS_SES_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SES_ACCESS_SECRET_ACCESS_KEY;

    this.configurationError =
      accessKeyId && secretAccessKey
        ? null
        : 'SES credentials are not configured; invitation email was not sent';

    if (accessKeyId && secretAccessKey) {
      try {
        this.sesClient = new SESClient({
          region: this.region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log(
          `SES Client initialized successfully for sender: ${this.senderEmail} in region: ${this.region}`,
        );
      } catch (err) {
        this.logger.error('Failed to initialize SES client:', err);
      }
    } else {
      this.logger.warn(this.configurationError);
    }
  }

  async sendMemberInviteEmail(options: SendInviteEmailOptions): Promise<boolean> {
    const org = options.orgName.trim();
    const inviter = options.inviterName.trim();
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    const joinUrl = buildInvitationUrl(frontendUrl, options.inviteToken, options.to);
    if (!org || !inviter || !joinUrl) {
      this.logger.error(
        'Invitation email was not sent because workspace, inviter, or frontend context is missing',
      );
      return false;
    }
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #f4f4f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 540px; margin: 0 auto; background-color: #141517; border: 1px solid #27272a; border-radius: 12px; padding: 36px; }
    .logo { font-size: 20px; font-weight: 700; color: #5E6AD2; margin-bottom: 24px; display: inline-block; }
    h1 { font-size: 22px; font-weight: 600; margin-top: 0; color: #ffffff; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 16px 0; }
    .role-badge { display: inline-block; background-color: #27272a; color: #e4e4e7; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
    .btn { display: inline-block; background-color: #5E6AD2; color: #ffffff !important; text-decoration: none; font-weight: 500; font-size: 14px; padding: 12px 24px; border-radius: 6px; margin: 24px 0; }
    .footer { border-top: 1px solid #27272a; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">◉ Circle</div>
    <h1>Join <strong>${org}</strong> on Circle</h1>
    <p>Hi <strong>${options.name}</strong>,</p>
    <p><strong>${inviter}</strong> has invited you to join <strong>${org}</strong> as a <span class="role-badge">${options.role}</span>.</p>
    <p>Collaborate on projects, manage sprint cycles, and track issues with fast, keyboard-first workflows.</p>
    <div>
      <a href="${joinUrl}" class="btn">Accept Invitation & Get Started</a>
    </div>
    <p style="font-size: 12px; color: #71717a;">Or copy and paste this URL into your browser: <br><span style="color: #a1a1aa;">${joinUrl}</span></p>
    <div class="footer">
      Sent from Circle • Modern project management for high-performing teams
    </div>
  </div>
</body>
</html>
    `;

    if (!this.sesClient) {
      this.logger.warn(this.configurationError ?? 'SES client is unavailable');
      return false;
    }

    try {
      const command = new SendEmailCommand({
        Source: `Circle <${this.senderEmail}>`,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: `Join ${org} on Circle`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlContent,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const response = await this.sesClient.send(command);
      this.logger.log(
        `Invitation email successfully sent to ${options.to}. MessageId: ${response.MessageId}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to send SES email to ${options.to}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
