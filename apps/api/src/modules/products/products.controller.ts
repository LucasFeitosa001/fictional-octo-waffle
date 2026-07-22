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
import { ProductsService } from './products.service';
import {
  CreateBrandDto,
  CreateProductBatchDto,
  CreateProductCategoryDto,
  CreateProductDto,
  StockMovementDto,
  UpdateBrandDto,
  UpdateProductBatchDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // ---- product-categories ----
  @Get('product-categories')
  listCategories(@CurrentUser('companyId') companyId: string) {
    return this.service.listCategories(companyId);
  }

  @Post('product-categories')
  createCategory(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.service.createCategory(companyId, dto);
  }

  @Patch('product-categories/:id')
  updateCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.service.updateCategory(companyId, id, dto);
  }

  @Delete('product-categories/:id')
  removeCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCategory(companyId, id);
  }

  // ---- brands ----
  // ?status=active|inactive filtra por Brand.active (Status real).
  @Get('brands')
  listBrands(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    const normalized =
      status === 'active' || status === 'inactive' ? status : undefined;
    return this.service.listBrands(companyId, normalized);
  }

  @Post('brands')
  createBrand(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateBrandDto,
  ) {
    return this.service.createBrand(companyId, dto);
  }

  @Patch('brands/:id')
  updateBrand(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.service.updateBrand(companyId, id, dto);
  }

  @Delete('brands/:id')
  removeBrand(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeBrand(companyId, id);
  }

  // ---- products ----
  @Get('products')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.service.list(companyId, {
      categoryId,
      search,
      lowStock: lowStock === 'true' || lowStock === '1',
    });
  }

  @Get('products/:id')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  @Post('products')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch('products/:id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete('products/:id')
  remove(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, id);
  }

  @Post('products/:id/movements')
  createMovement(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: StockMovementDto,
  ) {
    return this.service.createMovement(companyId, id, dto);
  }

  // ---- product-batches (lotes) ----
  @Get('product-batches')
  listBatches(
    @CurrentUser('companyId') companyId: string,
    @Query('productId') productId?: string,
  ) {
    return this.service.listBatches(companyId, productId);
  }

  @Post('product-batches')
  createBatch(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProductBatchDto,
  ) {
    return this.service.createBatch(companyId, dto);
  }

  @Patch('product-batches/:id')
  updateBatch(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductBatchDto,
  ) {
    return this.service.updateBatch(companyId, id, dto);
  }

  @Delete('product-batches/:id')
  removeBatch(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeBatch(companyId, id);
  }
}
