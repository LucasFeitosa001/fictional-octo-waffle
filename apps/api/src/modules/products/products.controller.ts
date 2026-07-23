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
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

// RBAC: catálogo (categorias/marcas/produtos) + estoque (movimentos/lotes).
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // ---- product-categories ----
  @Get('product-categories')
  @RequirePermission('catalogo:view')
  listCategories(@CurrentUser('companyId') companyId: string) {
    return this.service.listCategories(companyId);
  }

  @Post('product-categories')
  @RequirePermission('catalogo:manage')
  createCategory(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.service.createCategory(companyId, dto);
  }

  @Patch('product-categories/:id')
  @RequirePermission('catalogo:manage')
  updateCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.service.updateCategory(companyId, id, dto);
  }

  @Delete('product-categories/:id')
  @RequirePermission('catalogo:manage')
  removeCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCategory(companyId, id);
  }

  // ---- brands ----
  // ?status=active|inactive filtra por Brand.active (Status real).
  @Get('brands')
  @RequirePermission('catalogo:view')
  listBrands(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    const normalized =
      status === 'active' || status === 'inactive' ? status : undefined;
    return this.service.listBrands(companyId, normalized);
  }

  @Post('brands')
  @RequirePermission('catalogo:manage')
  createBrand(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateBrandDto,
  ) {
    return this.service.createBrand(companyId, dto);
  }

  @Patch('brands/:id')
  @RequirePermission('catalogo:manage')
  updateBrand(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.service.updateBrand(companyId, id, dto);
  }

  @Delete('brands/:id')
  @RequirePermission('catalogo:manage')
  removeBrand(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeBrand(companyId, id);
  }

  // ---- products ----
  @Get('products')
  @RequirePermission('catalogo:view')
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
  @RequirePermission('catalogo:view')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  @Post('products')
  @RequirePermission('catalogo:manage')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch('products/:id')
  @RequirePermission('catalogo:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete('products/:id')
  @RequirePermission('catalogo:manage')
  remove(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, id);
  }

  // Movimento de estoque → permissão de estoque, não de catálogo.
  @Post('products/:id/movements')
  @RequirePermission('estoque:manage')
  createMovement(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: StockMovementDto,
  ) {
    return this.service.createMovement(companyId, id, dto);
  }

  // ---- product-batches (lotes) ----
  @Get('product-batches')
  @RequirePermission('catalogo:view')
  listBatches(
    @CurrentUser('companyId') companyId: string,
    @Query('productId') productId?: string,
  ) {
    return this.service.listBatches(companyId, productId);
  }

  @Post('product-batches')
  @RequirePermission('estoque:manage')
  createBatch(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateProductBatchDto,
  ) {
    return this.service.createBatch(companyId, dto);
  }

  @Patch('product-batches/:id')
  @RequirePermission('estoque:manage')
  updateBatch(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductBatchDto,
  ) {
    return this.service.updateBatch(companyId, id, dto);
  }

  @Delete('product-batches/:id')
  @RequirePermission('estoque:manage')
  removeBatch(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeBatch(companyId, id);
  }
}
