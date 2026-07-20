-- Ledger volontairement minimal : aucune PII ni copie du message.
CREATE TABLE "growth_campaign_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "template_version" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    CONSTRAINT "growth_campaign_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "growth_campaign_contacts_contacted_at_idx" ON "growth_campaign_contacts"("contacted_at");
CREATE INDEX "growth_campaign_contacts_user_id_contacted_at_idx" ON "growth_campaign_contacts"("user_id", "contacted_at");
ALTER TABLE "growth_campaign_contacts" ADD CONSTRAINT "growth_campaign_contacts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
