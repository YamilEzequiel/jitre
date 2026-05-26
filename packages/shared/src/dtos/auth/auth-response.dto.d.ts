import type { IAuthenticatedUser } from '../../interfaces/session-context.interface';
export interface IAuthResponseDto {
    accessToken: string;
    user: IAuthenticatedUser;
}
