import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  /** Отображаемое имя (как «Имя пользователя» в форме регистрации). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
