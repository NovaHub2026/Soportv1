import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { type CustomerNotification, markNotificationsReadSchema, type MarkNotificationsReadInput } from '@orbit-support/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, CustomerGuard } from '../identity/guards.js';
import type { CustomerActor } from '../identity/identity.types.js';
import { NotificationsService } from './notifications.service.js';

const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

/** Customer notifications (PH-6.1): own rows only; staff never read them through this surface. */
@Controller('support/notifications')
@UseGuards(CustomerGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentActor() actor: CustomerActor, @Query('limit', new ZodValidationPipe(limitSchema)) limit: number): Promise<{ notifications: CustomerNotification[]; unread: number }> {
    const [notifications, unread] = await Promise.all([this.notifications.list(actor, limit), this.notifications.unreadCount(actor)]);
    return { notifications, unread };
  }

  @Post('read')
  @HttpCode(200)
  async markRead(@CurrentActor() actor: CustomerActor, @Body(new ZodValidationPipe(markNotificationsReadSchema)) input: MarkNotificationsReadInput): Promise<{ marked: number; unread: number }> {
    const marked = await this.notifications.markRead(actor, input);
    return { marked, unread: await this.notifications.unreadCount(actor) };
  }
}
