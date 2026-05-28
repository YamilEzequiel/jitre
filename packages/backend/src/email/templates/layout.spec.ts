import { renderLayout } from './layout';

describe('renderLayout()', () => {
  const base = {
    preheader: 'Preheader text',
    title: 'A new task',
    intro: 'Hi Alice, you have a thing.',
    blocks: [],
    reason: "You're receiving this because notifications are on.",
    workspaceName: 'Acme',
  };

  it('returns both html and text bodies', () => {
    const { html, text } = renderLayout(base);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(text).toContain('A new task');
    expect(text).toContain('Hi Alice, you have a thing.');
  });

  it('escapes HTML in title, intro and workspace name', () => {
    const { html } = renderLayout({
      ...base,
      title: '<script>alert(1)</script>',
      intro: 'Hi <b>Alice</b>',
      workspaceName: 'A&B',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Hi &lt;b&gt;Alice&lt;/b&gt;');
    expect(html).toContain('A&amp;B');
  });

  it('renders paragraph, facts and quote blocks', () => {
    const { html, text } = renderLayout({
      ...base,
      blocks: [
        { paragraph: 'Hello world' },
        {
          facts: [
            { label: 'Task', value: 'Ship it' },
            { label: 'Due', value: '2026-05-30' },
          ],
        },
        { quote: 'The original comment.' },
      ],
    });

    expect(html).toContain('Hello world');
    expect(html).toContain('Task');
    expect(html).toContain('Ship it');
    expect(html).toContain('The original comment.');

    expect(text).toContain('Hello world');
    expect(text).toContain('Task: Ship it');
    expect(text).toContain('Due: 2026-05-30');
    expect(text).toContain('> The original comment.');
  });

  it('renders a CTA button when provided', () => {
    const { html, text } = renderLayout({
      ...base,
      cta: { label: 'Open task', url: 'https://app.jitre.test/tasks/abc' },
    });
    expect(html).toContain('Open task');
    expect(html).toContain('https://app.jitre.test/tasks/abc');
    expect(text).toContain('Open task: https://app.jitre.test/tasks/abc');
  });

  it('omits the CTA when not provided', () => {
    const { html } = renderLayout(base);
    expect(html).not.toContain('Open task');
  });

  it('puts the preheader in a hidden span', () => {
    const { html } = renderLayout({
      ...base,
      preheader: 'Preview me',
    });
    expect(html).toMatch(/display:none[^>]*>Preview me<\/span>/);
  });

  it('falls back to "Jitre" when workspaceName is blank', () => {
    const { html } = renderLayout({ ...base, workspaceName: '   ' });
    expect(html).toContain('Jitre');
  });
});
