CREATE TABLE "hpdg808_contacts" (
    "email" CITEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "release_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hpdg808_contacts_pkey" PRIMARY KEY ("email"),
    CONSTRAINT "hpdg808_contacts_locale_check" CHECK ("locale" IN ('en', 'ru'))
);
