import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { UsersModule } from '../users/users.module';
import {
  ListingPhotoStorage,
  S3ListingPhotoStorageService,
} from './listing-photo-storage.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [AuthModule, UsersModule, SearchModule],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    {
      provide: ListingPhotoStorage,
      useClass: S3ListingPhotoStorageService,
    },
  ],
})
export class ListingsModule {}
