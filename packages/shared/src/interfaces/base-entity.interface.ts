export interface IBaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
}

export interface ITenantEntity extends IBaseEntity {
  workspaceId: string;
}
