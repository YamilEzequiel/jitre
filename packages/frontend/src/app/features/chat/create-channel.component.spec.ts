import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentRef } from '@angular/core';
import { CreateChannelComponent } from './create-channel.component';
import { ChatApiService, ChatChannel } from '../../stores/chat-api.service';

describe('CreateChannelComponent', () => {
  let fixture: ComponentFixture<CreateChannelComponent>;
  let component: CreateChannelComponent;
  let componentRef: ComponentRef<CreateChannelComponent>;
  const api = {
    createChannel: vi.fn(),
    listChannels: vi.fn(),
    getChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    openOrCreateDM: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    listMessages: vi.fn(),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    markAsRead: vi.fn(),
    search: vi.fn(),
    getUnreadCount: vi.fn(),
  };

  beforeEach(() => {
    api.createChannel.mockReset();
    TestBed.configureTestingModule({
      imports: [CreateChannelComponent],
      providers: [{ provide: ChatApiService, useValue: api }],
    });
    fixture = TestBed.createComponent(CreateChannelComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('does not submit when name is empty', async () => {
    component.name.set('   ');
    await component.submit();
    expect(api.createChannel).not.toHaveBeenCalled();
  });

  it('submits with trimmed name + description and emits created', async () => {
    const channel: ChatChannel = {
      id: 'c-new',
      workspaceId: 'ws1',
      name: 'design',
      description: 'desc',
      type: 'private',
      kind: 'custom',
      projectId: null,
      lastMessageAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    api.createChannel.mockResolvedValueOnce(channel);
    const created: ChatChannel[] = [];
    component.created.subscribe(c => created.push(c));
    component.name.set('  design  ');
    component.description.set(' desc ');
    component.type.set('private');
    await component.submit();
    expect(api.createChannel).toHaveBeenCalledWith({
      name: 'design',
      description: 'desc',
      type: 'private',
    });
    expect(created.length).toBe(1);
    expect(created[0].id).toBe('c-new');
    // resets after success
    expect(component.name()).toBe('');
  });

  it('cancel emits closed and resets state', () => {
    const closed: number[] = [];
    component.closed.subscribe(() => closed.push(1));
    component.name.set('foo');
    component.cancel();
    expect(closed.length).toBe(1);
    expect(component.name()).toBe('');
  });

  it('exposes an error message when api rejects', async () => {
    api.createChannel.mockRejectedValueOnce(new Error('boom'));
    component.name.set('ok');
    await component.submit();
    expect(component.error()).toBe('boom');
  });
});
