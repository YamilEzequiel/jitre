import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentRef, signal } from '@angular/core';
import { EditChannelPanelComponent } from './edit-channel-panel.component';
import {
  ChatApiService,
  ChatChannel,
  ChatChannelMember,
} from '../../stores/chat-api.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

const channel: ChatChannel = {
  id: 'c1',
  workspaceId: 'ws1',
  name: 'design',
  description: 'Design talk',
  type: 'private',
  kind: 'custom',
  projectId: null,
  createdByUserId: 'u1',
  lastMessageAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  icon: '🎨',
};

const initialMembers: ChatChannelMember[] = [
  { id: 'm-u1', channelId: 'c1', userId: 'u1' },
  { id: 'm-u2', channelId: 'c1', userId: 'u2' },
];

describe('EditChannelPanelComponent', () => {
  let fixture: ComponentFixture<EditChannelPanelComponent>;
  let component: EditChannelPanelComponent;
  let componentRef: ComponentRef<EditChannelPanelComponent>;

  const api = {
    getChannel: vi.fn(),
    updateChannel: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    listMembers: vi.fn(),
  };

  const memberStore = {
    members: signal([
      { userId: 'u1', displayName: 'User One', email: 'u1@x', avatarUrl: null, role: 'admin' },
      { userId: 'u2', displayName: 'User Two', email: 'u2@x', avatarUrl: null, role: 'member' },
      { userId: 'u3', displayName: 'Maya R.', email: 'maya@x', avatarUrl: null, role: 'member' },
    ]).asReadonly(),
    loading: signal(false).asReadonly(),
    refresh: vi.fn().mockResolvedValue(undefined),
    displayNameFor: vi.fn((id: string) => {
      const map: Record<string, string> = { u1: 'User One', u2: 'User Two', u3: 'Maya R.' };
      return map[id] ?? id;
    }),
    initialsFor: vi.fn(() => 'UU'),
    avatarColorFor: vi.fn(() => 'hsl(0,0%,0%)'),
    avatarForegroundFor: vi.fn(() => 'hsl(0,0%,100%)'),
    memberFor: vi.fn((id: string) => {
      const map: Record<string, { email: string }> = {
        u1: { email: 'u1@x' },
        u2: { email: 'u2@x' },
        u3: { email: 'maya@x' },
      };
      return map[id] ?? null;
    }),
  };

  const channelStore = {
    byId: signal<Record<string, ChatChannel>>({ c1: channel }).asReadonly(),
    upsert: vi.fn(),
  };

  const auth = {
    currentUser: signal({ id: 'u1', email: 'u1@x', displayName: 'User One', role: 'admin' as const }).asReadonly(),
    currentWorkspace: signal({ id: 'ws1', name: 'WS', slug: 'ws', role: 'admin' as const }).asReadonly(),
  };

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    api.getChannel.mockReset().mockResolvedValue(channel);
    api.listMembers.mockReset().mockResolvedValue(initialMembers);
    api.updateChannel.mockReset().mockResolvedValue(channel);
    api.addMember.mockReset().mockResolvedValue({ id: 'm-new', channelId: 'c1', userId: 'u3' });
    api.removeMember.mockReset().mockResolvedValue(undefined);
    channelStore.upsert.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();

    TestBed.configureTestingModule({
      imports: [EditChannelPanelComponent],
      providers: [
        { provide: ChatApiService, useValue: api },
        { provide: WorkspaceMemberStore, useValue: memberStore },
        { provide: ChatChannelStore, useValue: channelStore },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(EditChannelPanelComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('channelId', 'c1');
    componentRef.setInput('open', true);
    fixture.detectChanges();
    // Wait one microtask for the effect-triggered load to settle.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('loads the channel and its members when opened', async () => {
    expect(api.getChannel).toHaveBeenCalledWith('c1');
    expect(api.listMembers).toHaveBeenCalledWith('c1');
    expect(component.members().map(m => m.userId).sort()).toEqual(['u1', 'u2']);
    expect(component.iconValue()).toBe('🎨');
    expect(component.form.controls.name.value).toBe('design');
  });

  it('save() does nothing when nothing is dirty', async () => {
    await component.save();
    expect(api.updateChannel).not.toHaveBeenCalled();
    expect(api.addMember).not.toHaveBeenCalled();
    expect(api.removeMember).not.toHaveBeenCalled();
  });

  it('save() PATCHes only the changed fields and emits updated', async () => {
    component.form.controls.name.setValue('design-team');
    component.iconValue.set('🚀');
    // Description unchanged on purpose
    const updates: ChatChannel[] = [];
    component.updated.subscribe(c => updates.push(c));

    await component.save();

    expect(api.updateChannel).toHaveBeenCalledTimes(1);
    expect(api.updateChannel).toHaveBeenCalledWith('c1', {
      name: 'design-team',
      icon: '🚀',
    });
    expect(channelStore.upsert).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Channel updated');
    expect(updates.length).toBe(1);
  });

  it('save() clears the icon by sending an empty string when value goes from set to null', async () => {
    component.clearIcon();
    await component.save();
    expect(api.updateChannel).toHaveBeenCalledWith('c1', { icon: '' });
  });

  it('save() calls addMember/removeMember for membership diff', async () => {
    component.onMarkAdd({
      userId: 'u3',
      displayName: 'Maya R.',
      email: 'maya@x',
      avatarUrl: null,
      role: 'member',
    });
    component.onMarkRemove('u2');

    await component.save();

    // No body fields changed → updateChannel should NOT be called.
    expect(api.updateChannel).not.toHaveBeenCalled();
    expect(api.addMember).toHaveBeenCalledWith('c1', 'u3');
    expect(api.removeMember).toHaveBeenCalledWith('c1', 'u2');
  });

  it('marking the same user as add+remove cancels out (toggle behavior)', () => {
    component.onMarkRemove('u2');
    expect(component.pendingRemoves()).toEqual(['u2']);
    component.onMarkAdd({
      userId: 'u2',
      displayName: 'User Two',
      email: 'u2@x',
      avatarUrl: null,
      role: 'member',
    });
    expect(component.pendingRemoves()).toEqual([]);
    expect(component.pendingAdds()).toEqual([]);
  });

  it('shows an error and toast when the API rejects', async () => {
    api.updateChannel.mockRejectedValueOnce(new Error('boom'));
    component.form.controls.name.setValue('renamed');
    await component.save();
    expect(component.error()).toBe('boom');
    expect(toast.error).toHaveBeenCalledWith('boom');
  });
});
