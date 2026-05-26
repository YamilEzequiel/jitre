import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { SkipTenancy } from '../auth/decorators/skip-tenancy.decorator';
import { STORAGE_DRIVER } from '../storage/storage.constants';
import { IStorageDriver } from '../storage/drivers/storage-driver.interface';
import { verifySignature } from '../storage/signed-url.util';

@ApiTags('files')
@Controller('files')
export class FilesController {
  private readonly signingSecret: string;

  constructor(
    @Inject(STORAGE_DRIVER)
    private readonly driver: IStorageDriver,
    private readonly configService: ConfigService,
  ) {
    this.signingSecret = configService.get<string>(
      'storage.localSigningSecret',
      '',
    );
  }

  @ApiOperation({
    summary:
      'Serve a locally-stored file. Public — validates HMAC signature instead of JWT.',
  })
  @ApiResponse({ status: 200, description: 'File streamed.' })
  @ApiResponse({ status: 403, description: 'Invalid or expired signature.' })
  @Get('*storageKey')
  @Public()
  @SkipTenancy()
  async serveFile(
    @Param('storageKey') storageKey: string,
    @Query('token') token: string,
    @Query('exp') exp: string,
    @Res() res: Response,
  ): Promise<void> {
    const expiresAt = parseInt(exp, 10);

    if (
      !token ||
      !exp ||
      isNaN(expiresAt) ||
      !verifySignature(storageKey, token, expiresAt, this.signingSecret)
    ) {
      throw new ForbiddenException('INVALID_OR_EXPIRED_SIGNATURE');
    }

    const file = await this.driver.get(storageKey);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.sizeBytes);
    res.setHeader('Cache-Control', 'private, max-age=300');

    file.stream.pipe(res);
  }
}
