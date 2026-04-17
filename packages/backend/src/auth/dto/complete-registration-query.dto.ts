import { IsEmail } from 'class-validator';

export class CompleteRegistrationQueryDto {
  @IsEmail()
  email!: string;
}
