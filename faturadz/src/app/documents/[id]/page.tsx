"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DraftEditor } from "@/components/editor/DraftEditor";
import { FinalView } from "@/components/editor/FinalView";
import { Notice } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const data = useDbQuery(
    async (db) => ({ doc: (await db.documents.get(id)) ?? null, business: (await db.settings.get("business")) ?? null }),
    [id],
  );

  if (!data) return null;
  if (!data.doc) {
    return (
      <div className="flex flex-col gap-3">
        <Notice tone="warn">Document introuvable.</Notice>
        <Link href="/" className="text-sm text-accent underline">
          Retour aux documents
        </Link>
      </div>
    );
  }
  if (data.doc.status === "final") return <FinalView doc={data.doc} />;
  // Keyed by id: the editor owns its state and is not reset by its own autosaves.
  return <DraftEditor key={data.doc.id} initial={data.doc} business={data.business} />;
}
