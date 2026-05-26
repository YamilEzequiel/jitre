import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomFieldEntity } from './custom-field.entity';
import { CustomFieldService } from './custom-field.service';
import { CustomFieldValidator } from './custom-field.validator';
import { CustomFieldController } from './custom-field.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([CustomFieldEntity]), EventsModule],
  providers: [CustomFieldValidator, CustomFieldService],
  controllers: [CustomFieldController],
  exports: [CustomFieldService],
})
export class CustomFieldModule {}
