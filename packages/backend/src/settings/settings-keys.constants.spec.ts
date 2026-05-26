import {
  KNOWN_KEYS,
  KNOWN_KEYS_FLAT,
  DEFAULT_VALUES,
} from './settings-keys.constants';

describe('settings-keys.constants (K2)', () => {
  describe('KNOWN_KEYS.notification', () => {
    const notificationKeys = KNOWN_KEYS.notification as readonly string[];

    it('includes notification.task_assigned', () => {
      expect(notificationKeys).toContain('notification.task_assigned');
    });

    it('includes notification.task_due_soon', () => {
      expect(notificationKeys).toContain('notification.task_due_soon');
    });

    it('includes notification.task_completed', () => {
      expect(notificationKeys).toContain('notification.task_completed');
    });

    it('includes notification.task_status_changed', () => {
      expect(notificationKeys).toContain('notification.task_status_changed');
    });

    it('includes notification.project_member_added', () => {
      expect(notificationKeys).toContain('notification.project_member_added');
    });
  });

  describe('KNOWN_KEYS.workspace', () => {
    it('includes notification.task_due_soon_window_days (workspace-scoped)', () => {
      expect(KNOWN_KEYS.workspace as readonly string[]).toContain(
        'notification.task_due_soon_window_days',
      );
    });
  });

  describe('DEFAULT_VALUES', () => {
    it('notification.task_assigned defaults to true', () => {
      expect(DEFAULT_VALUES['notification.task_assigned']).toBe(true);
    });

    it('notification.task_due_soon defaults to true', () => {
      expect(DEFAULT_VALUES['notification.task_due_soon']).toBe(true);
    });

    it('notification.task_completed defaults to true', () => {
      expect(DEFAULT_VALUES['notification.task_completed']).toBe(true);
    });

    it('notification.task_status_changed defaults to true', () => {
      expect(DEFAULT_VALUES['notification.task_status_changed']).toBe(true);
    });

    it('notification.project_member_added defaults to true', () => {
      expect(DEFAULT_VALUES['notification.project_member_added']).toBe(true);
    });

    it('notification.task_due_soon_window_days defaults to 3', () => {
      expect(DEFAULT_VALUES['notification.task_due_soon_window_days']).toBe(3);
    });
  });

  describe('KNOWN_KEYS_FLAT', () => {
    it('contains all 5 new notification keys in the flat list', () => {
      expect(KNOWN_KEYS_FLAT).toContain('notification.task_assigned');
      expect(KNOWN_KEYS_FLAT).toContain('notification.task_due_soon');
      expect(KNOWN_KEYS_FLAT).toContain('notification.task_completed');
      expect(KNOWN_KEYS_FLAT).toContain('notification.task_status_changed');
      expect(KNOWN_KEYS_FLAT).toContain('notification.project_member_added');
      expect(KNOWN_KEYS_FLAT).toContain(
        'notification.task_due_soon_window_days',
      );
    });
  });
});
