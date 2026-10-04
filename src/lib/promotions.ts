import { prisma } from './prisma';

// Shared by the public /api/promotions route, the rule-based chatbot, and
// the AI sales agent, so "what's active right now" is computed one way.
export async function getActivePromotions() {
  const now = new Date();
  return prisma.promotion.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, message: true, ctaLabel: true, ctaHref: true }
  });
}
