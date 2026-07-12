export interface AppConfigItem {
  configId: number;
  configKey: string;
  configValue: string;
  description?: string;
  category: string;
  dataType: string;
  isEncrypted: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UiConfigItem {
  configId: number;
  configKey: string;
  configValue: string;
  description?: string;
  componentType: string;
  section: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserListItem {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  roleId?: string;
  roleName: string;
  tenantId?: string;
  tenantName: string;
  isActive: boolean;
  createdAt: string;
}

export interface RoleListItem {
  roleId: string;
  roleName: string;
}

export interface TenantListItem {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  description?: string;
  contactEmail?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ErrorListItem {
  errorId: string;
  errorCode: string;
  errorTitle: string;
  errorDescription: string;
  solution: string;
  rootCause?: string;
  severity: string;
  category: string;
  tenantCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  auditId: string;
  tableName: string;
  action: string;
  details?: string;
  performedBy: string;
  performedAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  roleId: string;
  tenantId: string;
}

export interface UpdateUserRequest {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  roleId: string;
  isActive: boolean;
}

export interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
  requirePasswordChange: boolean;
}

export interface CreateTenantRequest {
  tenantCode: string;
  tenantName: string;
  description?: string;
  contactEmail?: string;
}

export interface CreateErrorRequest {
  errorCode: string;
  errorTitle: string;
  errorDescription: string;
  solution: string;
  rootCause?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  moduleId?: string;
  tenantCode: string;
}
