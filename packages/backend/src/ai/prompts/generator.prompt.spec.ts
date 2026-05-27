import { TaskPriority } from '@jitre/shared';
import {
  GeneratorParseError,
  parseGeneratorResponse,
  buildGeneratorSystemPrompt,
  buildGeneratorUserPrompt,
} from './generator.prompt';

describe('generator.prompt', () => {
  describe('buildGeneratorSystemPrompt()', () => {
    it('mentions both supported kinds and forbids prose output', () => {
      const sys = buildGeneratorSystemPrompt();
      expect(sys).toContain('"task"');
      expect(sys).toContain('"task_with_subtasks"');
      expect(sys).toContain('Return ONLY');
    });
  });

  describe('buildGeneratorUserPrompt()', () => {
    it('includes project name when present', () => {
      const user = buildGeneratorUserPrompt({
        prompt: 'plan the launch',
        projectName: 'Atlas',
      });
      expect(user).toContain('Active project: Atlas');
      expect(user).toContain('User request: plan the launch');
    });

    it('omits project line when no project context', () => {
      const user = buildGeneratorUserPrompt({ prompt: 'do X' });
      expect(user).not.toContain('Active project:');
    });
  });

  describe('parseGeneratorResponse()', () => {
    it('parses a minimal task draft', () => {
      const draft = parseGeneratorResponse(
        JSON.stringify({ kind: 'task', title: 'Write spec' }),
      );
      expect(draft.kind).toBe('task');
      if (draft.kind !== 'task') throw new Error('unreachable');
      expect(draft.title).toBe('Write spec');
      expect(draft.description).toBeNull();
      expect(draft.priority).toBeNull();
      expect(draft.labels).toEqual([]);
    });

    it('parses task_with_subtasks and clamps to 8 subtasks', () => {
      const subtasks = Array.from({ length: 12 }, (_, i) => ({ title: `step ${i + 1}` }));
      const draft = parseGeneratorResponse(
        JSON.stringify({
          kind: 'task_with_subtasks',
          parent: { title: 'Migration plan' },
          subtasks,
        }),
      );
      expect(draft.kind).toBe('task_with_subtasks');
      if (draft.kind !== 'task_with_subtasks') throw new Error('unreachable');
      expect(draft.subtasks).toHaveLength(8);
      expect(draft.parent.title).toBe('Migration plan');
    });

    it('lowercases and dedupes labels to a max of 5', () => {
      const draft = parseGeneratorResponse(
        JSON.stringify({
          kind: 'task',
          title: 'X',
          labels: ['FrontEnd', 'frontend', 'API', 'a', 'b', 'c', 'd', 'e'],
        }),
      );
      if (draft.kind !== 'task') throw new Error('unreachable');
      expect(draft.labels.length).toBeLessThanOrEqual(5);
      expect(draft.labels.every((l) => l === l.toLowerCase())).toBe(true);
    });

    it('strips a markdown JSON fence when the model adds one despite instructions', () => {
      const wrapped = '```json\n{"kind":"task","title":"Fix bug"}\n```';
      const draft = parseGeneratorResponse(wrapped);
      expect(draft.kind).toBe('task');
    });

    it('accepts known priorities and rejects unknown ones', () => {
      const ok = parseGeneratorResponse(
        JSON.stringify({ kind: 'task', title: 'X', priority: 'HIGH' }),
      );
      if (ok.kind !== 'task') throw new Error('unreachable');
      expect(ok.priority).toBe(TaskPriority.HIGH);

      const bad = parseGeneratorResponse(
        JSON.stringify({ kind: 'task', title: 'X', priority: 'BOGUS' }),
      );
      if (bad.kind !== 'task') throw new Error('unreachable');
      expect(bad.priority).toBeNull();
    });

    it('throws on non-JSON input', () => {
      expect(() => parseGeneratorResponse('not json at all')).toThrow(
        GeneratorParseError,
      );
    });

    it('throws on unsupported kind', () => {
      expect(() =>
        parseGeneratorResponse(JSON.stringify({ kind: 'doc', title: 'X' })),
      ).toThrow(GeneratorParseError);
    });

    it('throws when task is missing a title', () => {
      expect(() =>
        parseGeneratorResponse(JSON.stringify({ kind: 'task' })),
      ).toThrow(GeneratorParseError);
    });

    it('throws when task_with_subtasks has empty subtasks array', () => {
      expect(() =>
        parseGeneratorResponse(
          JSON.stringify({
            kind: 'task_with_subtasks',
            parent: { title: 'X' },
            subtasks: [],
          }),
        ),
      ).toThrow(GeneratorParseError);
    });

    it('parses a doc draft', () => {
      const draft = parseGeneratorResponse(
        JSON.stringify({
          kind: 'doc',
          title: 'Onboarding guide',
          icon: '📘',
          body: 'Welcome to the team.\n\nStep 1: read this.',
        }),
      );
      if (draft.kind !== 'doc') throw new Error('unreachable');
      expect(draft.title).toBe('Onboarding guide');
      expect(draft.icon).toBe('📘');
      expect(draft.body).toContain('Welcome');
    });

    it('parses a project draft and derives a key when the LLM omits it', () => {
      const draft = parseGeneratorResponse(
        JSON.stringify({
          kind: 'project',
          name: 'Atlas Launch Plan',
          icon: '🚀',
          color: '#6366F1',
        }),
      );
      if (draft.kind !== 'project') throw new Error('unreachable');
      expect(draft.name).toBe('Atlas Launch Plan');
      // First letters of each significant word → "ALP".
      expect(draft.key).toBe('ALP');
      expect(draft.icon).toBe('🚀');
      expect(draft.color).toBe('#6366F1');
    });

    it('falls back to a sane key when the name is a single word', () => {
      const draft = parseGeneratorResponse(
        JSON.stringify({ kind: 'project', name: 'Compass' }),
      );
      if (draft.kind !== 'project') throw new Error('unreachable');
      expect(draft.key.length).toBeGreaterThanOrEqual(3);
    });

    it('rejects malformed hex colors', () => {
      const draft = parseGeneratorResponse(
        JSON.stringify({
          kind: 'project',
          name: 'Atlas',
          color: 'red',
        }),
      );
      if (draft.kind !== 'project') throw new Error('unreachable');
      expect(draft.color).toBeNull();
    });
  });
});
