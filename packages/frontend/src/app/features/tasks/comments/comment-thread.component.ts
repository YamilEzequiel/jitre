import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { MarkdownPipe } from '../../../shared/markdown/markdown.pipe';

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  replyToId?: string;
}

@Component({
  selector: 'jt-comment-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownPipe, SlicePipe],
  template: `
    <div class="space-y-3">
      @for (comment of comments(); track comment.id) {
        <div
          class="rounded-xl border border-slate-200 bg-white backdrop-blur-sm p-4
                 hover:border-slate-300 transition-colors"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-700">
              {{ comment.authorName }}
            </span>
            <span class="text-[11px] text-slate-400">{{ comment.createdAt | slice:0:10 }}</span>
          </div>
          <div
            class="prose prose-sm max-w-none text-sm text-slate-700"
            [innerHTML]="comment.body | markdown"
          ></div>
          <div class="flex gap-4 mt-3">
            <button
              type="button"
              (click)="onReply(comment.id)"
              class="text-xs font-semibold text-violet-700 hover:text-violet-800 transition-colors"
            >
              Reply
            </button>
            <button
              type="button"
              (click)="onDelete(comment.id)"
              class="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      } @empty {
        <p class="text-sm text-slate-500">No comments yet.</p>
      }
    </div>
  `,
})
export class CommentThreadComponent {
  readonly comments = input<Comment[]>([]);
  readonly reply = output<string>();
  readonly deleted = output<string>();

  onReply(commentId: string): void {
    this.reply.emit(commentId);
  }

  onDelete(commentId: string): void {
    this.deleted.emit(commentId);
  }
}
