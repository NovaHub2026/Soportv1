import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Actor, ORBIT_IDENTITY, type OrbitIdentityPort } from './identity.types.js';

export type RequestWithActor = Request & { actor?: Actor };

async function resolveActor(context: ExecutionContext, identity: OrbitIdentityPort): Promise<Actor> {
  const request = context.switchToHttp().getRequest<RequestWithActor>();
  const actor = request.actor ?? (await identity.resolve(request.headers));
  if (!actor) throw new UnauthorizedException('identity_required');
  request.actor = actor;
  return actor;
}

/** Customer surfaces: `/support/*`. A staff identity is refused here so roles never blur (RULE-SUP-01). */
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(@Inject(ORBIT_IDENTITY) private readonly identity: OrbitIdentityPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actor = await resolveActor(context, this.identity);
    if (actor.kind !== 'customer') throw new ForbiddenException('customer_only');
    return true;
  }
}

/** Staff surfaces: `/staff/*`. */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(@Inject(ORBIT_IDENTITY) private readonly identity: OrbitIdentityPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actor = await resolveActor(context, this.identity);
    if (actor.kind !== 'staff') throw new ForbiddenException('staff_only');
    return true;
  }
}

/** The actor resolved by a guard on this request. */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  const actor = context.switchToHttp().getRequest<RequestWithActor>().actor;
  if (!actor) throw new UnauthorizedException('identity_required');
  return actor;
});
