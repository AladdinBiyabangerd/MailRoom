-- CreateSchema
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "last_active" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255),
    "system_role" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission" VARCHAR(64) NOT NULL,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("role_id","permission")
);

CREATE TABLE "admin_user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "admin_user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

CREATE TABLE "admin_refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admin_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_otp" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "expiration_time" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_otp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expiration_time" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "subject" VARCHAR(200),
    "html_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_address_book_contacts" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_address_book_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_campaigns" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "default_subject" VARCHAR(200),
    "default_html_body" TEXT,
    "template_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_campaign_contacts" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_drafts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "subject" VARCHAR(200),
    "body_html" TEXT,
    "campaign_id" INTEGER,
    "show_cc" BOOLEAN NOT NULL DEFAULT false,
    "show_bcc" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_draft_recipients" (
    "id" SERIAL NOT NULL,
    "draft_id" INTEGER NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120),
    "recipient_type" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_draft_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sent_emails" (
    "id" SERIAL NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body_html" TEXT NOT NULL,
    "sent_by_user_id" INTEGER,
    "sent_by_email" VARCHAR(160) NOT NULL,
    "sent_by_name" VARCHAR(120) NOT NULL,
    "sender_identity_id" INTEGER,
    "from_email" VARCHAR(160),
    "from_name" VARCHAR(120),
    "sent_at" TIMESTAMP(3) NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL,
    "campaign_id" INTEGER,
    "resend_of_email_id" INTEGER,
    "include_unsubscribe" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sent_email_recipients" (
    "id" SERIAL NOT NULL,
    "sent_email_id" INTEGER NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120),
    "recipient_type" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "error_message" VARCHAR(500),
    "open_tracking_token" VARCHAR(36),
    "unsubscribe_token" VARCHAR(36),
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sent_email_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sent_email_attachments" (
    "id" SERIAL NOT NULL,
    "sent_email_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sent_email_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_suppressions" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "unsubscribed_at" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "campaign_id" INTEGER,
    "sent_email_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_sender_identities" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sender_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_mail_configs" (
    "id" SERIAL NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_mail_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");
CREATE UNIQUE INDEX "admin_refresh_tokens_token_key" ON "admin_refresh_tokens"("token");
CREATE INDEX "admin_refresh_tokens_revoked_expires_at_idx" ON "admin_refresh_tokens"("revoked", "expires_at");
CREATE INDEX "admin_otp_email_purpose_used_idx" ON "admin_otp"("email", "purpose", "used");
CREATE INDEX "admin_password_reset_tokens_email_code_idx" ON "admin_password_reset_tokens"("email", "code");
CREATE UNIQUE INDEX "email_address_book_contacts_email_key" ON "email_address_book_contacts"("email");
CREATE UNIQUE INDEX "email_drafts_user_id_key" ON "email_drafts"("user_id");
CREATE INDEX "sent_emails_status_scheduled_at_idx" ON "sent_emails"("status", "scheduled_at");
CREATE UNIQUE INDEX "sent_email_recipients_open_tracking_token_key" ON "sent_email_recipients"("open_tracking_token");
CREATE UNIQUE INDEX "sent_email_recipients_unsubscribe_token_key" ON "sent_email_recipients"("unsubscribe_token");
CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");

ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_refresh_tokens" ADD CONSTRAINT "admin_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_campaign_contacts" ADD CONSTRAINT "email_campaign_contacts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_draft_recipients" ADD CONSTRAINT "email_draft_recipients_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sent_email_recipients" ADD CONSTRAINT "sent_email_recipients_sent_email_id_fkey" FOREIGN KEY ("sent_email_id") REFERENCES "sent_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sent_email_attachments" ADD CONSTRAINT "sent_email_attachments_sent_email_id_fkey" FOREIGN KEY ("sent_email_id") REFERENCES "sent_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
