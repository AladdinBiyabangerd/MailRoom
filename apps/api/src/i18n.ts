type Dictionary = Record<string, string>;

const en: Dictionary = {
  "entity.admin": "Admin",
  "entity.role": "Role",
  "entity.otp": "Verification code",
  "entity.password_reset_token": "Password reset token",
  "entity.email_campaign": "Email campaign",
  "entity.email_template": "Email template",
  "entity.email_draft": "Email draft",
  "entity.email_address_book_contact": "Email contact",
  "entity.sent_email": "Sent email",
  "entity.mail_config": "Mail configuration",
  "exception.not_found": "{0} not found",
  "exception.invalid_credentials": "Invalid email or password",
  "exception.unauthorized": "Authentication is required to access this resource",
  "exception.forbidden": "You are not allowed to perform this action",
  "exception.jwt_secret_too_short": "Configured JWT secret is too short",
  "exception.account_inactive": "Your account is inactive. Please contact an administrator.",
  "exception.registration_not_invited": "Registration is invite-only. Please contact an administrator.",
  "exception.password_mismatch": "Passwords do not match",
  "exception.otp_expired": "The verification code has expired. Please request a new one.",
  "exception.refresh_token_missing": "Refresh token is missing",
  "exception.refresh_token_not_found": "Refresh token not found",
  "exception.refresh_token_expired": "Refresh token has expired. Please sign in again.",
  "exception.refresh_token_reuse": "Refresh token reuse detected. Please sign in again.",
  "exception.password_reset_blocked": "Too many failed attempts. Please try again later.",
  "exception.email_already_exists": "An admin with email '{0}' already exists",
  "exception.role_name_exists": "A role named '{0}' already exists",
  "exception.no_roles_assigned": "At least one role must be assigned",
  "exception.cannot_modify_self": "You cannot change the status of your own account",
  "exception.cannot_delete_self": "You cannot delete your own account",
  "exception.system_role_protected": "System roles cannot be modified or deleted",
  "exception.role_in_use": "This role is assigned to one or more admins and cannot be deleted",
  "exception.last_admin": "The last active admin cannot be deactivated or deleted",
  "exception.campaign_name_exists": "A campaign named '{0}' already exists",
  "exception.campaign_no_contacts": "Campaign has no contacts to send to",
  "exception.campaign_missing_subject": "Campaign has no subject. Set a default subject, link a template, or provide one in the send request",
  "exception.campaign_missing_body": "Campaign has no message body. Set a default body, link a template, or provide one in the send request",
  "exception.template_name_exists": "A template named '{0}' already exists",
  "exception.template_in_use": "This template is linked to one or more campaigns and cannot be deleted",
  "exception.email_schedule_in_past": "Scheduled send time must be in the future",
  "exception.email_not_scheduled": "Only scheduled emails can be rescheduled",
  "exception.email_sender_exists": "This sender email address is already registered",
  "exception.email_all_recipients_suppressed": "All recipients have unsubscribed and were removed from this send",
  "exception.email_contact_exists": "An email contact with address '{0}' already exists",
  "exception.email_recipient_limit": "Maximum {0} recipients allowed per email",
  "exception.email_subject_too_long": "Subject must be at most {0} characters",
  "exception.email_body_too_long": "Message body must be at most {0} characters",
  "exception.email_attachment_limit": "Maximum {0} attachments allowed per email",
  "exception.email_attachment_too_large": "Each attachment must be at most {0} bytes",
  "exception.email_attachment_invalid": "Attachment content is not valid Base64",
  "exception.email_resend_no_recipients": "No recipients matched the selected resend mode",
  "exception.mail_config_already_exists": "Mail configuration already exists for your account",
  "exception.mail_config_password_required": "SMTP password is required when creating mail configuration",
  "exception.mail_config_test_failed": "Failed to send test email. Please verify your SMTP settings",
  "exception.mail_not_configured":
    "SMTP is not configured. Save mail settings in Email Delivery, or set MAIL_HOST, MAIL_USERNAME and MAIL_PASSWORD.",
  "exception.validation_failed": "Validation failed",
  "exception.malformed_request": "The request body is malformed or unreadable",
  "exception.resource_not_found": "The requested resource was not found",
  "exception.access_denied": "Access is denied",
  "exception.internal_error": "An unexpected error occurred. Please try again later.",
  "exception.method_not_allowed": "HTTP method is not supported for this endpoint",
};

