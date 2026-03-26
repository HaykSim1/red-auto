import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class OtpVerifyDto {
  @ApiProperty({ example: '+37494123456' })
  @IsString()
  @Matches(/^\+374\d{8}$/, {
    message: 'phone must be E.164 Armenia (+374 followed by 8 digits)',
  })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code: string;
}
