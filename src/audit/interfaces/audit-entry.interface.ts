export type AuditEntityType = 'employee' | 'department' | 'client' | 'task';

export interface AuditActor {
  id: number;
  fullName: string;
  username: string;
}

export interface AuditEntry {
  entityType: AuditEntityType;
  id: number;
  label: string;
  createdAt: Date;
  createdBy: AuditActor | null;
  deletedAt: Date;
  deletedBy: AuditActor | null;
}
