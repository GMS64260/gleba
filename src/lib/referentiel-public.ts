import type { Prisma } from "@prisma/client";

/**
 * Une page publique ne doit exposer que le catalogue officiel Gleba et les
 * contributions explicitement partagées. Les entrées personnelles privées ne
 * doivent jamais dépendre de la présence d'une session.
 */
export const visibiliteReferentielPublic: Prisma.EspeceWhereInput = {
  OR: [
    { userId: null },
    { userId: { not: null }, partageCommunaute: true },
  ],
};

export function visibiliteEnfantPublic() {
  return {
    OR: [
      { userId: null },
      { userId: { not: null }, partageCommunaute: true },
    ],
  };
}

export function nomPublic(entree: { id: string; nom: string | null }): string {
  return entree.nom?.trim() || entree.id;
}

export function originePublique(entree: { userId: string | null }): "Gleba" | "Communauté" {
  return entree.userId === null ? "Gleba" : "Communauté";
}
