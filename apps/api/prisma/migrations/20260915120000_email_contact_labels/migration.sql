-- CreateTable
CREATE TABLE "email_labels" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_contact_labels" (
    "id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "label_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_contact_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_labels_name_key" ON "email_labels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "email_contact_labels_contact_id_label_id_key" ON "email_contact_labels"("contact_id", "label_id");

-- AddForeignKey
ALTER TABLE "email_contact_labels" ADD CONSTRAINT "email_contact_labels_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "email_address_book_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_contact_labels" ADD CONSTRAINT "email_contact_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "email_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
