import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RefreshTokenPayload } from './interfaces/refresh-token-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Web portal login' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthTokensDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  @ResponseMessage('Login successful')
  public login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.authService.login(dto);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Rotate an access/refresh token pair' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthTokensDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or revoked refresh token' })
  @ResponseMessage('Token refreshed successfully')
  public refresh(@Body() _dto: RefreshTokenDto, @Req() req: Request): Promise<AuthTokensDto> {
    const payload = req.user as RefreshTokenPayload & { raw: string };
    return this.authService.refresh(payload);
  }
}
