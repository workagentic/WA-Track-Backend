import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PairingService } from './pairing.service';
import { ConfirmPairingDto } from './dto/confirm-pairing.dto';
import { PollTokenDto } from './dto/poll-token.dto';
import { PairingDeviceCodeResponseDto } from './dto/device-code-response.dto';
import { PairingTokenResponseDto } from './dto/pairing-token-response.dto';

@ApiTags('pairing')
@Controller('auth/pairing')
export class PairingController {
  constructor(private pairingService: PairingService) {}

  @Post('device-code')
  @HttpCode(HttpStatus.CREATED) // a new PairingCode row is created
  @ApiOperation({ summary: 'Called by the desktop app on launch to start the pairing flow' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PairingDeviceCodeResponseDto })
  @ResponseMessage('Device code generated successfully')
  public createDeviceCode(): Promise<PairingDeviceCodeResponseDto> {
    return this.pairingService.createDeviceCode();
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK) // links an existing PairingCode to an employee — no new resource
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Called by the web portal to link a device code to the logged-in employee' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Device code confirmed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Unknown or already-used pairing code' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Code already confirmed' })
  @ApiResponse({ status: HttpStatus.GONE, description: 'expired' })
  @ResponseMessage('Device paired successfully')
  public async confirm(@Body() dto: ConfirmPairingDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.pairingService.confirm(dto.userCode, user.sub);
  }

  @Post('token')
  @HttpCode(HttpStatus.CREATED) // a new DeviceSession is created on success
  @ApiOperation({ summary: 'Polled by the desktop app until the code is confirmed' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PairingTokenResponseDto })
  @ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED, description: 'authorization_pending' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'slow_down' })
  @ApiResponse({ status: HttpStatus.GONE, description: 'expired' })
  @ResponseMessage('Device token issued successfully')
  public poll(@Body() dto: PollTokenDto): Promise<PairingTokenResponseDto> {
    return this.pairingService.poll(dto.deviceCode);
  }
}
