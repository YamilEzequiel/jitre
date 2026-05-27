import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type ChatChannelType = 'public' | 'private' | 'dm';
export type ChatChannelKind = 'general' | 'project' | 'custom' | 'dm';

export interface ChatChannel {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: ChatChannelType;
  kind: ChatChannelKind;
  projectId: string | null;
  createdByUserId?: string;
  createdBy?: string;
  lastMessageAt: string | null;
  createdAt: string;
  /**
   * Optional emoji shown next to the channel name in the sidebar and header.
   * `null` (or missing) means "fall back to the lock/hash/user iconography".
   */
  icon?: string | null;
}

export interface ChatAttachment {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  parentMessageId: string | null;
  attachments: ChatAttachment[];
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessagePage {
  data: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ChatChannelMember {
  id: string;
  channelId: string;
  userId: string;
  role?: string;
  joinedAt?: string;
}

export interface WorkspaceContact {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

export interface CreateChannelBody {
  name: string;
  description?: string;
  type: 'public' | 'private';
  memberUserIds?: string[];
}

export interface SendMessageBody {
  channelId: string;
  body: string;
  parentMessageId?: string;
  attachments?: ChatAttachment[];
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);

  listChannels(): Promise<ChatChannel[]> {
    return firstValueFrom(this.http.get<ChatChannel[]>('/api/v1/chat/channels'));
  }

  getChannel(id: string): Promise<ChatChannel> {
    return firstValueFrom(this.http.get<ChatChannel>(`/api/v1/chat/channels/${id}`));
  }

  getProjectChannel(projectId: string): Promise<ChatChannel> {
    return firstValueFrom(
      this.http.get<ChatChannel>(`/api/v1/chat/projects/${projectId}/channel`),
    );
  }

  createChannel(body: CreateChannelBody): Promise<ChatChannel> {
    return firstValueFrom(this.http.post<ChatChannel>('/api/v1/chat/channels', body));
  }

  updateChannel(
    id: string,
    body: { name?: string; description?: string; icon?: string | null },
  ): Promise<ChatChannel> {
    return firstValueFrom(this.http.patch<ChatChannel>(`/api/v1/chat/channels/${id}`, body));
  }

  /** Lists membership records (channelId, userId, joinedAt...) for a channel. */
  listMembers(channelId: string): Promise<ChatChannelMember[]> {
    return firstValueFrom(
      this.http.get<ChatChannelMember[]>(`/api/v1/chat/channels/${channelId}/members`),
    );
  }

  deleteChannel(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/chat/channels/${id}`));
  }

  openOrCreateDM(otherUserId: string): Promise<ChatChannel> {
    return firstValueFrom(this.http.post<ChatChannel>('/api/v1/chat/dm', { otherUserId }));
  }

  listWorkspaceContacts(workspaceId: string): Promise<WorkspaceContact[]> {
    return firstValueFrom(
      this.http.get<WorkspaceContact[]>(`/api/v1/workspaces/${workspaceId}/members`),
    );
  }

  addMember(channelId: string, userId: string): Promise<ChatChannelMember> {
    return firstValueFrom(
      this.http.post<ChatChannelMember>(`/api/v1/chat/channels/${channelId}/members`, { userId }),
    );
  }

  removeMember(channelId: string, userId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/v1/chat/channels/${channelId}/members/${userId}`),
    );
  }

  listMessages(channelId: string, opts?: { before?: string; limit?: number }): Promise<ChatMessagePage> {
    let params = new HttpParams();
    if (opts?.before) params = params.set('before', opts.before);
    if (opts?.limit) params = params.set('limit', String(opts.limit));
    return firstValueFrom(
      this.http.get<ChatMessagePage>(`/api/v1/chat/channels/${channelId}/messages`, { params }),
    );
  }

  sendMessage(body: SendMessageBody): Promise<ChatMessage> {
    return firstValueFrom(this.http.post<ChatMessage>('/api/v1/chat/messages', body));
  }

  editMessage(id: string, body: string): Promise<ChatMessage> {
    return firstValueFrom(this.http.patch<ChatMessage>(`/api/v1/chat/messages/${id}`, { body }));
  }

  deleteMessage(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/chat/messages/${id}`));
  }

  markAsRead(channelId: string, messageId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`/api/v1/chat/channels/${channelId}/read`, { messageId }),
    );
  }

  search(q: string): Promise<ChatMessage[]> {
    const params = new HttpParams().set('q', q);
    return firstValueFrom(this.http.get<ChatMessage[]>('/api/v1/chat/search', { params }));
  }

  getUnreadCount(channelId: string): Promise<number> {
    return firstValueFrom(
      this.http.get<number>(`/api/v1/chat/channels/${channelId}/unread-count`),
    );
  }
}
