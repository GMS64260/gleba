import { describe, expect, it } from "vitest";
import { contributionMediaSchema, importCommonsSchema } from "@/lib/validations/media-referentiel";

describe("médias du référentiel", () => {
  it("exige la détention des droits et l'acceptation de CC BY 4.0", () => {
    expect(contributionMediaSchema.safeParse({ auteur: "Alice", confirmationDroits: "false", acceptationLicence: "true" }).success).toBe(false);
    expect(contributionMediaSchema.safeParse({ auteur: "Alice", confirmationDroits: "true", acceptationLicence: "true" }).success).toBe(true);
  });

  it("refuse une licence Commons non prévue", () => {
    const base = { especeId: "Tomate", imageUrl: "https://upload.wikimedia.org/a.jpg", urlOrigine: "https://commons.wikimedia.org/wiki/File:A.jpg", auteur: "Alice", urlLicence: "https://creativecommons.org/licenses/by/4.0/", citation: "Alice / Wikimedia Commons", organe: "fruit" };
    expect(importCommonsSchema.safeParse({ ...base, licence: "Tous droits réservés" }).success).toBe(false);
    expect(importCommonsSchema.safeParse({ ...base, licence: "CC BY 4.0" }).success).toBe(true);
  });
});

