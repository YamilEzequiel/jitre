import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { SearchDocument } from './search-document.entity';
import { TaskLabelEntity } from '../task/task-label.entity';
import { SEARCH_ENGINE } from './search-engine.interface';
import { PgFullTextSearchEngine } from './engines/pg-full-text-search.engine';
import { ElasticsearchEngine } from './engines/elasticsearch.engine.stub';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { IndexerListener } from './indexer.listener';
import { QUEUES } from '../jobs/queues.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchDocument, TaskLabelEntity]),
    BullModule.registerQueue({ name: QUEUES.SEARCH_INDEXER }),
  ],
  providers: [
    {
      provide: SEARCH_ENGINE,
      inject: [ConfigService, PgFullTextSearchEngine],
      useFactory: (cfg: ConfigService, pgEngine: PgFullTextSearchEngine) => {
        const engine =
          cfg.get<string>('SEARCH_ENGINE') ?? process.env.SEARCH_ENGINE ?? 'pg';
        if (engine === 'elasticsearch') {
          return new ElasticsearchEngine();
        }
        return pgEngine;
      },
    },
    PgFullTextSearchEngine,
    SearchService,
    IndexerListener,
  ],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
