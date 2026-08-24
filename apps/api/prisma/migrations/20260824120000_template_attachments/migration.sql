-- CreateTable
CREATE TABLE "email_template_attachments" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "email_template_attachments" ADD CONSTRAINT "email_template_attachments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
