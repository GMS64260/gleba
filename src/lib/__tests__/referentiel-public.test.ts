import { describe, expect, it } from "vitest";

import {
  nomPublic,
  originePublique,
  visibiliteEnfantPublic,
  visibiliteReferentielPublic,
} from "@/lib/referentiel-public";

describe("référentiel public", () => {
  it("n'autorise que l'officiel et les contributions explicitement partagées", () => {
    const attendu = {
      OR: [
        { userId: null },
        { userId: { not: null }, partageCommunaute: true },
      ],
    };

    expect(visibiliteReferentielPublic).toEqual(attendu);
    expect(visibiliteEnfantPublic()).toEqual(attendu);
  });

  it("utilise le nom lisible puis l'identifiant comme repli", () => {
    expect(nomPublic({ id: "tomate", nom: " Tomate " })).toBe("Tomate");
    expect(nomPublic({ id: "tomate", nom: null })).toBe("tomate");
  });

  it("n'expose qu'une origine éditoriale générique", () => {
    expect(originePublique({ userId: null })).toBe("Gleba");
    expect(originePublique({ userId: "auteur-prive" })).toBe("Communauté");
  });
});

