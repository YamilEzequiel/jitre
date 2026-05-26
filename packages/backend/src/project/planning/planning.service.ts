import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanningItemEntity, PlanningItemType } from './planning-item.entity';

export interface SavePlanningItemDto {
  workspaceId?: string;
  projectId?: string;
  type?: PlanningItemType;
  name?: string;
  goal?: string | null;
  status?: string;
  color?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

@Injectable()
export class PlanningService {
  constructor(
    @InjectRepository(PlanningItemEntity)
    private readonly planningRepo: Repository<PlanningItemEntity>,
  ) {}

  list(projectId: string, workspaceId: string, type?: PlanningItemType): Promise<PlanningItemEntity[]> {
    return this.planningRepo.find({
      where: { projectId, workspaceId, ...(type && { type }) },
      order: { startDate: 'ASC', createdAt: 'ASC' },
    });
  }

  create(dto: Required<Pick<SavePlanningItemDto, 'workspaceId' | 'projectId' | 'type' | 'name'>> & SavePlanningItemDto): Promise<PlanningItemEntity> {
    return this.planningRepo.save(
      this.planningRepo.create({
        workspaceId: dto.workspaceId,
        projectId: dto.projectId,
        type: dto.type,
        name: dto.name,
        goal: dto.goal ?? null,
        status: dto.status ?? 'planned',
        color: dto.color ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
      }),
    );
  }

  async update(id: string, projectId: string, workspaceId: string, dto: SavePlanningItemDto): Promise<PlanningItemEntity> {
    const item = await this.planningRepo.findOne({ where: { id, projectId, workspaceId } });
    if (!item) throw new NotFoundException('PLANNING_ITEM_NOT_FOUND');
    Object.assign(item, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.goal !== undefined && { goal: dto.goal }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.endDate !== undefined && { endDate: dto.endDate }),
    });
    return this.planningRepo.save(item);
  }

  async delete(id: string, projectId: string, workspaceId: string): Promise<void> {
    const item = await this.planningRepo.findOne({ where: { id, projectId, workspaceId } });
    if (!item) throw new NotFoundException('PLANNING_ITEM_NOT_FOUND');
    await this.planningRepo.softDelete(id);
  }
}
