/**
 * Tipos de autenticación soportados por ReplicaHub.
 *
 * Los secretos deben llegar a los adaptadores YA descifrados por el dispatcher.
 * Esta librería nunca persiste ni cifra credenciales.
 */
export type RepeaterAuth =
  | { type: 'NONE' }
  | { type: 'IP_WHITELIST'; allowedIp?: string }
  | { type: 'TOKEN_HEADER'; headerName: string; token: string }
  | { type: 'BEARER_TOKEN'; token: string }
  | { type: 'API_KEY'; headerName: string; apiKey: string }
  | { type: 'BASIC_AUTH'; username: string; password: string }
  | { type: 'USER_PASSWORD'; username: string; password: string }
  | { type: 'CUSTOM_HEADERS'; headers: Record<string, string> };
