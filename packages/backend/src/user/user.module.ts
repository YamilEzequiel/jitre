import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AttachmentModule } from '../attachment/attachment.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AttachmentModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
