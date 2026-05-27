import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserReportsToEntity } from './user-reports-to.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { UserEntity } from '../user/user.entity';
import { OrgGraphService } from './org-graph.service';
import { OrgGraphController } from './org-graph.controller';

/**
 * Org Graph — user reports-to relationships.
 *
 * v1 deliberately only protects against DIRECT cycles (A↔B). Multi-hop cycle
 * detection (A→B→C→A) is intentionally out of scope: the read path
 * (`getOrgGraph`) returns the raw edges and the frontend renders the graph,
 * so a transient indirect cycle is visible immediately and an admin can
 * fix it by removing one edge. Adding full transitive cycle detection
 * would require either an in-memory DFS on every add (O(n)) or a recursive
 * CTE on Postgres, both of which add cost we don't need yet at the size
 * we're modelling. Revisit when org-charts grow past a few thousand edges.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserReportsToEntity,
      WorkspaceMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [OrgGraphController],
  providers: [OrgGraphService],
  exports: [OrgGraphService],
})
export class OrgGraphModule {}
