import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { EmailTemplate } from '../constants/email.constants';
import { SendEmailDto } from '../dto/send-email.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter!: nodemailer.Transporter;
  private templateCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.setupTransporter();
    this.precompileTemplates();
  }

  private setupTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('smtp.host'),
      port: this.configService.get<number>('smtp.port'),
      secure: this.configService.get<number>('smtp.port') === 465,
      auth: {
        user: this.configService.get<string>('smtp.user'),
        pass: this.configService.get<string>('smtp.password'),
      },
    });
  }

  private precompileTemplates() {
    const templatesDir = path.join(__dirname, '..', 'templates');
    if (!fs.existsSync(templatesDir)) {
      this.logger.warn('Templates directory not found. Skipping template precompilation.');
      return;
    }

    const files = fs.readdirSync(templatesDir);
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const templateName = file.replace('.hbs', '');
        const templatePath = path.join(templatesDir, file);
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        this.templateCache.set(templateName, handlebars.compile(templateContent));
      }
    }
  }

  private async sendEmailWithRetry(
    payload: SendEmailDto,
    retries = 3,
    delay = 1000,
  ): Promise<boolean> {
    const startTime = Date.now();
    const { email, subject, template, context, userId } = payload;
    const requestId = context?.requestId || 'N/A';

    try {
      let compiledTemplate = this.templateCache.get(template);

      if (!compiledTemplate) {
        // Fallback to loading it dynamically if not cached
        const templatePath = path.join(__dirname, '..', 'templates', `${template}.hbs`);
        if (fs.existsSync(templatePath)) {
          const templateContent = fs.readFileSync(templatePath, 'utf8');
          compiledTemplate = handlebars.compile(templateContent);
          this.templateCache.set(template, compiledTemplate);
        } else {
          throw new Error(`Template ${template} not found`);
        }
      }

      const html = compiledTemplate(context || {});
      const from = this.configService.get<string>('smtp.from');

      await this.transporter.sendMail({
        from,
        to: email,
        subject,
        html,
      });

      this.logger.log({
        message: 'Email sent successfully',
        requestId,
        userId,
        email,
        template,
        latency: Date.now() - startTime,
        success: true,
      });

      return true;
    } catch (error: any) {
      this.logger.error({
        message: `Failed to send email: ${error.message}`,
        requestId,
        userId,
        email,
        template,
        latency: Date.now() - startTime,
        success: false,
        failure: error.message,
      });

      if (retries > 0) {
        this.logger.warn(`Retrying email delivery. Retries left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendEmailWithRetry(payload, retries - 1, delay * 2);
      }

      // Graceful failure - do not throw
      return false;
    }
  }

  // --- Public API ---

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: 'Welcome to Luxury Perfume Store',
      template: EmailTemplate.WELCOME,
      context: { name },
    });
  }

  async sendOrderConfirmation(email: string, orderDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Order Confirmation - #${orderDetails.orderId}`,
      template: EmailTemplate.ORDER_CONFIRMATION,
      context: { ...orderDetails },
    });
  }

  async sendOrderShipped(email: string, orderDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Your Order #${orderDetails.orderId} has shipped!`,
      template: EmailTemplate.ORDER_SHIPPED,
      context: { ...orderDetails },
    });
  }

  async sendOrderDelivered(email: string, orderDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Your Order #${orderDetails.orderId} has been delivered`,
      template: EmailTemplate.ORDER_DELIVERED,
      context: { ...orderDetails },
    });
  }

  async sendOrderCancelled(email: string, orderDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Order Cancelled - #${orderDetails.orderId}`,
      template: EmailTemplate.ORDER_CANCELLED,
      context: { ...orderDetails },
    });
  }

  async sendPaymentSuccess(email: string, paymentDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Payment Successful - #${paymentDetails.paymentId}`,
      template: EmailTemplate.PAYMENT_SUCCESSFUL,
      context: { ...paymentDetails },
    });
  }

  async sendPaymentFailed(email: string, paymentDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Payment Failed - Action Required`,
      template: EmailTemplate.PAYMENT_FAILED,
      context: { ...paymentDetails },
    });
  }

  async sendRefundEmail(email: string, refundDetails: any): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: `Refund Processed - #${refundDetails.refundId}`,
      template: EmailTemplate.REFUND_PROCESSED,
      context: { ...refundDetails },
    });
  }

  async sendPasswordReset(email: string, resetLink: string): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: 'Reset your password',
      template: EmailTemplate.PASSWORD_RESET,
      context: { resetLink },
    });
  }

  async sendEmailVerification(email: string, verificationLink: string): Promise<void> {
    await this.sendEmailWithRetry({
      email,
      subject: 'Verify your email address',
      template: EmailTemplate.EMAIL_VERIFICATION,
      context: { verificationLink },
    });
  }
}
