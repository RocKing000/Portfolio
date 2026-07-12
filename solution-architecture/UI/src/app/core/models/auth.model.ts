export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserDto {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  tenantCode: string;
  tenantName: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: UserDto;
  expiresAt: string;
}

/** Session stored in sessionStorage — extends LoginResponse with the derived encryption key. */
export interface EnterpriseChatbotSession extends LoginResponse {
  encryptionKey: string; // MD5(username+password) without hyphens — 32 hex chars
}

// Encrypted transport models
export interface GlobalRequest {
  channelId: string;
  digitalSignature: string;
  encryptedPayload: string;
  requestId: string;
  requestTime: string;
  transactionReferenceNumber: string;
  transactionType: string;
  versionNo: string;
  productInfo?: string;
}

export interface GlobalResponse {
  // PascalCase — matches .NET JsonSerializerOptions default
  ResponseCode?: string;
  ResponseMessage?: string;
  ResponseData?: string;  // AES-GCM encrypted JSON string
  Error?: { Code: string; Description: string };
  // camelCase fallbacks in case the API is configured with camelCase serialization
  responseCode?: string;
  responseMessage?: string;
  responseData?: string;
  error?: { code: string; description: string };
}
