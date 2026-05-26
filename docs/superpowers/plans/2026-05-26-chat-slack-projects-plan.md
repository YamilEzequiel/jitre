# Chat Slack-lite integrado con proyectos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar el chat de Jitre al flujo real de workspace/proyecto con `#general`, un chat automático por proyecto, membresía sincronizada, acceso rápido desde Proyecto y threads reales con UX Slack-lite.

**Architecture:** El backend pasa a modelar explícitamente canales globales y de proyecto mediante metadata estructural y reglas automáticas disparadas desde creación/membresía de proyectos. El frontend consume esa metadata para ordenar Channels vs DMs, abrir chats de proyecto desde el detalle y renderizar threads en panel lateral con realtime consistente.

**Tech Stack:** NestJS + TypeORM + EventBus + Socket.IO, Angular signals + stores, Vitest/Jest.

---

## File structure map

### Backend
- Modify: `packages/backend/src/chat/chat-channel.entity.ts` — metadata estructural del canal (`kind`, `projectId`).
- Modify: `packages/backend/src/chat/chat.service.ts` — reglas de canal general/proyecto, resolución por proyecto, threads y membresía derivada.
- Modify: `packages/backend/src/chat/chat.controller.ts` — endpoint para resolver/abrir chat de proyecto y contratos enriquecidos.
- Modify: `packages/backend/src/chat/chat.service.spec.ts` — pruebas unitarias de reglas automáticas y project channels.
- Modify: `packages/backend/src/chat/chat.controller.spec.ts` — pruebas de contrato HTTP para project chat.
- Modify: `packages/backend/src/chat/chat.gateway.ts` and `packages/backend/src/chat/chat.listener.ts` — payloads realtime para thread replies/presence/read model.
- Modify: `packages/backend/src/chat/chat.gateway.spec.ts` and `packages/backend/src/chat/chat.listener.spec.ts` — pruebas de fanout realtime.
- Modify: `packages/backend/src/project/project.service.ts` — hook backend-driven para crear chat al crear proyecto.
- Modify: `packages/backend/src/project/project-membership/project-membership.service.ts` — sync add/remove con chat de proyecto.
- Modify: `packages/backend/src/project/project.service.spec.ts` and `packages/backend/src/project/project-membership/project-membership.service.spec.ts` — pruebas de integración lógica.
- Modify: `packages/backend/src/chat/chat.module.ts` and `packages/backend/src/project/project.module.ts` — wiring circular controlado entre módulos/servicios.
- Create: `packages/backend/src/database/migrations/<timestamp>-AddChatChannelMetadata.ts` — columnas `kind` y `projectId`, índices/constraint por proyecto.

### Frontend
- Modify: `packages/frontend/src/app/stores/chat-api.service.ts` — tipos enriquecidos, endpoint de chat por proyecto, thread responses.
- Modify: `packages/frontend/src/app/features/chat/chat.component.ts` — sidebar Slack-like, ordering `#general` + project channels + DMs.
- Modify: `packages/frontend/src/app/features/chat/chat.component.spec.ts` — cobertura de jerarquía y navegación.
- Modify: `packages/frontend/src/app/features/chat/chat-channel-view.component.ts` — header contextual, acciones de thread y panel lateral.
- Modify: `packages/frontend/src/app/features/chat/message-input.component.ts` — composer reusable para canal/thread.
- Modify: `packages/frontend/src/app/features/chat/message-input.component.spec.ts` — composer en canal/thread.
- Create or Modify: `packages/frontend/src/app/stores/chat-thread.store.ts` (si conviene) — estado aislado del panel de thread.
- Modify: `packages/frontend/src/app/core/chat-realtime/chat-realtime.service.ts` — eventos de thread, read/unread y reconnect UX.
- Modify: `packages/frontend/src/app/features/projects/detail/project-detail.component.ts` — CTA “Abrir chat del proyecto”.
- Modify: `packages/frontend/src/app/features/projects/detail/project-detail.component.spec.ts` — navegación al chat del proyecto.
- Modify: `packages/frontend/src/styles.css` — utilidades visuales mínimas si hicieran falta.

## Task 1: Modelar metadata de canal y reglas automáticas backend

