import { Global, Module } from '@nestjs/common';
import { CaseEventBus } from './case-event-bus.js';
import { CaseStreamService } from './case-stream.service.js';

@Global()
@Module({
  providers: [CaseEventBus, CaseStreamService],
  exports: [CaseEventBus, CaseStreamService],
})
export class EventsModule {}
