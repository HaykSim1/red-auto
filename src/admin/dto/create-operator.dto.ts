import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Admin creates a staff operator: email + password login to the admin panel, no OTP. */
export class CreateOperatorDto {
  @ApiProperty({ example: 'op@red-auto.store' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, example: 'correct-horse-battery' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Ani' })
  @IsString()
  @Matches(/\S/, { message: 'display_name must not be blank' })
  @MaxLength(200)
  display_name: string;

  @ApiProperty({
    example: '+37491123456',
    description:
      "Operator's own phone (E.164 Armenia); unique account identifier.",
  })
  @IsString()
  @Matches(/^\+374\d{8}$/, {
    message: 'phone must be E.164 Armenia (+374 followed by 8 digits)',
  })
  phone: string;
}
