export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public messageKey: string,
    public args: unknown[] = [],
  ) {
    super(messageKey);
  }
}

export function bad(code: string, messageKey: string, ...args: unknown[]) {
  return new AppError(400, code, messageKey, args);
}

export function unauthorized(code: string, messageKey: string, ...args: unknown[]) {
  return new AppError(401, code, messageKey, args);
}

export function forbidden(code: string, messageKey: string, ...args: unknown[]) {
  return new AppError(403, code, messageKey, args);
}

export function notFound(code: string, messageKey: string, ...args: unknown[]) {
  return new AppError(404, code, messageKey, args);
}

export const Codes = {
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  REGISTRATION_NOT_INVITED: "REGISTRATION_NOT_INVITED",
  REFRESH_TOKEN_EXPIRED: "REFRESH_TOKEN_EXPIRED",
  PASSWORD_RESET_BLOCKED: "PASSWORD_RESET_BLOCKED",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  ROLE_NAME_EXISTS: "ROLE_NAME_EXISTS",
  NO_ROLES_ASSIGNED: "NO_ROLES_ASSIGNED",
  CANNOT_MODIFY_SELF: "CANNOT_MODIFY_SELF",
  CANNOT_DELETE_SELF: "CANNOT_DELETE_SELF",
  SYSTEM_ROLE_PROTECTED: "SYSTEM_ROLE_PROTECTED",
  ROLE_IN_USE: "ROLE_IN_USE",
  LAST_ADMIN: "LAST_ADMIN",
  ACCESS_DENIED: "ACCESS_DENIED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  EMAIL_CAMPAIGN: "EMAIL_CAMPAIGN",
  EMAIL_TEMPLATE: "EMAIL_TEMPLATE",
  EMAIL_DRAFT: "EMAIL_DRAFT",
  EMAIL_SUPPRESSION: "EMAIL_SUPPRESSION",
  EMAIL_ADDRESS_BOOK_CONTACT: "EMAIL_ADDRESS_BOOK_CONTACT",
  EMAIL_LABEL: "EMAIL_LABEL",
  EMAIL_SENDER_IDENTITY: "EMAIL_SENDER_IDENTITY",
  SENT_EMAIL: "SENT_EMAIL",
  MAIL_CONFIG: "MAIL_CONFIG",
} as const;

export const Msg = {
  NOT_FOUND: "exception.not_found",
  INVALID_CREDENTIALS: "exception.invalid_credentials",
  UNAUTHORIZED: "exception.unauthorized",
  FORBIDDEN: "exception.forbidden",
  ACCOUNT_INACTIVE: "exception.account_inactive",
  REGISTRATION_NOT_INVITED: "exception.registration_not_invited",
  PASSWORD_MISMATCH: "exception.password_mismatch",
  OTP_EXPIRED: "exception.otp_expired",
  REFRESH_TOKEN_MISSING: "exception.refresh_token_missing",
  REFRESH_TOKEN_NOT_FOUND: "exception.refresh_token_not_found",
  REFRESH_TOKEN_EXPIRED: "exception.refresh_token_expired",
  REFRESH_TOKEN_REUSE: "exception.refresh_token_reuse",
  PASSWORD_RESET_BLOCKED: "exception.password_reset_blocked",
  EMAIL_ALREADY_EXISTS: "exception.email_already_exists",
  ROLE_NAME_EXISTS: "exception.role_name_exists",
  NO_ROLES_ASSIGNED: "exception.no_roles_assigned",
  CANNOT_MODIFY_SELF: "exception.cannot_modify_self",
  CANNOT_DELETE_SELF: "exception.cannot_delete_self",
  SYSTEM_ROLE_PROTECTED: "exception.system_role_protected",
  ROLE_IN_USE: "exception.role_in_use",
  LAST_ADMIN: "exception.last_admin",
  CAMPAIGN_NAME_EXISTS: "exception.campaign_name_exists",
  CAMPAIGN_NO_CONTACTS: "exception.campaign_no_contacts",
  CAMPAIGN_MISSING_SUBJECT: "exception.campaign_missing_subject",
  CAMPAIGN_MISSING_BODY: "exception.campaign_missing_body",
  TEMPLATE_NAME_EXISTS: "exception.template_name_exists",
  TEMPLATE_IN_USE: "exception.template_in_use",
  EMAIL_SCHEDULE_IN_PAST: "exception.email_schedule_in_past",
  EMAIL_NOT_SCHEDULED: "exception.email_not_scheduled",
  EMAIL_SENDER_EXISTS: "exception.email_sender_exists",
  EMAIL_ALL_RECIPIENTS_SUPPRESSED: "exception.email_all_recipients_suppressed",
  EMAIL_CONTACT_EXISTS: "exception.email_contact_exists",
  EMAIL_CONTACT_IN_USE: "exception.email_contact_in_use",
  EMAIL_LABEL_EXISTS: "exception.email_label_exists",
  EMAIL_RECIPIENT_LIMIT: "exception.email_recipient_limit",
  EMAIL_SUBJECT_TOO_LONG: "exception.email_subject_too_long",
  EMAIL_BODY_TOO_LONG: "exception.email_body_too_long",
  EMAIL_ATTACHMENT_LIMIT: "exception.email_attachment_limit",
  EMAIL_ATTACHMENT_TOO_LARGE: "exception.email_attachment_too_large",
  EMAIL_ATTACHMENT_INVALID: "exception.email_attachment_invalid",
  EMAIL_RESEND_NO_RECIPIENTS: "exception.email_resend_no_recipients",
  MAIL_CONFIG_ALREADY_EXISTS: "exception.mail_config_already_exists",
  MAIL_CONFIG_PASSWORD_REQUIRED: "exception.mail_config_password_required",
  MAIL_CONFIG_TEST_FAILED: "exception.mail_config_test_failed",
  MAIL_NOT_CONFIGURED: "exception.mail_not_configured",
  VALIDATION_FAILED: "exception.validation_failed",
  MALFORMED_REQUEST: "exception.malformed_request",
  RESOURCE_NOT_FOUND: "exception.resource_not_found",
  ACCESS_DENIED: "exception.access_denied",
  INTERNAL_ERROR: "exception.internal_error",
  JWT_SECRET_TOO_SHORT: "exception.jwt_secret_too_short",
  ENTITY_ADMIN: "entity.admin",
  ENTITY_ROLE: "entity.role",
  ENTITY_OTP: "entity.otp",
  ENTITY_PASSWORD_RESET_TOKEN: "entity.password_reset_token",
  ENTITY_EMAIL_CAMPAIGN: "entity.email_campaign",
  ENTITY_EMAIL_TEMPLATE: "entity.email_template",
  ENTITY_EMAIL_DRAFT: "entity.email_draft",
  ENTITY_EMAIL_CONTACT: "entity.email_address_book_contact",
  ENTITY_EMAIL_LABEL: "entity.email_label",
  ENTITY_SENT_EMAIL: "entity.sent_email",
  ENTITY_MAIL_CONFIG: "entity.mail_config",
} as const;
