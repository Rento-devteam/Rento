import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddCardDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}
