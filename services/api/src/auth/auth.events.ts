import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

interface PasswordResetRequestedEvent {
  userId: string;
  email: string;
  resetToken: string;
}

@Injectable()
export class AuthEventsHandler {
  private readonly logger = new Logger(AuthEventsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent('user.passwordResetRequested')
  async onPasswordResetRequested(event: PasswordResetRequestedEvent): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: event.userId },
      select: { username: true },
    });

    const username = user?.username ?? event.email.split('@')[0] ?? 'there';
    await this.emailService.sendPasswordReset(event.email, event.resetToken, username);
    this.logger.log(`Password reset email dispatched for ${event.email}`);
  }
}
