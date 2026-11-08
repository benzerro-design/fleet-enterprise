import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tireCustodyOtpRateLimiter } from './tire-custody-otp-rate-limit';
import { TireCustodyProtocolService } from './tire-custody-protocol.service';

/** Unauthenticated driver OTP/link signing surface. */
@Controller('public/tire-custody')
export class TireCustodyPublicController {
  constructor(private readonly custody: TireCustodyProtocolService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.custody.previewByDriverToken(token);
  }

  @Post(':token/sign')
  sign(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    const ip =
      (forwardedFor?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown').slice(0, 64);
    const key = `${ip}:${token.slice(0, 24)}`;
    const limited = tireCustodyOtpRateLimiter.check(key);
    if (!limited.ok) {
      res.setHeader('Retry-After', String(limited.retryAfterSec));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: limited.message,
          retryAfterSec: limited.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.custody.signAsDriverByToken(token, {
      otp: String(body.otp ?? ''),
      displayName: String(body.displayName ?? ''),
      signaturePngUrl: String(body.signaturePngUrl ?? ''),
      strokePathJson: (body.strokePathJson as object | null | undefined) ?? undefined,
      deviceMetaJson: (body.deviceMetaJson as object | null | undefined) ?? undefined,
    });
  }
}
