/** Backend: `AdminSystemUserAccessRequest` */
export interface UserAccess {
  pms: boolean;
  rms: boolean;
  guest: boolean;
}

export type UserAccessRequest = UserAccess;
export type AdminSystemUserAccessRequest = UserAccess;

export type UserStatus = "active" | "inactive";

export type SystemUserRole =
  | "superadmin"
  | "admin"
  | "manager"
  | "support"
  | "viewer";

export interface AdminAccount {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: SystemUserRole;
  tenant: string;
  status: UserStatus;
  access: UserAccess;
  hotelName: string;
  hotelEmail: string;
  planId: string;
  hotelLimit: number;
  employeeLimit: number;
  totalRooms: number;
  totalFloors: number;
  lastActive: string;
}

/** Backend: `CreateAdminSystemUserRequest` */
export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  access: UserAccess;
  planId: string;
  hotelLimit: number;
  employeeLimit: number;
}

export type CreateSystemUserRequest = CreateUserRequest;

/** Backend: `UpdateAdminSystemUserRequest` */
export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  access: UserAccess;
  planId: string;
  hotelLimit: number;
  employeeLimit: number;
}

export type UpdateSystemUserRequest = UpdateUserRequest;

/** Backend: `CreateAdminSystemHotelRequest` */
export interface CreateHotelRequest {
  hotelName: string;
  hotelEmail: string;
  totalRooms: number;
  totalFloors: number;
}

export type CreateSystemHotelRequest = CreateHotelRequest;

/** Backend: `UpdateAdminSystemHotelRequest` */
export interface UpdateHotelRequest {
  hotelName: string;
  hotelEmail: string;
  totalRooms: number;
  totalFloors: number;
}

export type UpdateSystemHotelRequest = UpdateHotelRequest;

/** Backend: `AdminSystemUserItemResponse` */
export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  tenant?: string;
  status: UserStatus;
  access: UserAccess;
  hotelLimit?: number;
  hotelName?: string;
  hotelEmail?: string;
  planId?: string;
  employeeLimit?: number;
  totalRooms?: number;
  totalFloors?: number;
  lastActive: string | null;
  createdAt?: string;
}

export type UserResponseForAdmin = UserResponse;
export type AdminSystemUserItemResponse = UserResponse;

export interface UserListResponse {
  items: UserResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface UserListParams {
  search?: string;
  status?: UserStatus;
  page?: number;
  limit?: number;
}

export function adminUserDisplayName(
  user: Pick<AdminAccount, "firstName" | "lastName">,
): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function userResponseToAccount(response: UserResponse): AdminAccount {
  return {
    id: response.id,
    firstName: response.firstName,
    lastName: response.lastName,
    email: response.email,
    role: (response.role as SystemUserRole) || "manager",
    tenant: response.tenant ?? "",
    status: response.status,
    access: {
      pms: response.access.pms,
      rms: response.access.rms,
      guest: response.access.guest ?? false,
    },
    hotelLimit: response.hotelLimit ?? 1,
    hotelName: response.hotelName ?? "",
    hotelEmail: response.hotelEmail ?? response.email,
    planId: response.planId ?? "STARTER",
    employeeLimit: response.employeeLimit ?? 0,
    totalRooms: response.totalRooms ?? 0,
    totalFloors: response.totalFloors ?? 0,
    lastActive: response.lastActive ?? "—",
  };
}
