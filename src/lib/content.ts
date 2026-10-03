// Admin-editable site content. Each row is a JSON blob keyed by a
// section name; the admin CMS (Admin > Content) edits these, the
// public pages read them with a typed fallback so the site always
// renders correctly even before an admin has customized anything.
import { prisma } from './prisma';

export async function getSiteContent<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key } });
    if (!row) return fallback;
    return { ...fallback, ...JSON.parse(row.data) } as T;
  } catch {
    return fallback;
  }
}

export async function setSiteContent(key: string, label: string, data: unknown, updatedBy?: string) {
  return prisma.siteContent.upsert({
    where: { key },
    create: { key, label, data: JSON.stringify(data), updatedBy },
    update: { data: JSON.stringify(data), updatedBy, label }
  });
}
