import type { AiPromptOperation } from './ai-prompt-template.entity';

/**
 * Seed library of built-in prompt templates. The seeder inserts one row
 * per template per workspace marked with `is_builtin = true` so the UI
 * renders them as read-only. The first template in each operation block
 * is the workspace default unless the admin promotes another.
 */
export interface BuiltinTemplate {
  operation: AiPromptOperation;
  name: string;
  description: string;
  systemPrompt: string;
  userTemplate: string;
  variables: string[];
  /** True when this template should become the default for its operation. */
  isInitialDefault: boolean;
}

export const BUILTIN_PROMPT_TEMPLATES: BuiltinTemplate[] = [
  // ---------- describe ----------
  {
    operation: 'describe',
    name: 'Default description',
    description: 'Concise plain-text description, technical tone. Platform default.',
    systemPrompt:
      'You are a project management assistant. Write clear, concise task descriptions in {{tone}} tone. Keep under 300 words. Return plain text only — no markdown headings, no bullet lists unless strictly necessary.',
    userTemplate:
      'Task: {{taskTitle}}\nProject: {{projectName}}\nExisting description: {{currentDescription}}\n\nWrite or improve the description so a new team member could pick this task up without asking questions.',
    variables: ['taskTitle', 'projectName', 'currentDescription', 'tone'],
    isInitialDefault: true,
  },
  {
    operation: 'describe',
    name: 'User Story (As a / I want / So that)',
    description: 'Classic agile user story format. Great for product backlog items.',
    systemPrompt:
      'You are an agile coach. Convert task titles into well-formed user stories using the "As a [persona], I want [capability], So that [outcome]" format. Add a short acceptance criteria list afterwards. Be specific but concise.',
    userTemplate:
      'Story title: {{taskTitle}}\nProject context: {{projectName}}\nNotes: {{currentDescription}}\n\nProduce:\n1. The user story in As-a / I-want / So-that form.\n2. 3 to 5 bullet acceptance criteria (each starts with a verb).\n3. One paragraph explaining the technical or business motivation.',
    variables: ['taskTitle', 'projectName', 'currentDescription'],
    isInitialDefault: false,
  },
  {
    operation: 'describe',
    name: 'User Story (Gherkin)',
    description: 'BDD-style Given/When/Then scenarios — pairs well with E2E test specs.',
    systemPrompt:
      'You are a QA engineer who writes specifications in Gherkin syntax. Output a valid `Feature:` block with at least 2 `Scenario:` sections, each using `Given`, `When`, `Then` (and optional `And`). Use precise, testable language.',
    userTemplate:
      'Feature title: {{taskTitle}}\nContext: {{currentDescription}}\n\nProduce a complete Gherkin specification ready to drop into a .feature file. Cover the happy path and at least one edge case.',
    variables: ['taskTitle', 'currentDescription'],
    isInitialDefault: false,
  },
  {
    operation: 'describe',
    name: 'Bug Report',
    description: 'Reproducible bug format: steps, expected vs actual, severity, environment.',
    systemPrompt:
      'You are a senior QA engineer producing bug reports that engineers can act on without follow-up questions. Use the headings: ### Summary, ### Steps to reproduce, ### Expected, ### Actual, ### Environment, ### Severity (Low | Medium | High | Critical), ### Suspected cause. Use markdown.',
    userTemplate:
      'Bug summary: {{taskTitle}}\nWhat the reporter said: {{currentDescription}}\n\nWrite a complete bug report. If a field can be reasonably inferred, fill it in; otherwise mark it `TBD`. Always include "Steps to reproduce" as a numbered list.',
    variables: ['taskTitle', 'currentDescription'],
    isInitialDefault: false,
  },
  {
    operation: 'describe',
    name: 'Technical Spec',
    description: 'Implementation-oriented spec with context, decisions, and tradeoffs.',
    systemPrompt:
      'You are a senior software engineer writing a short technical specification. Sections (markdown headings): ### Context, ### Goal, ### Non-goals, ### Proposed approach, ### Alternatives considered, ### Risks / open questions. Be precise, mention specific files / modules / endpoints when the input hints at them.',
    userTemplate:
      'Title: {{taskTitle}}\nNotes from the team: {{currentDescription}}\n\nDraft the technical spec. Keep it under 400 words. Prefer concrete API and data-model decisions over abstract prose.',
    variables: ['taskTitle', 'currentDescription'],
    isInitialDefault: false,
  },
  {
    operation: 'describe',
    name: 'ADR (Architecture Decision Record)',
    description: 'Lightweight ADR format. Use when the task is about a non-trivial design decision.',
    systemPrompt:
      'You are documenting an architecture decision using the lightweight ADR format. Sections: ### Status (Proposed | Accepted | Superseded), ### Context, ### Decision, ### Consequences (positive, negative, neutral). Be precise and irrevocable in tone — this is a decision record, not a discussion.',
    userTemplate:
      'Decision: {{taskTitle}}\nBackground notes: {{currentDescription}}\n\nWrite the ADR. Keep it under 350 words.',
    variables: ['taskTitle', 'currentDescription'],
    isInitialDefault: false,
  },

  // ---------- suggest_subtasks ----------
  {
    operation: 'suggest_subtasks',
    name: 'Default subtask breakdown',
    description: 'Generic decomposition into actionable subtasks. Platform default.',
    systemPrompt:
      'You break a parent task into actionable subtasks. Return ONLY valid JSON: {"subtasks":[{"title":"string","description":"optional string"}]}. Each title is a verb phrase (e.g. "Add migration for ...", "Wire endpoint to ...").',
    userTemplate:
      'Parent task: {{taskTitle}}\nDescription: {{taskDescription}}\n\nProduce at most {{maxSuggestions}} subtasks that together complete the parent. Avoid restating the parent.',
    variables: ['taskTitle', 'taskDescription', 'maxSuggestions'],
    isInitialDefault: true,
  },
];
