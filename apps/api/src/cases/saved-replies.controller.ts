import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { type SavedReply, type SavedReplyInput, savedReplyInputSchema } from '@orbit-support/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { SavedRepliesService } from './saved-replies.service.js';

/** Saved replies (PH-5.3). Staff only; customers never see templates. */
@Controller('staff/saved-replies')
@UseGuards(StaffGuard)
export class SavedRepliesController {
  constructor(private readonly replies: SavedRepliesService) {}

  @Get()
  list(): Promise<SavedReply[]> {
    return this.replies.list();
  }

  @Post()
  @HttpCode(201)
  create(@CurrentActor() actor: StaffActor, @Body(new ZodValidationPipe(savedReplyInputSchema)) input: SavedReplyInput): Promise<SavedReply> {
    return this.replies.create(actor, input);
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(savedReplyInputSchema)) input: SavedReplyInput,
  ): Promise<SavedReply> {
    return this.replies.update(actor, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentActor() actor: StaffActor, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.replies.remove(actor, id);
  }
}
