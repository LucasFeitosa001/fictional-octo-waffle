import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { prisma } from '@beautypass/db';

/**
 * Wraps the singleton PrismaClient from @beautypass/db.
 * Connection is lazy + guarded so missing DB does not crash boot (DB optional in dev).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client = prisma;

  async onModuleInit() {
    try {
      await this.client.$connect();
      this.logger.log('Prisma connected');
    } catch (err) {
      // DB optional: log and continue so build/typecheck/boot do not crash.
      this.logger.warn(`Prisma connection failed (DB optional in dev): ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.$disconnect();
    } catch {
      // noop
    }
  }
}
