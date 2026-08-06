export interface AuthenticatedUser {
  sub: number;
  email: string;
  fullName: string;
  role: string;
  departmentId: number | null;
  deviceSessionId?: number;
}
