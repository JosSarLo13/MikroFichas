/**
 * ============================================================================
 * MIKROMANAGER - SHARED TYPES & DOMAIN CONTRACTS
 * Tipos, Enums e Interfaces compartidas entre Backend (Fastify) y Frontend (React)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. ROLES Y USUARIOS DEL SISTEMA
// ----------------------------------------------------------------------------

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  OPERADOR = 'OPERADOR',
  CONSULTA = 'CONSULTA',
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
  expiresIn: number;
}

// ----------------------------------------------------------------------------
// 2. ROUTERS MIKROTIK
// ----------------------------------------------------------------------------

export enum RouterStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  UNCHECKED = 'UNCHECKED',
  CONNECTING = 'CONNECTING',
}

export interface Router {
  id: string;
  name: string;
  host: string;
  apiPort: number;
  useSsl: boolean;
  username: string;
  rosVersion?: string | null;
  identity?: string | null;
  status: RouterStatus;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouterDto {
  name: string;
  host: string;
  apiPort?: number;
  useSsl?: boolean;
  username: string;
  password: string;
}

export interface UpdateRouterDto {
  name?: string;
  host?: string;
  apiPort?: number;
  useSsl?: boolean;
  username?: string;
  password?: string;
}

export interface RouterTelemetry {
  routerId: string;
  identity: string;
  rosVersion: string;
  boardName: string;
  cpuLoad: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  usedMemoryBytes: number;
  uptimeSeconds: number;
  activeUsersCount: number;
  timestamp: string;
}

export interface RouterTestResult {
  success: boolean;
  latencyMs: number;
  identity?: string;
  rosVersion?: string;
  errorMessage?: string;
}

// ----------------------------------------------------------------------------
// 3. PLANES Y TARIFAS
// ----------------------------------------------------------------------------

export enum ValidityType {
  UPTIME_ACCUMULATED = 'UPTIME_ACCUMULATED', // Solo descuenta mientras está conectado
  WALL_CLOCK_CALENDAR = 'WALL_CLOCK_CALENDAR', // Descuenta tiempo corrido desde 1er login
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  durationSeconds: number;
  validityType: ValidityType;
  downloadSpeedKbps: number;
  uploadSpeedKbps: number;
  dataLimitBytes: number; // 0 = sin límite
  sharedUsers: number;
  routerId: string;
  hotspotProfileName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanDto {
  name: string;
  price: number;
  durationSeconds: number;
  validityType: ValidityType;
  downloadSpeedKbps: number;
  uploadSpeedKbps: number;
  dataLimitBytes?: number;
  sharedUsers?: number;
  routerId: string;
  hotspotProfileName?: string;
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {}

// ----------------------------------------------------------------------------
// 4. TICKETS (FICHAS HOTSPOT)
// ----------------------------------------------------------------------------

export enum TicketStatus {
  AVAILABLE = 'AVAILABLE', // Generado, listo para vender
  RESERVED = 'RESERVED',   // Apartado en proceso de cobro
  SOLD = 'SOLD',           // Vendido, aún no activado en hotspot
  ACTIVE = 'ACTIVE',       // En línea actualmente en RouterOS
  EXPIRED = 'EXPIRED',     // Consumió tiempo o cuota
  DISABLED = 'DISABLED',   // Desactivado manualmente
}

export interface Ticket {
  id: string;
  batchId?: string | null;
  routerId: string;
  planId: string;
  username: string; // PIN o login de acceso
  password: string;
  rosUserId?: string | null; // ID retornado por /ip/hotspot/user (*1A)
  status: TicketStatus;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  plan?: Plan;
  router?: Router;
}

export interface GenerateTicketsDto {
  routerId: string;
  planId: string;
  quantity: number; // 1 a 500
  prefix?: string;
  pinLength?: number; // 4 a 12 caracteres
  pinType?: 'NUMERIC' | 'ALPHANUMERIC' | 'UPPERCASE';
  sameUserPassword?: boolean; // Usuario igual a contraseña
}

export interface TicketBatch {
  id: string;
  routerId: string;
  planId: string;
  userId: string;
  prefix: string;
  quantity: number;
  createdAt: string;
  plan?: Plan;
  router?: Router;
}

// ----------------------------------------------------------------------------
// 5. VENTAS Y CAJA (POS)
// ----------------------------------------------------------------------------

export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
  OTHER = 'OTHER',
}

export interface Sale {
  id: string;
  userId: string;
  routerId: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  createdAt: string;
  items: SaleItem[];
  user?: Pick<User, 'id' | 'username'>;
  router?: Pick<Router, 'id' | 'name'>;
}

export interface SaleItem {
  id: string;
  saleId: string;
  ticketId: string;
  unitPrice: number;
  ticket?: Ticket;
}

export interface CreateSaleDto {
  ticketIds: string[];
  paymentMethod: PaymentMethod;
  routerId: string;
  notes?: string;
}

export interface DailySalesSummary {
  date: string;
  totalRevenue: number;
  ticketsSoldCount: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  byPlan: Array<{ planName: string; count: number; total: number }>;
}

// ----------------------------------------------------------------------------
// 6. SESIONES EN VIVO Y MONITOREO HOTSPOT
// ----------------------------------------------------------------------------

export interface HotspotActiveSession {
  id: string; // .id en MikroTik (*4)
  user: string;
  address: string;
  macAddress: string;
  uptimeSeconds: number;
  bytesIn: number;
  bytesOut: number;
  timeLeftSeconds?: number;
  routerId: string;
  loginTime: string;
}

export interface KickUserRequest {
  routerId: string;
  sessionId: string; // MikroTik session .id
  username: string;
}

// ----------------------------------------------------------------------------
// 7. DASHBOARD & TELEMETRÍA GLOBAL
// ----------------------------------------------------------------------------

export interface DashboardSummary {
  routers: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
  hotspot: {
    activeSessions: number;
    connectedClients: number;
    totalTrafficRxBps: number;
    totalTrafficTxBps: number;
  };
  tickets: {
    available: number;
    soldToday: number;
    expired: number;
    total: number;
  };
  sales: {
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
  };
  topSellingPlan?: {
    name: string;
    soldCount: number;
  } | null;
}

// ----------------------------------------------------------------------------
// 8. RESPUESTAS GENÉRICAS DE LA API
// ----------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    details?: unknown;
  };
  timestamp: string;
}
