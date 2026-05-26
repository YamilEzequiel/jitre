export interface IProblemDetail {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    requestId?: string;
    errors?: Record<string, string[]>;
}
