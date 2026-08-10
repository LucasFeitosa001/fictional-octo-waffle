import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../auth/better-auth';
import { PublicBookingService, type BookingUser } from './public-booking.service';
import { CreateBookingDto, CreateReviewDto, UpdateMyProfileDto } from './dto';

/**
 * Public, unauthenticated booking portal.
 *
 * Salons are addressed by their BookingLink slug. Customers can browse services,
 * professionals and availability without logging in. Booking accepts either a
 * logged-in Better Auth *customer* session or a guest identity (quick booking).
 *
 * Mounted at `api/v1/public/booking` (global prefix `api/v1`).
 */
@Controller('public/booking')
export class PublicBookingController {
  constructor(private readonly service: PublicBookingService) {}

  @Get(':slug')
  getPortal(@Param('slug') slug: string) {
    return this.service.getPortal(slug);
  }

  @Get(':slug/services')
  getServices(@Param('slug') slug: string) {
    return this.service.getServices(slug);
  }

  @Get(':slug/professionals')
  getProfessionals(
    @Param('slug') slug: string,
    @Query('serviceId') serviceId: string,
    @Query('serviceIds') serviceIds?: string,
  ) {
    const ids = serviceIds ? serviceIds.split(',').filter(Boolean) : [serviceId];
    return this.service.getProfessionals(slug, ids[0], ids.length > 1 ? ids : undefined);
  }

  @Get(':slug/availability')
  getAvailability(
    @Param('slug') slug: string,
    @Query('serviceId') serviceId: string,
    @Query('professionalId') professionalId: string,
    @Query('date') date?: string,
    @Query('serviceIds') serviceIds?: string,
  ) {
    const ids = serviceIds ? serviceIds.split(',').filter(Boolean) : undefined;
    return this.service.getAvailability(slug, serviceId, professionalId, date, ids);
  }

  // Public availability view (free/busy per professional, no customer data).
  @Get(':slug/agenda')
  getAgenda(
    @Param('slug') slug: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAgenda(slug, from, to);
  }

  @Post(':slug/appointments')
  async book(
    @Param('slug') slug: string,
    @Body() dto: CreateBookingDto,
    @Req() req: Request,
  ) {
    // Optional auth: if a valid customer session is present, book on their behalf
    // and link the Customer to the account. Otherwise treat as a guest booking.
    const user = await this.resolveSessionUser(req);
    return this.service.book(slug, dto, user);
  }

  // The logged-in customer's editable profile (name + WhatsApp).
  @Get(':slug/my-profile')
  async myProfile(@Param('slug') slug: string, @Req() req: Request) {
    const user = await this.requireSessionUser(req);
    return this.service.getMyProfile(slug, user);
  }

  @Patch(':slug/my-profile')
  async updateMyProfile(
    @Param('slug') slug: string,
    @Body() dto: UpdateMyProfileDto,
    @Req() req: Request,
  ) {
    const user = await this.requireSessionUser(req);
    return this.service.updateMyProfile(slug, user, dto);
  }

  // Logged-in customer's own appointments at this salon (status reflects any
  // admin-side cancellations). Requires a customer session.
  @Get(':slug/my-appointments')
  async myAppointments(@Param('slug') slug: string, @Req() req: Request) {
    const user = await this.requireSessionUser(req);
    return this.service.getMyAppointments(slug, user);
  }

  @Post(':slug/my-appointments/:id/cancel')
  async cancelMine(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = await this.requireSessionUser(req);
    return this.service.cancelMyAppointment(slug, user, id);
  }

  // Customer leaves a star rating for a finished appointment of theirs.
  @Post(':slug/my-appointments/:id/review')
  async reviewMine(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
  ) {
    const user = await this.requireSessionUser(req);
    return this.service.reviewMyAppointment(slug, user, id, dto);
  }

  // In-app notification feed for the logged-in customer (the club app bell).
  @Get(':slug/my-notifications')
  async myNotifications(
    @Param('slug') slug: string,
    @Query('limit') limit: string | undefined,
    @Req() req: Request,
  ) {
    const user = await this.requireSessionUser(req);
    return this.service.getMyNotifications(slug, user, limit ? Number(limit) : 30);
  }

  @Post(':slug/my-notifications/:id/read')
  async readMyNotification(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = await this.requireSessionUser(req);
    return this.service.markMyNotificationRead(slug, user, id);
  }

  @Post(':slug/my-notifications/read-all')
  async readAllMyNotifications(@Param('slug') slug: string, @Req() req: Request) {
    const user = await this.requireSessionUser(req);
    return this.service.markAllMyNotificationsRead(slug, user);
  }

  private async requireSessionUser(req: Request): Promise<BookingUser> {
    const user = await this.resolveSessionUser(req);
    if (!user) throw new UnauthorizedException('Faça login para ver seus agendamentos');
    return user;
  }

  private async resolveSessionUser(req: Request): Promise<BookingUser | null> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const u = session?.user as
        | (BookingUser & { accountType?: string | null })
        | undefined;
      if (!u || u.accountType !== 'customer') return null;
      return { id: u.id, name: u.name, email: u.email, phone: u.phone };
    } catch {
      return null;
    }
  }
}
