import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { EmployeeController } from './employee.controller';
import { AttachmentModule } from '../attachment/attachment.module';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, WorkspaceMembershipEntity]),
    AttachmentModule,
  ],
  controllers: [UserController, EmployeeController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