const az: Dictionary = {
  "entity.admin": "Admin",
  "entity.role": "Rol",
  "entity.otp": "Təsdiq kodu",
  "entity.password_reset_token": "Şifrə sıfırlama tokeni",
  "entity.email_campaign": "Email kampaniyası",
  "entity.email_template": "Email şablonu",
  "entity.email_draft": "Email qaralaması",
  "entity.email_address_book_contact": "Email kontaktı",
  "entity.sent_email": "Göndərilmiş email",
  "entity.mail_config": "Poçt konfiqurasiyası",
  "exception.not_found": "{0} tapılmadı",
  "exception.invalid_credentials": "Yanlış e-poçt və ya şifrə",
  "exception.unauthorized": "Bu resursa daxil olmaq üçün autentifikasiya tələb olunur",
  "exception.forbidden": "Bu əməliyyatı yerinə yetirməyə icazəniz yoxdur",
  "exception.account_inactive": "Hesabınız qeyri-aktivdir. Zəhmət olmasa administratorla əlaqə saxlayın.",
  "exception.registration_not_invited": "Qeydiyyat yalnız dəvət iledir. Zəhmət olmasa administratorla əlaqə saxlayın.",
  "exception.password_mismatch": "Şifrələr uyğun gəlmir",
  "exception.otp_expired": "Təsdiq kodunun müddəti bitib. Yeni kod tələb edin.",
  "exception.refresh_token_missing": "Refresh token yoxdur",
  "exception.refresh_token_expired": "Refresh tokenin müddəti bitib. Yenidən daxil olun.",
  "exception.email_already_exists": "'{0}' e-poçtu ilə admin artıq mövcuddur",
  "exception.access_denied": "Giriş rədd edildi",
  "exception.internal_error": "Gözlənilməz xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.",
  "exception.mail_not_configured":
    "SMTP tənzimlənməyib. Email Delivery ayarlarında host, istifadəçi və şifrəni saxlayın.",
};

const ru: Dictionary = {
  "entity.admin": "Админ",
  "entity.role": "Роль",
  "entity.otp": "Код подтверждения",
  "entity.password_reset_token": "Токен сброса пароля",
  "entity.email_campaign": "Email-кампания",
  "entity.email_template": "Шаблон письма",
  "entity.email_draft": "Черновик",
  "entity.email_address_book_contact": "Контакт",
  "entity.sent_email": "Отправленное письмо",
  "entity.mail_config": "Почтовая конфигурация",
  "exception.not_found": "{0} не найден",
  "exception.invalid_credentials": "Неверный email или пароль",
  "exception.unauthorized": "Для доступа требуется аутентификация",
  "exception.forbidden": "У вас нет прав для этого действия",
  "exception.account_inactive": "Ваш аккаунт неактивен. Обратитесь к администратору.",
  "exception.registration_not_invited": "Регистрация только по приглашению.",
  "exception.password_mismatch": "Пароли не совпадают",
  "exception.otp_expired": "Срок действия кода истёк. Запросите новый.",
  "exception.refresh_token_missing": "Refresh token отсутствует",
  "exception.refresh_token_expired": "Срок действия refresh token истёк. Войдите снова.",
  "exception.email_already_exists": "Админ с email '{0}' уже существует",
  "exception.access_denied": "Доступ запрещён",
  "exception.internal_error": "Произошла непредвиденная ошибка. Попробуйте позже.",
  "exception.mail_not_configured":
    "SMTP не настроен. Откройте настройки Email Delivery и укажите хост, логин и пароль.",
};

const ka: Dictionary = {
  "entity.admin": "ადმინი",
  "entity.role": "როლი",
  "entity.otp": "დადასტურების კოდი",
  "exception.not_found": "{0} ვერ მოიძებნა",
  "exception.invalid_credentials": "არასწორი ელფოსტა ან პაროლი",
  "exception.unauthorized": "ამ რესურსზე წვდომისთვის საჭიროა ავტორიზაცია",
  "exception.forbidden": "ამ მოქმედების უფლება არ გაქვთ",
  "exception.internal_error": "მოხდა მოულოდნელი შეცდომა. სცადეთ ხელახლა.",
  "exception.mail_not_configured":
    "SMTP არ არის კონფიგურირებული. Email Delivery პარამეტრებში მიუთითეთ ჰოსტი, მომხმარებელი და პაროლი.",
};

const locales: Record<string, Dictionary> = { en, az, ru, ka };

export function localeFromHeader(header: string | undefined): string {
  if (!header) return "en";
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "en";
  const short = first.slice(0, 2);
  return locales[short] ? short : "en";
}

function lookup(lang: string, key: string): string | undefined {
  return locales[lang]?.[key] ?? locales.en[key];
}

export function t(lang: string, key: string, args: unknown[] = []): string {
  let template = lookup(lang, key) ?? key;
  const resolvedArgs = args.map((arg) => {
    if (typeof arg === "string" && (arg.startsWith("entity.") || arg.startsWith("exception."))) {
      return lookup(lang, arg) ?? arg;
    }
    return arg == null ? "" : String(arg);
  });
  resolvedArgs.forEach((value, index) => {
    template = template.replaceAll(`{${index}}`, value);
  });
  return template;
}
