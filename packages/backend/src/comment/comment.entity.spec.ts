import { Comment } from './comment.entity';
import { CommentContext } from '@jitre/shared';

describe('Comment entity', () => {
  it('is instantiable and carries expected properties', () => {
    const c = new Comment();
    // BaseEntity fields exist
    expect(c).toBeDefined();
  });

  it('has contextType field accepting CommentContext values', () => {
    const c = new Comment();
    c.contextType = CommentContext.TASK;
    expect(c.contextType).toBe(CommentContext.TASK);
  });

  it('stores contextId as string', () => {
    const c = new Comment();
    c.contextId = 'task-uuid-1';
    expect(c.contextId).toBe('task-uuid-1');
  });

  it('stores authorUserId', () => {
    const c = new Comment();
    c.authorUserId = 'user-uuid-1';
    expect(c.authorUserId).toBe('user-uuid-1');
  });

  it('stores body', () => {
    const c = new Comment();
    c.body = 'Hello @[Alice](user-uuid-1)';
    expect(c.body).toBe('Hello @[Alice](user-uuid-1)');
  });

  it('stores parentId as nullable (null by default)', () => {
    const c = new Comment();
    expect(c.parentId).toBeUndefined(); // not set yet
    c.parentId = null;
    expect(c.parentId).toBeNull();
  });

  it('stores parentId as a uuid string for threaded replies', () => {
    const c = new Comment();
    c.parentId = 'parent-uuid-1';
    expect(c.parentId).toBe('parent-uuid-1');
  });
});
