import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  search(@Req() request: RequestWithUser, @Query() query: SearchQueryDto) {
    const excludeOwnerId = request.user?.sub;
    return this.searchService.search(query, excludeOwnerId);
  }

  @Get('autocomplete')
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.searchService.autocomplete(query.q, query.limit ?? 10);
  }
}
