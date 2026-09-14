import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CasesModule } from './cases/cases.module.js';
import { DatabaseModule } from './database/database.module.js';
import { IdentityModule } from './identity/identity.module.js';

@Module({
  imports: [DatabaseModule.forRoot(), IdentityModule.forRoot(), CasesModule],
  controllers: [AppController],
})
export class AppModule {}
