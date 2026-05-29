import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { CustomerStatus } from '@jitre/shared';
import { CustomerEntity } from './customer.entity';
import { ProjectEntity } from '../project/project.entity';
import {
  CreateCustomerDto,
  DEFAULT_CUSTOMER_COLOR,
} from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * Workspace-scoped customer / client directory.
 *
 * Soft-delete strategy mirrors {@link AreaService}: when a customer is removed
 * we nullify every `projects.customer_id` that referenced it within the same
 * transaction that stamps `deleted_at`.
 *
 * Name uniqueness is enforced case-insensitively and ignoring surrounding
 * whitespace via a partial unique index over `LOWER(TRIM(name))`. Conflicts
 * surface as `ConflictException('CUSTOMER_NAME_TAKEN')`.
 */
@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** Lists every customer in `workspaceId`, ordered by name ASC. */
  async list(workspaceId: string): Promise<CustomerEntity[]> {
    return this.customerRepo.find({
      where: { workspaceId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  /**
   * Returns a single customer or throws
   * `NotFoundException('CUSTOMER_NOT_FOUND')` when the row does not exist
   * (or has been soft-deleted, or belongs to another workspace).
   */
  async get(id: string, workspaceId: string): Promise<CustomerEntity> {
    const customer = await this.customerRepo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!customer) {
      throw new NotFoundException('CUSTOMER_NOT_FOUND');
    }
    return customer;
  }

  /**
   * Creates a new customer in `workspaceId`. Throws
   * `ConflictException('CUSTOMER_NAME_TAKEN')` when the name collides with
   * another active customer in the same workspace (case-insensitive,
   * whitespace-trimmed).
   */
  async create(
    workspaceId: string,
    dto: CreateCustomerDto,
    actorUserId: string,
  ): Promise<CustomerEntity> {
    await this.assertNameAvailable(workspaceId, dto.name);

    const customer = this.customerRepo.create({
      workspaceId,
      name: dto.name.trim(),
      status: CustomerStatus.ACTIVE,
      color: dto.color ?? DEFAULT_CUSTOMER_COLOR,
      icon: dto.icon ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      taxId: dto.taxId ?? null,
      address: dto.address ?? null,
      notes: dto.notes ?? null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.customerRepo.save(customer);
  }

  /** Partial update. Same uniqueness rule when `name` changes. */
  async update(
    id: string,
    workspaceId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerEntity> {
    const customer = await this.get(id, workspaceId);

    if (dto.name !== undefined && dto.name.trim() !== customer.name) {
      await this.assertNameAvailable(workspaceId, dto.name, id);
      customer.name = dto.name.trim();
    }
    if (dto.status !== undefined) customer.status = dto.status;
    if (dto.color !== undefined) customer.color = dto.color;
    if (dto.icon !== undefined) customer.icon = dto.icon ?? null;
    if (dto.email !== undefined) customer.email = dto.email ?? null;
    if (dto.phone !== undefined) customer.phone = dto.phone ?? null;
    if (dto.taxId !== undefined) customer.taxId = dto.taxId ?? null;
    if (dto.address !== undefined) customer.address = dto.address ?? null;
    if (dto.notes !== undefined) customer.notes = dto.notes ?? null;

    return this.customerRepo.save(customer);
  }

  /**
   * Soft-deletes the customer AND nullifies every `projects.customer_id`
   * that referenced it. Both writes happen in a single transaction.
   */
  async softDelete(id: string, workspaceId: string): Promise<void> {
    const customer = await this.get(id, workspaceId);

    await this.dataSource.transaction(async (em: EntityManager) => {
      await em.update(
        ProjectEntity,
        { workspaceId, customerId: customer.id },
        { customerId: null },
      );
      await em.softDelete(CustomerEntity, { id: customer.id });
    });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async assertNameAvailable(
    workspaceId: string,
    name: string,
    ignoreId?: string,
  ): Promise<void> {
    const normalized = name.trim().toLowerCase();
    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.workspace_id = :workspaceId', { workspaceId })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('LOWER(TRIM(c.name)) = :normalized', { normalized });
    if (ignoreId) qb.andWhere('c.id <> :ignoreId', { ignoreId });
    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('CUSTOMER_NAME_TAKEN');
    }
  }
}
