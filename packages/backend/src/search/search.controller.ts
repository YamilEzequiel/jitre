import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchResult } from './search-engine.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator';

@ApiTags('search')
@ApiBearerAuth('access-token')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @ApiOperation({ summary: 'Full-text search within a workspace' })
  @ApiResponse({ status: 200, description: 'Ranked search results.' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  @ApiResponse({ status: 403, description: 'Not a workspace member.' })
  @Get()
  async search(
    @Query() dto: SearchQueryDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<SearchResult> {
    return this.searchService.search({
      workspaceId,
      query: dto.q,
      entityType: dto.type,
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }
}
