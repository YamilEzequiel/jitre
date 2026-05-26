import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { ProjectRole } from '@jitre/shared';

@Entity('project_memberships')
@Index(['workspaceId', 'projectId'])
@Unique(['projectId', 'userId'])
export class ProjectMembershipEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  projectId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ProjectRole })
  @Column({ type: 'varchar', default: ProjectRole.CONTRIBUTOR })
  role!: ProjectRole;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  assignedAt!: Date;

  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: unknown;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: {
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}