**Files:**
- Create: `packages/backend/src/database/migrations/<timestamp>-AddChatChannelMetadata.ts`
- Modify: `packages/backend/src/chat/chat-channel.entity.ts`
- Modify: `packages/backend/src/chat/chat.service.ts`
- Test: `packages/backend/src/chat/chat.service.spec.ts`

- [ ] **Step 1: Write the failing tests for general/project channel metadata**

```ts
it('creates a workspace general channel once and reuses it', async () => {
  const first = await service.ensureGeneralChannel('ws-1', 'u-1');
  const second = await service.ensureGeneralChannel('ws-1', 'u-1');

  expect(first.kind).toBe('general');
  expect(second.id).toBe(first.id);
});

it('creates a project channel linked to the project and seeds memberships', async () => {
  const channel = await service.ensureProjectChannel({
    workspaceId: 'ws-1',
    projectId: 'p-1',
    projectName: 'Platform',
    actorUserId: 'u-1',
    memberUserIds: ['u-1', 'u-2'],
  });

  expect(channel.kind).toBe('project');
  expect(channel.projectId).toBe('p-1');
  expect(await service.listMembers(channel.id, 'ws-1')).toHaveLength(2);
});
```

- [ ] **Step 2: Run backend chat tests to verify RED**

Run: `npm run test -w @jitre/backend -- src/chat/chat.service.spec.ts`
Expected: FAIL with missing `kind` / `projectId` / `ensureGeneralChannel` / `ensureProjectChannel` APIs.

- [ ] **Step 3: Add channel metadata to entity and migration**

```ts
export type ChatChannelKind = 'general' | 'project' | 'custom' | 'dm';

@Column({ type: 'varchar', default: 'custom' })
kind!: ChatChannelKind;

@Column({ type: 'uuid', nullable: true })
projectId!: string | null;
```

```ts
await queryRunner.addColumn('chat_channels', new TableColumn({
  name: 'kind',
  type: 'varchar',
  isNullable: false,
  default: `'custom'`,
}));
await queryRunner.addColumn('chat_channels', new TableColumn({
  name: 'project_id',
  type: 'uuid',
  isNullable: true,
}));
```

- [ ] **Step 4: Implement `ensureGeneralChannel`, `ensureProjectChannel`, and `getProjectChannel` minimally**

```ts
async ensureGeneralChannel(workspaceId: string, actorUserId: string): Promise<ChatChannelEntity> {
  const existing = await this.channelRepo.findOne({ where: { workspaceId, kind: 'general' } });
  if (existing) return existing;
  return this.createStructuredChannel({ workspaceId, actorUserId, name: 'general', type: 'public', kind: 'general' });
}

async ensureProjectChannel(input: EnsureProjectChannelInput): Promise<ChatChannelEntity> {
  const existing = await this.channelRepo.findOne({ where: { workspaceId: input.workspaceId, projectId: input.projectId, kind: 'project' } });
  if (existing) return existing;
  const channel = await this.createStructuredChannel({ ...input, name: slugifyProjectChannel(input.projectName), type: 'private', kind: 'project', projectId: input.projectId });
  await this.syncProjectChannelMembers(channel.id, input.memberUserIds);
  return channel;
}
```

- [ ] **Step 5: Run backend chat tests to verify GREEN**

Run: `npm run test -w @jitre/backend -- src/chat/chat.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/chat/chat-channel.entity.ts packages/backend/src/chat/chat.service.ts packages/backend/src/chat/chat.service.spec.ts packages/backend/src/database/migrations/<timestamp>-AddChatChannelMetadata.ts
git commit -m "feat(chat): model general and project channels"
```

## Task 2: Sincronizar creación de proyecto y membresía con chat

**Files:**
- Modify: `packages/backend/src/project/project.service.ts`
- Modify: `packages/backend/src/project/project-membership/project-membership.service.ts`
- Modify: `packages/backend/src/project/project.service.spec.ts`
- Modify: `packages/backend/src/project/project-membership/project-membership.service.spec.ts`
- Modify: `packages/backend/src/chat/chat.module.ts`
- Modify: `packages/backend/src/project/project.module.ts`

- [ ] **Step 1: Write the failing tests for project-chat sync**

