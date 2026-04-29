import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_FORMAT_MESSAGE, PASSWORD_PATTERN } from '../password-policy';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_FORMAT_MESSAGE })
  password!: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  /** Отображаемое имя (как «Имя пользователя» в форме регистрации). */
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Имя не длиннее 120 символов' })
  fullName?: string;
}
