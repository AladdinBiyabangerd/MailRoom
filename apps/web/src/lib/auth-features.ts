/**
 * Invite-only registration is disabled for now. Flip this (and
 * ADMIN_INVITE_ONLY_REGISTRATION on the API) to restore the invite copy and
 * require an admin-created pending user. Do not delete the invite path.
 */
export const INVITE_ONLY_REGISTRATION =
  import.meta.env.VITE_INVITE_ONLY_REGISTRATION === "true";
