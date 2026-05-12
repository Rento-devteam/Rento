import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GeocodeBodyDto } from './dto/geocode-body.dto';
import { ReverseGeocodeBodyDto } from './dto/reverse-geocode-body.dto';
import { GeoService } from './geo.service';

@UseGuards(JwtAuthGuard)
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  /** Текст адреса → координаты + нормализованная строка (через Yandex Geocoder на бэкенде). */
  @Post('geocode')
  async geocode(@Body() body: GeocodeBodyDto) {
    return this.geoService.geocodeForward(body.query);
  }

  /** Координаты → адрес + те же координаты (обратное геокодирование). */
  @Post('reverse-geocode')
  async reverse(@Body() body: ReverseGeocodeBodyDto) {
    return this.geoService.geocodeReverse(body.latitude, body.longitude);
  }
}
