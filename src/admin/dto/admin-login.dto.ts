import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@red-auto.local' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}
