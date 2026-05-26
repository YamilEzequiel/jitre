import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { CommentContext } from '@jitre/shared';

@Entity('comments')
@Index(['workspaceId', 'contextType', 'contextId', 'createdAt'])
@Index(['workspaceId', 'authorUserId', 'createdAt'])
export class Comment extends TenantEntity {
  @ApiProperty({ enum: CommentContext })
  @Column({ name: 'context', type: 'text' })
  contextType!: CommentContext;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  contextId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  authorUserId!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  body!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  /**
   * Self-referential ManyToOne. Only one level of nesting is allowed at the
   * service layer (depth check via parent.parentId !== null).
   */
  @ManyToOne(() => Comment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Comment | null;
}
