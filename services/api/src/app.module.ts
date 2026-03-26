import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GuildsModule } from './guilds/guilds.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { InvitesModule } from './invites/invites.module';
import { RolesModule } from './roles/roles.module';
// UploadsModule excluded: requires @nestjs/platform-express (incompatible with Fastify adapter)
import { ModerationModule } from './moderation/moderation.module';
// SearchModule excluded: meilisearch package not installed, not needed for demo
import { NotificationsModule } from './notifications/notifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DMsModule } from './dms/dms.module';
import { InternalModule } from './internal/internal.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    GuildsModule,
    ChannelsModule,
    MessagesModule,
    InvitesModule,
    RolesModule,
    ModerationModule,
    NotificationsModule,
    WebhooksModule,
    DMsModule,
    InternalModule,
    HealthModule,
    EmailModule,
  ],
})
export class AppModule {}
