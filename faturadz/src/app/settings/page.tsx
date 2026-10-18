"use client";

import { BackupPanel } from "@/components/BackupPanel";
import { BusinessForm } from "@/components/BusinessForm";
import { useDbQuery } from "@/components/useDb";
import { getBusiness } from "@/db/repository";
import { fr } from "@/i18n/fr";

export default function SettingsPage() {
  // null = loaded and empty, undefined = still loading
  const business = useDbQuery(async (db) => (await getBusiness(db)) ?? null);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{fr.nav.settings}</h1>
      {/* Initial value only: a backup restore reloads the page. */}
      {business !== undefined && <BusinessForm initial={business} />}
      <BackupPanel />
    </div>
  );
}
