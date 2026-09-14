import { Module } from '@nestjs/common';
import { AccessModule } from './access/access.module.js';
import { AppController } from './app.controller.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { CasesModule } from './cases/cases.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EventsModule } from './events/events.module.js';
import { IdentityModule } from './identity/identity.module.js';

@Module({
  imports: [DatabaseModule.forRoot(), IdentityModule.forRoot(), EventsModule, AttachmentsModule.forRoot(), CasesModule, AccessModule],
  controllers: [AppController],
})
export class AppModule {}
