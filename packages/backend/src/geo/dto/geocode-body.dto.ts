import { IsString, MaxLength, MinLength } from 'class-validator';

export class GeocodeBodyDto {
  @IsString()
  @MinLength(2, { message: 'Адрес не короче 2 символов' })
  @MaxLength(500, { message: 'Адрес не длиннее 500 символов' })
  query!: string;
}