```ts
it('creates the project chat after project creation', async () => {
  const project = await service.create({ workspaceId: 'ws-1', name: 'Platform', key: 'PLAT', ownerUserId: 'u-1' });
  const channel = await chatService.getProjectChannel(project.id, 'ws-1');

  expect(channel.projectId).toBe(project.id);
});

it('adds and removes members from the project channel when project membership changes', async () => {
  await membershipService.addMember('p-1', 'ws-1', 'u-2', ProjectRole.MEMBER, 'u-1');
  expect(await chatService.isMember('chat-p-1', 'u-2')).toBe(true);

  await membershipService.removeMember('p-1', 'ws-1', 'u-2', 'u-1');
  expect(await chatService.isMember('chat-p-1', 'u-2')).toBe(false);
});
```

- [ ] **Step 2: Run project tests to verify RED**

Run: `npm run test -w @jitre/backend -- src/project/project.service.spec.ts src/project/project-membership/project-membership.service.spec.ts`
Expected: FAIL because project services do not coordinate with chat yet.

- [ ] **Step 3: Inject chat service and call project-channel sync from backend only**

```ts
const projectMembers = await this.membershipService.listMembers(savedProject!.id, dto.workspaceId);
await this.chatService.ensureProjectChannel({
  workspaceId: dto.workspaceId,
  projectId: savedProject!.id,
  projectName: savedProject!.name,
  actorUserId: dto.ownerUserId,
  memberUserIds: projectMembers.map(member => member.userId),
});
```

```ts
const channel = await this.chatService.getProjectChannel(projectId, workspaceId);
await this.chatService.addMember(channel.id, workspaceId, userId);
```

- [ ] **Step 4: Keep last-admin project rules intact while syncing removals**

```ts
await this.memberRepo.delete({ projectId, workspaceId, userId });
const channel = await this.chatService.getProjectChannel(projectId, workspaceId);
await this.chatService.removeMember(channel.id, workspaceId, userId);
```

- [ ] **Step 5: Run project tests to verify GREEN**

Run: `npm run test -w @jitre/backend -- src/project/project.service.spec.ts src/project/project-membership/project-membership.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/project/project.service.ts packages/backend/src/project/project-membership/project-membership.service.ts packages/backend/src/project/project.service.spec.ts packages/backend/src/project/project-membership/project-membership.service.spec.ts packages/backend/src/chat/chat.module.ts packages/backend/src/project/project.module.ts
git commit -m "feat(chat): sync project membership with channels"
```

## Task 3: Exponer contracts de project chat y reforzar threads/realtime

**Files:**
- Modify: `packages/backend/src/chat/chat.controller.ts`
- Modify: `packages/backend/src/chat/chat.service.ts`
- Modify: `packages/backend/src/chat/chat.controller.spec.ts`
- Modify: `packages/backend/src/chat/chat.listener.ts`
- Modify: `packages/backend/src/chat/chat.gateway.ts`
- Modify: `packages/backend/src/chat/chat.listener.spec.ts`
- Modify: `packages/backend/src/chat/chat.gateway.spec.ts`

- [ ] **Step 1: Write the failing tests for `GET /chat/projects/:projectId/channel` and thread payloads**

```ts
it('returns the linked project channel', async () => {
  const res = await request(app.getHttpServer())
    .get('/chat/projects/p-1/channel')
    .set('x-workspace-id', 'ws-1')
    .set('authorization', 'Bearer token');

  expect(res.status).toBe(200);
  expect(res.body.projectId).toBe('p-1');
  expect(res.body.kind).toBe('project');
});

it('emits created messages with parentMessageId preserved for thread replies', () => {
  listener.handle(new ChatMessageCreatedEvent({ payload: { messageId: 'm-2', channelId: 'c-1', parentMessageId: 'm-1' } as any }));
  expect(gateway.emitToChannel).toHaveBeenCalledWith('c-1', 'chat:message:created', expect.objectContaining({ parentMessageId: 'm-1' }));
});
```

- [ ] **Step 2: Run chat controller/gateway tests to verify RED**

Run: `npm run test -w @jitre/backend -- src/chat/chat.controller.spec.ts src/chat/chat.listener.spec.ts src/chat/chat.gateway.spec.ts`
Expected: FAIL because project channel endpoint and richer payload contract are missing.

- [ ] **Step 3: Add project-channel resolver endpoint and minimal service method**

```ts
@Get('projects/:projectId/channel')
async getProjectChannel(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthRequest) {
  return this.chatService.getProjectChannel(projectId, req.workspace!.id);
}
```

