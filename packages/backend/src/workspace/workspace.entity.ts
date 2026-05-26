import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { UserEntity } from '../user/user.entity';

@Entity('workspaces')
export class WorkspaceEntity extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner!: UserEntity;

  @OneToMany(
    'WorkspaceMembershipEntity',
    (m: { workspace: WorkspaceEntity }) => m.workspace,
  )
  memberships!: unknown[];
}
