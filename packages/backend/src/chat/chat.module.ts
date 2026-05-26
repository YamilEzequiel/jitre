import { Logger, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatChannelEntity } from './chat-channel.entity';
import { ChatMembershipEntity } from './chat-membership.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatListener } from './chat.listener';
import { UserModule } from '../user/user.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ProjectEntity } from '../project/project.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatChannelEntity,
      ChatMembershipEntity,
      ChatMessageEntity,
      ProjectEntity,
      ProjectMembershipEntity,
    ]),
    UserModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatListener, Logger],
  exports: [ChatService],
})
export class ChatModule {}
