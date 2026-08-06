export interface RefreshTokenPayload {
  sub: number;
  role: string;
  departmentId: number | null;
  sessionType: 'web' | 'device';
  deviceSessionId?: number;
}
