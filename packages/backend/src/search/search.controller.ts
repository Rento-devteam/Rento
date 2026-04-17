import {
  Controller,
  Get,
  HttpStatus,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
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
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('autocomplete')
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.searchService.autocomplete(query.q, query.limit ?? 10);
  }
}
