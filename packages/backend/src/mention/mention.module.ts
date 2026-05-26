import { Module } from '@nestjs/common';
import { MentionParser } from './mention-parser.service';

// MentionParser is wired here but has no caller in Fase 3.
// Fase 4 (Comments) will inject it to emit mention.created events.
@Module({
  providers: [MentionParser],
  exports: [MentionParser],
})
export class MentionModule {}
