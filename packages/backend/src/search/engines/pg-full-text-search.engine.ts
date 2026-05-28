import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ISearchEngine,
  SearchEntityType,
  SearchHit,
  SearchQuery,
  SearchResult,
} from '../search-engine.interface';
import { SearchDocument } from '../search-document.entity';

@Injectable()
export class PgFullTextSearchEngine implements ISearchEngine {
  constructor(
    @InjectRepository(SearchDocument)
    private readonly repo: Repository<SearchDocument>,
  ) {}

  async upsert(doc: {
    workspaceId: string;
    entityType: SearchEntityType;
    entityId: string;
    content: string;
    occurredAt?: Date;
    parentType?: SearchEntityType | null;
    parentId?: string | null;
  }): Promise<void> {
    const occurredAt =
      doc.occurredAt?.toISOString() ?? new Date().toISOString();
    await this.repo.query(
      `
      INSERT INTO search_documents
        (id, workspace_id, entity_type, entity_id, content, tsvector,
         occurred_at, parent_type, parent_id)
      VALUES
        (uuid_generate_v4(), $1, $2, $3, $4, to_tsvector('simple', $4), $5, $6, $7)
      ON CONFLICT (workspace_id, entity_type, entity_id) WHERE deleted_at IS NULL
      DO UPDATE SET
        content      = EXCLUDED.content,
        tsvector     = EXCLUDED.tsvector,
        occurred_at  = EXCLUDED.occurred_at,
        parent_type  = EXCLUDED.parent_type,
        parent_id    = EXCLUDED.parent_id,
        updated_at   = NOW()
      `,
      [
        doc.workspaceId,
        doc.entityType,
        doc.entityId,
        doc.content,
        occurredAt,
        doc.parentType ?? null,
        doc.parentId ?? null,
      ],
    );
  }

  async delete(
    workspaceId: string,
    entityType: SearchEntityType,
    entityId: string,
  ): Promise<void> {
    await this.repo.softDelete({
      workspaceId,
      entityType,
      entityId,
      deletedAt: IsNull(),
    });
  }

  async search(q: SearchQuery): Promise<SearchResult> {
    const { workspaceId, query, entityType, page = 1, pageSize = 20 } = q;
    const trimmed = query.trim();

    if (!trimmed) {
      return { items: [], total: 0, page, pageSize };
    }

    const offset = (page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      this.repo.query(
        `
        SELECT
          entity_type  AS "entityType",
          entity_id    AS "entityId",
          workspace_id AS "workspaceId",
          occurred_at  AS "occurredAt",
          parent_type  AS "parentType",
          parent_id    AS "parentId",
          ts_rank_cd(tsvector, query) * boost AS rank,
          ts_headline('simple', content, query,
            'MaxFragments=2, MinWords=3, MaxWords=12') AS snippet
        FROM search_documents,
             plainto_tsquery('simple', $1) AS query
        WHERE workspace_id = $2
          AND deleted_at IS NULL
          AND ($3::text IS NULL OR entity_type = $3)
          AND tsvector @@ query
        ORDER BY rank DESC, occurred_at DESC
        LIMIT $4 OFFSET $5
        `,
        [trimmed, workspaceId, entityType ?? null, pageSize, offset],
      ),

      this.repo.query(
        `
        SELECT COUNT(*) AS count
        FROM search_documents,
             plainto_tsquery('simple', $1) AS query
        WHERE workspace_id = $2
          AND deleted_at IS NULL
          AND ($3::text IS NULL OR entity_type = $3)
          AND tsvector @@ query
        `,
        [trimmed, workspaceId, entityType ?? null],
      ),
    ]);

    return {
      items: rows,
      total: parseInt(countRows[0]?.count ?? '0', 10),
      page,
      pageSize,
    };
  }
}
