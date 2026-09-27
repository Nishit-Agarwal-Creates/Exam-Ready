import { notFound } from "next/navigation";
import { getSubject, getSubjectStats, sumStats } from "./taxonomy";

/** Loads everything a subject-level SEO page needs, or 404s. */
export async function loadSubjectPage(p: { board: string; class: string; subject: string }) {
  const ctx = await getSubject(p.board, p.class, p.subject);
  if (!ctx) notFound();
  const stats = await getSubjectStats(ctx.subject.id);
  const base = `/${ctx.board.slug}/${ctx.cls.slug}/${ctx.subject.slug}`;
  const name = `${ctx.board.name} ${ctx.cls.name} ${ctx.subject.name}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: ctx.board.name, path: `/${ctx.board.slug}` },
    { name: ctx.cls.name, path: `/${ctx.board.slug}/${ctx.cls.slug}` },
    { name: ctx.subject.name, path: base },
  ];
  return { ...ctx, stats, totals: sumStats(stats), base, name, crumbs };
}

export async function subjectMetaContext(p: { board: string; class: string; subject: string }) {
  const ctx = await getSubject(p.board, p.class, p.subject);
  if (!ctx) return null;
  return {
    ctx,
    base: `/${ctx.board.slug}/${ctx.cls.slug}/${ctx.subject.slug}`,
    name: `${ctx.board.name} ${ctx.cls.name} ${ctx.subject.name}`,
  };
}
