import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ board: string; class: string; subject: string }> };

/** Previous-year questions now live under /pyq/…; this keeps old links and search results working. */
export default async function LegacyPyqPage({ params }: Props) {
  const p = await params;
  permanentRedirect(`/pyq/${encodeURIComponent(p.board)}/${encodeURIComponent(p.class)}/${encodeURIComponent(p.subject)}`);
}
