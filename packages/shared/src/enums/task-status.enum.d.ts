export declare enum TaskStatus {
    BACKLOG = "backlog",
    TODO = "todo",
    IN_PROGRESS = "in_progress",
    IN_REVIEW = "in_review",
    BLOCKED = "blocked",
    DONE = "done",
    CANCELED = "canceled"
}
export declare const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus>;
export declare function isTerminalStatus(status: TaskStatus): boolean;