- [ ] **Step 4: Keep realtime payloads explicit for reply/thread messages**

```ts
this.gateway.emitToChannel(channelId, 'chat:message:created', {
  id: payload.messageId,
  channelId,
  authorId: payload.authorId,
  body: payload.body,
  parentMessageId: payload.parentMessageId ?? null,
  attachments: payload.attachments,
  createdAt: payload.createdAt,
});
```

- [ ] **Step 5: Run chat controller/gateway tests to verify GREEN**

Run: `npm run test -w @jitre/backend -- src/chat/chat.controller.spec.ts src/chat/chat.listener.spec.ts src/chat/chat.gateway.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/chat/chat.controller.ts packages/backend/src/chat/chat.service.ts packages/backend/src/chat/chat.controller.spec.ts packages/backend/src/chat/chat.listener.ts packages/backend/src/chat/chat.gateway.ts packages/backend/src/chat/chat.listener.spec.ts packages/backend/src/chat/chat.gateway.spec.ts
git commit -m "feat(chat): expose project chat and thread contracts"
```

## Task 4: Reordenar shell frontend a Slack-lite y acceso rápido desde Proyecto

**Files:**
- Modify: `packages/frontend/src/app/stores/chat-api.service.ts`
- Modify: `packages/frontend/src/app/features/chat/chat.component.ts`
- Modify: `packages/frontend/src/app/features/chat/chat.component.spec.ts`
- Modify: `packages/frontend/src/app/features/projects/detail/project-detail.component.ts`
- Modify: `packages/frontend/src/app/features/projects/detail/project-detail.component.spec.ts`

- [ ] **Step 1: Write the failing frontend tests for hierarchy and project CTA**

```ts
it('keeps #general first, project channels next, and dms in the secondary section', () => {
  expect(component.channels().map(c => [c.kind, c.projectId])).toEqual([
    ['general', null],
    ['project', 'p-1'],
  ]);
  expect(component.dms().every(dm => dm.type === 'dm')).toBe(true);
});

it('navigates to the linked project chat from project detail', async () => {
  chatApi.getProjectChannel.mockResolvedValueOnce({ id: 'chat-p-1' } as any);
  await component.openProjectChat();
  expect(router.navigate).toHaveBeenCalledWith(['/chat', 'chat-p-1']);
});
```

- [ ] **Step 2: Run frontend chat/project tests to verify RED**

Run: `npm run test -w @jitre/frontend -- --runInBand src/app/features/chat/chat.component.spec.ts src/app/features/projects/detail/project-detail.component.spec.ts`
Expected: FAIL because channel metadata and project chat CTA do not exist yet.

- [ ] **Step 3: Enrich chat types and sort channels by semantic kind**

```ts
export type ChatChannelKind = 'general' | 'project' | 'custom' | 'dm';

export interface ChatChannel {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: ChatChannelType;
  kind: ChatChannelKind;
  projectId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}
```

```ts
readonly channels = computed(() =>
  this.store.channels()
    .filter(ch => ch.type !== 'dm')
    .sort(compareSlackOrder),
);
```

- [ ] **Step 4: Add project chat CTA in project detail**

```ts
async openProjectChat(): Promise<void> {
  const channel = await this.chatApi.getProjectChannel(this.projectId);
  await this.router.navigate(['/chat', channel.id]);
}
```

- [ ] **Step 5: Run frontend chat/project tests to verify GREEN**

Run: `npm run test -w @jitre/frontend -- --runInBand src/app/features/chat/chat.component.spec.ts src/app/features/projects/detail/project-detail.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/app/stores/chat-api.service.ts packages/frontend/src/app/features/chat/chat.component.ts packages/frontend/src/app/features/chat/chat.component.spec.ts packages/frontend/src/app/features/projects/detail/project-detail.component.ts packages/frontend/src/app/features/projects/detail/project-detail.component.spec.ts
git commit -m "feat(chat): ship slack style channel hierarchy"
```

## Task 5: Implementar thread panel real y composer reutilizable

**Files:**
- Modify: `packages/frontend/src/app/features/chat/chat-channel-view.component.ts`
- Modify: `packages/frontend/src/app/features/chat/message-input.component.ts`
- Modify: `packages/frontend/src/app/features/chat/message-input.component.spec.ts`
- Create/Modify: `packages/frontend/src/app/stores/chat-thread.store.ts`
- Modify: `packages/frontend/src/app/core/chat-realtime/chat-realtime.service.ts`

