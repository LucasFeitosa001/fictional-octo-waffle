import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarketingService } from './marketing.service';
import {
  CreateCashbackRuleDto,
  CreatePromotionDto,
  UpdateBookingLinkDto,
  UpdateCashbackRuleDto,
  UpdatePromotionDto,
  UpdateReviewSettingsDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

  // ---- booking link ----
  @Get('booking-link')
  getBookingLink(@CurrentUser('companyId') companyId: string) {
    return this.service.getBookingLink(companyId);
  }

  @Patch('booking-link')
  updateBookingLink(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateBookingLinkDto,
  ) {
    return this.service.updateBookingLink(companyId, dto);
  }

  // ---- promotions ----
  @Get('promotions')
  listPromotions(@CurrentUser('companyId') companyId: string) {
    return this.service.listPromotions(companyId);
  }

  @Post('promotions')
  createPromotion(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.service.createPromotion(companyId, dto);
  }

  @Patch('promotions/:id')
  updatePromotion(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.service.updatePromotion(companyId, id, dto);
  }

  @Delete('promotions/:id')
  removePromotion(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removePromotion(companyId, id);
  }

  // ---- reviews ----
  @Get('reviews')
  listReviews(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listReviews(companyId, from, to);
  }

  @Get('reviews/dashboard')
  reviewsDashboard(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getReviewsDashboard(companyId, from, to);
  }

  @Get('reviews/settings')
  getReviewSettings(@CurrentUser('companyId') companyId: string) {
    return this.service.getReviewSettings(companyId);
  }

  @Patch('reviews/settings')
  updateReviewSettings(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateReviewSettingsDto,
  ) {
    return this.service.updateReviewSettings(companyId, dto);
  }

  // ---- cashback rules ----
  @Get('cashback-rules')
  listCashbackRules(@CurrentUser('companyId') companyId: string) {
    return this.service.listCashbackRules(companyId);
  }

  @Post('cashback-rules')
  createCashbackRule(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCashbackRuleDto,
  ) {
    return this.service.createCashbackRule(companyId, dto);
  }

  @Patch('cashback-rules/:id')
  updateCashbackRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCashbackRuleDto,
  ) {
    return this.service.updateCashbackRule(companyId, id, dto);
  }

  @Delete('cashback-rules/:id')
  removeCashbackRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCashbackRule(companyId, id);
  }
}
