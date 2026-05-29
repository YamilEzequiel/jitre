import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { CustomerService } from './customer.service';
import { CustomerEntity } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('customers')
@ApiBearerAuth('access-token')
@ApiSecurity('workspace')
@Controller('workspaces/:workspaceId/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @ApiOperation({ summary: 'List customers in a workspace' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH' })
  @Get()
  async list(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Req() req: AuthRequest,
  ): Promise<CustomerEntity[]> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.customerService.list(workspaceId);
  }

  @ApiOperation({ summary: 'Get a single customer by ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH' })
  @ApiResponse({ status: 404, description: 'CUSTOMER_NOT_FOUND' })
  @Get(':id')
  async get(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<CustomerEntity> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.customerService.get(id, workspaceId);
  }

  @ApiOperation({ summary: 'Create a new customer (requires ADMIN role)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH / INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 409, description: 'CUSTOMER_NAME_TAKEN' })
  @Post()
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateCustomerDto,
    @Req() req: AuthRequest,
  ): Promise<CustomerEntity> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.customerService.create(workspaceId, dto, req.user!.id);
  }

  @ApiOperation({ summary: 'Update a customer (requires ADMIN role)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH / INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 404, description: 'CUSTOMER_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'CUSTOMER_NAME_TAKEN' })
  @Patch(':id')
  @RequireRole(WorkspaceRole.ADMIN)
  async update(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: AuthRequest,
  ): Promise<CustomerEntity> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.customerService.update(id, workspaceId, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a customer (requires ADMIN role)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH / INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 404, description: 'CUSTOMER_NOT_FOUND' })
  @Delete(':id')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    this.assertWorkspaceMatch(workspaceId, req);
    await this.customerService.softDelete(id, workspaceId);
  }

  private assertWorkspaceMatch(workspaceId: string, req: AuthRequest): void {
    if (req.workspace?.id !== workspaceId) {
      throw new ForbiddenException('WORKSPACE_MISMATCH');
    }
  }
}
