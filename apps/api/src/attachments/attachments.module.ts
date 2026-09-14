import { type DynamicModule, Module } from '@nestjs/common';
import { AttachmentCleanupJob } from './attachment-cleanup.job.js';
import { AttachmentsService } from './attachments.service.js';
import { ATTACHMENT_STORAGE, LocalDiskStorage, MemoryStorage } from './storage.js';

export interface AttachmentsModuleOptions {
  /** Directory for stored files. Defaults to `SUPPORT_UPLOADS_DIR`, then `.data/uploads` (gitignored). */
  dir?: string;
  /** Keep files in memory (tests). */
  inMemory?: boolean;
}

@Module({})
export class AttachmentsModule {
  static forRoot(options: AttachmentsModuleOptions = {}): DynamicModule {
    return {
      module: AttachmentsModule,
      global: true,
      providers: [
        {
          provide: ATTACHMENT_STORAGE,
          useFactory: () =>
            options.inMemory ? new MemoryStorage() : new LocalDiskStorage(options.dir ?? process.env.SUPPORT_UPLOADS_DIR ?? '.data/uploads'),
        },
        AttachmentsService,
        AttachmentCleanupJob,
      ],
      exports: [AttachmentsService, ATTACHMENT_STORAGE],
    };
  }
}
