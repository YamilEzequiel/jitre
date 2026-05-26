import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { UserEntity } from '../user/user.entity';
import { WorkspaceEntity } from './workspace.entity';

@Entity('workspace_memberships')
export class WorkspaceMembershipEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'text', default: 'member' })
  role!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: WorkspaceEntity;
}
