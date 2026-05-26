import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomFieldEntity } from './custom-field.entity';
import { CustomFieldValidator } from './custom-field.validator';
import { EventBusService } from '../../events/event-bus.service';
import {
  CustomFieldCreatedEvent,
  CustomFieldUpdatedEvent,
  CustomFieldDeletedEvent,
} from '../events';
import { CustomFieldType, CustomFieldScope } from '@jitre/shared';

export interface CreateCustomFieldDto {
  workspaceId: string;
  projectId?: string | null;
  name: string;
  type: CustomFieldType;
  options?: string[] | null;
  required?: boolean;
  scope?: CustomFieldScope;
  actorUserId?: string;
}

export interface UpdateCustomFieldDto {
  name?: string;
  options?: string[] | null;
  required?: boolean;
  actorUserId?: string;
}

export interface DeleteCustomFieldDto {
  actorUserId?: string;
}

@Injectable()
export class CustomFieldService {
  private readonly validator = new CustomFieldValidator();

  constructor(
    @InjectRepository(CustomFieldEntity)
    private readonly fieldRepo: Repository<CustomFieldEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateCustomFieldDto): Promise<CustomFieldEntity> {
    // SELECT and MULTI_SELECT require options
    if (
      (dto.type === CustomFieldType.SELECT ||
        dto.type === CustomFieldType.MULTI_SELECT) &&
      (!dto.options || dto.options.length === 0)
    ) {
      throw new BadRequestException('CUSTOM_FIELD_SELECT_REQUIRES_OPTIONS');
    }

    const field = this.fieldRepo.create({
      workspaceId: dto.workspaceId,
      projectId: dto.projectId ?? null,
      name: dto.name,
      type: dto.type,
      options: dto.options ?? null,
      required: dto.required ?? false,
      scope: dto.scope ?? CustomFieldScope.WORKSPACE,
    });
    const saved = await this.fieldRepo.save(field);

    this.eventBus.publish(
      new CustomFieldCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'CustomField',
        actorUserId: dto.actorUserId,
        workspaceId: dto.workspaceId,
        payload: {
          customFieldId: saved.id,
          projectId: saved.projectId ?? null,
          name: saved.name,
          type: saved.type,
        },
      }),
    );

    return saved;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldEntity> {
    const field = await this.fieldRepo.findOne({ where: { id, workspaceId } });
    if (!field) throw new NotFoundException('CUSTOM_FIELD_NOT_FOUND');

    Object.assign(field, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.options !== undefined && { options: dto.options }),
      ...(dto.required !== undefined && { required: dto.required }),
    });

    const saved = await this.fieldRepo.save(field);

    this.eventBus.publish(
      new CustomFieldUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'CustomField',
        actorUserId: dto.actorUserId,
        workspaceId: saved.workspaceId,
        payload: {
          customFieldId: saved.id,
          changes: { ...dto } as Record<string, unknown>,
        },
      }),
    );

    return saved;
  }

  async delete(id: string, workspaceId: string, dto: DeleteCustomFieldDto): Promise<void> {
    const field = await this.fieldRepo.findOne({ where: { id, workspaceId } });
    if (!field) throw new NotFoundException('CUSTOM_FIELD_NOT_FOUND');

    await this.fieldRepo.delete(id);

    this.eventBus.publish(
      new CustomFieldDeletedEvent({
        aggregateId: id,
        aggregateType: 'CustomField',
        actorUserId: dto.actorUserId,
        workspaceId: field.workspaceId,
        payload: { customFieldId: id },
      }),
    );
  }

  async list(filters: {
    projectId?: string;
    workspaceId?: string;
  }): Promise<CustomFieldEntity[]> {
    if (filters.projectId) {
      return this.fieldRepo.find({
        where: { projectId: filters.projectId, workspaceId: filters.workspaceId },
        order: { name: 'ASC' },
      });
    }
    return this.fieldRepo.find({
      where: { workspaceId: filters.workspaceId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Validates task custom field values against the project's definitions.
   * Returns an array of BadRequestException for each invalid field.
   */
  async validateTaskCustomFields(
    projectId: string,
    workspaceId: string,
    values: Record<string, unknown>,
  ): Promise<BadRequestException[]> {
    const definitions = await this.fieldRepo.find({
      where: { projectId, workspaceId },
    });

    const definitionMap = new Map(definitions.map((d) => [d.id, d]));
    const errors: BadRequestException[] = [];

    for (const [fieldId, value] of Object.entries(values)) {
      const def = definitionMap.get(fieldId);
      if (!def) {
        errors.push(
          new BadRequestException(`CUSTOM_FIELD_UNKNOWN_ID: ${fieldId}`),
        );
        continue;
      }

      try {
        this.validator.validate(def, value);
      } catch (err) {
        if (err instanceof BadRequestException) {
          errors.push(err);
        }
      }
    }

    return errors;
  }
}
