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
  async search(@Query() dto: SearchQueryDto): Promise<SearchResult> {
    return this.searchService.search({
      workspaceId: dto.workspaceId,
      query: dto.q,
      entityType: dto.type,
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }
}