- [ ] **Step 1: Write the failing tests for thread panel behavior**

```ts
it('opens a side panel thread when reply is selected', () => {
  component.openThread(rootMessage);
  expect(component.activeThreadRoot()?.id).toBe(rootMessage.id);
  expect(component.threadMessages().map(m => m.parentMessageId)).toEqual([rootMessage.id]);
});

it('sends thread replies with parentMessageId', async () => {
  await component.onSendThreadReply('Looks good');
  expect(chatApi.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    channelId: 'c-1',
    parentMessageId: 'm-root',
    body: 'Looks good',
  }));
});
```

- [ ] **Step 2: Run frontend thread tests to verify RED**

Run: `npm run test -w @jitre/frontend -- --runInBand src/app/features/chat/message-input.component.spec.ts src/app/features/chat/chat.component.spec.ts`
Expected: FAIL because no thread state/panel exists.

- [ ] **Step 3: Add explicit thread state and reply action in channel view**

```ts
readonly activeThreadRoot = signal<ChatMessage | null>(null);
readonly threadMessages = computed(() =>
  this.messages().filter(message => message.parentMessageId === this.activeThreadRoot()?.id),
);
```

```html
<button type="button" (click)="openThread(rm.message)" class="rounded p-1 text-xs text-slate-500 hover:text-violet-700">
  <i class="pi pi-comment"></i>
</button>
```

- [ ] **Step 4: Reuse composer for thread replies and keep realtime updates merged**

```ts
async onSendThreadReply(body: string): Promise<void> {
  const root = this.activeThreadRoot();
  if (!root) return;
  const saved = await this.chatApi.sendMessage({ channelId: root.channelId, body, parentMessageId: root.id });
  this.messageStore.upsert(saved);
}
```

- [ ] **Step 5: Run frontend thread tests to verify GREEN**

Run: `npm run test -w @jitre/frontend -- --runInBand src/app/features/chat/message-input.component.spec.ts src/app/features/chat/chat.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/app/features/chat/chat-channel-view.component.ts packages/frontend/src/app/features/chat/message-input.component.ts packages/frontend/src/app/features/chat/message-input.component.spec.ts packages/frontend/src/app/stores/chat-thread.store.ts packages/frontend/src/app/core/chat-realtime/chat-realtime.service.ts
git commit -m "feat(chat): add realtime thread panel"
```

## Task 6: Verificación final y pulido integrado

**Files:**
- Modify only as needed: files touched in Tasks 1-5
- Test: `packages/backend/src/chat/*.spec.ts`, `packages/backend/src/project/*.spec.ts`, `packages/frontend/src/app/features/chat/*.spec.ts`, `packages/frontend/src/app/features/projects/detail/project-detail.component.spec.ts`

- [ ] **Step 1: Run focused backend suite**

Run: `npm run test -w @jitre/backend -- src/chat/chat.service.spec.ts src/chat/chat.controller.spec.ts src/chat/chat.gateway.spec.ts src/chat/chat.listener.spec.ts src/project/project.service.spec.ts src/project/project-membership/project-membership.service.spec.ts`
Expected: PASS.

- [ ] **Step 2: Run focused frontend suite**

Run: `npm run test -w @jitre/frontend -- --runInBand src/app/features/chat/chat.component.spec.ts src/app/features/chat/message-input.component.spec.ts src/app/features/projects/detail/project-detail.component.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run regression guard for realtime-related API/store files**

Run: `git diff -- packages/backend/src/chat packages/backend/src/project packages/frontend/src/app/features/chat packages/frontend/src/app/features/projects/detail packages/frontend/src/app/stores/chat-api.service.ts`
Expected: Reviewable diff with no unrelated file churn.

- [ ] **Step 4: Refactor only after green**

```ts
// Example allowed refactor after green:
function isProjectChannel(channel: ChatChannel): boolean {
  return channel.kind === 'project' && !!channel.projectId;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/chat packages/backend/src/project packages/frontend/src/app/features/chat packages/frontend/src/app/features/projects/detail packages/frontend/src/app/stores/chat-api.service.ts
git commit -m "feat(chat): integrate project channels and threads"
```
