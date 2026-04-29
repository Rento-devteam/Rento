import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString({ message: 'Введите пароль' })
  @MinLength(1, { message: 'Введите пароль' })
  password!: string;
}
