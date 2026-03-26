import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InternalController],
})
export class InternalModule {}
