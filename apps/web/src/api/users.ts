export type { AdminAccount, UserListParams } from "./users.types";

export {
  adminUserDisplayName,
} from "./users.types";

import type { AdminAccount, UserListParams } from "./users.types";

/** System users picker is not available in the email-delivery standalone app. */
export async function fetchSystemUsers(_params?: UserListParams): Promise<AdminAccount[]> {
  return [];
}
