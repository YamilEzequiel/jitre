import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AiPromptOperation, AiPromptTemplateEntity } from './ai-prompt-template.entity';
import { CreateAiPromptTemplateDto } from './dto/create-ai-prompt-template.dto';
import { UpdateAiPromptTemplateDto } from './dto/update-ai-prompt-template.dto';

interface ListOptions {
  operation?: AiPromptOperation;
}

@Injectable()
export class AiPromptTemplateService {
  constructor(
    @InjectRepository(AiPromptTemplateEntity)
    private readonly repo: Repository<AiPromptTemplateEntity>,
  ) {}

  async list(workspaceId: string, opts: ListOptions = {}): Promise<AiPromptTemplateEntity[]> {
    const where: Record<string, unknown> = { workspaceId, deletedAt: IsNull() };
    if (opts.operation) where['operation'] = opts.operation;
    return this.repo.find({
      where,
      order: { isBuiltin: 'DESC', isDefault: 'DESC', name: 'ASC' },
    });
  }

  async getById(workspaceId: string, id: string): Promise<AiPromptTemplateEntity> {
    const row = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException('ai_prompt_template_not_found');
    return row;
  }

  /**
   * Return the workspace's default template for an operation, or null
   * if none is set. Callers fall back to the hard-coded prompt when
   * this returns null — the platform stays usable without seed data.
   */
  async getDefaultFor(
    workspaceId: string,
    operation: AiPromptOperation,
  ): Promise<AiPromptTemplateEntity | null> {
    return this.repo.findOne({
      where: { workspaceId, operation, isDefault: true, deletedAt: IsNull() },
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateAiPromptTemplateDto,
  ): Promise<AiPromptTemplateEntity> {
    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AiPromptTemplateEntity);
      // If the caller asks for default, clear the previous default for
      // the (workspace, operation) tuple so the partial unique index
      // never trips.
      if (dto.isDefault) {
        await repo.update(
          { workspaceId, operation: dto.operation, isDefault: true, deletedAt: IsNull() },
          { isDefault: false },
        );
      }

      const entity = repo.create({
        workspaceId,
        operation: dto.operation,
        name: dto.name,
        description: dto.description ?? null,
        systemPrompt: dto.systemPrompt,
        userTemplate: dto.userTemplate,
        variables: dto.variables ?? [],
        isDefault: dto.isDefault ?? false,
        isBuiltin: false,
        createdByUserId: userId,
        createdBy: userId,
        updatedBy: userId,
      });
      return repo.save(entity);
    });
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdateAiPromptTemplateDto,
  ): Promise<AiPromptTemplateEntity> {
    const existing = await this.getById(workspaceId, id);
    if (existing.isBuiltin) {
      throw new ForbiddenException('cannot_edit_builtin_template');
    }
    if (dto.operation && dto.operation !== existing.operation) {
      throw new BadRequestException('cannot_change_template_operation');
    }

    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AiPromptTemplateEntity);
      if (dto.isDefault === true && !existing.isDefault) {
        // Clear any other default before flipping this one.
        await repo.update(
          {
            workspaceId,
            operation: existing.operation,
            isDefault: true,
            deletedAt: IsNull(),
          },
          { isDefault: false },
        );
      }

      const next = repo.merge(existing, {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt } : {}),
        ...(dto.userTemplate !== undefined ? { userTemplate: dto.userTemplate } : {}),
        ...(dto.variables !== undefined ? { variables: dto.variables } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        updatedBy: userId,
      });
      return repo.save(next);
    });
  }

  /** Toggle the default flag on, demoting any prior default. */
  async setDefault(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<AiPromptTemplateEntity> {
    const existing = await this.getById(workspaceId, id);
    if (existing.isDefault) return existing;

    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AiPromptTemplateEntity);
      await repo.update(
        {
          workspaceId,
          operation: existing.operation,
          isDefault: true,
          deletedAt: IsNull(),
        },
        { isDefault: false },
      );
      existing.isDefault = true;
      existing.updatedBy = userId;
      return repo.save(existing);
    });
  }

  async remove(workspaceId: string, userId: string, id: string): Promise<void> {
    const existing = await this.getById(workspaceId, id);
    if (existing.isBuiltin) {
      throw new ForbiddenException('cannot_delete_builtin_template');
    }
    if (existing.isDefault) {
      throw new ConflictException(
        'cannot_delete_default_template_set_another_default_first',
      );
    }
    existing.updatedBy = userId;
    await this.repo.save(existing);
    await this.repo.softDelete(id);
  }

  /**
   * Substitute {{variable}} placeholders against a context map.
   * Unknown placeholders are kept verbatim so the AI can still see them
   * (and the caller knows from inspection which variable was missing).
   */
  interpolate(template: string, vars: Record<string, string | number | undefined>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, name: string) => {
      const value = vars[name];
      return value === undefined || value === null ? full : String(value);
    });
  }
}
