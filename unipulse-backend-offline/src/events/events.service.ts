import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: any) {
    return this.prisma.event.create({ data: { ...dto, creatorId: userId } });
  }

  list() {
    return this.prisma.event.findMany({ include: { attendees: true } });
  }

  async get(id: string) {
    const e = await this.prisma.event.findUnique({ where: { id }, include: { attendees: true } });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  rsvp(userId: string, eventId: string, status: string) {
    return this.prisma.eventRSVP.upsert({
      where: { id: `${userId}-${eventId}` },
      create: { userId, eventId, status },
      update: { status },
    });
  }

  // Admin update/delete omitted for brevity
}