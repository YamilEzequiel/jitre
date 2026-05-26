import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Attachment } from './attachment.entity';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';
import { FilesController } from './files.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    MulterModule.register({ storage: undefined }),
  ],
  providers: [AttachmentService],
  controllers: [AttachmentController, FilesController],
  exports: [AttachmentService],
})
export class AttachmentModule {}
