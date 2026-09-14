import { Module } from '@nestjs/common';
import { PublicAccessController, StaffAccessController } from './access.controllers.js';
import { AccessRecoveryService } from './access-recovery.service.js';

/** Access recovery (PH-7.1). Kept apart from CasesModule on purpose: no import, no shared service (RULE-SUP-01). */
@Module({
  controllers: [PublicAccessController, StaffAccessController],
  providers: [AccessRecoveryService],
})
export class AccessModule {}
