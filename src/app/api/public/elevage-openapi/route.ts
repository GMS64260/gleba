import { NextResponse } from "next/server"

const jsonResponse = {
  description: "Réponse JSON",
  content: { "application/json": { schema: { type: "object" } } },
}

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "API Élevage Gleba",
      version: "2026-07-26",
      description:
        "Contrat des principales données d'élevage. Les routes applicatives utilisent la session Gleba ; le point d'entrée MCP utilise un jeton Bearer Gleba révocable.",
    },
    servers: [{ url: "https://gleba.fr", description: "Production" }],
    security: [{ sessionCookie: [] }],
    paths: {
      "/api/elevage/animaux": {
        get: {
          summary: "Lister les animaux",
          parameters: [
            { name: "statut", in: "query", schema: { type: "string" } },
            { name: "especeId", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": jsonResponse, "401": jsonResponse },
        },
        post: {
          summary: "Créer un animal",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AnimalInput" } } } },
          responses: { "201": jsonResponse, "400": jsonResponse, "401": jsonResponse },
        },
      },
      "/api/elevage/lots": {
        get: { summary: "Lister les lots", responses: { "200": jsonResponse, "401": jsonResponse } },
      },
      "/api/elevage/soins": {
        get: { summary: "Lister les soins et protocoles", responses: { "200": jsonResponse, "401": jsonResponse } },
        post: {
          summary: "Créer un soin ou protocole",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SoinInput" } } } },
          responses: { "201": jsonResponse, "422": jsonResponse, "401": jsonResponse },
        },
      },
      "/api/elevage/collectes-lait": {
        get: { summary: "Lister les collectes de lait", responses: { "200": jsonResponse, "401": jsonResponse } },
        post: {
          summary: "Importer une collecte de lait",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CollecteLaitInput" } } } },
          responses: { "201": jsonResponse, "422": jsonResponse, "401": jsonResponse },
        },
      },
      "/api/elevage/tests-sante": {
        get: { summary: "Lister les analyses de santé et résultats laboratoire", responses: { "200": jsonResponse, "401": jsonResponse } },
        post: {
          summary: "Importer un résultat d'analyse",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
          responses: { "201": jsonResponse, "400": jsonResponse, "401": jsonResponse },
        },
      },
      "/api/elevage/statuts-sanitaires": {
        get: { summary: "Lire les qualifications sanitaires et la synthèse du cheptel", responses: { "200": jsonResponse, "401": jsonResponse } },
      },
      "/api/elevage/inventaire-cheptel": {
        get: {
          summary: "Exporter l'inventaire du cheptel",
          responses: {
            "200": {
              description: "Inventaire CSV",
              content: { "text/csv": { schema: { type: "string" } } },
            },
            "401": jsonResponse,
          },
        },
      },
      "/api/mcp": {
        get: {
          summary: "Lister les outils MCP, dont les outils Élevage",
          security: [{ mcpBearer: [] }],
          responses: { "200": jsonResponse, "401": jsonResponse, "429": jsonResponse },
        },
        post: {
          summary: "Exécuter un outil MCP",
          description: "Corps : { tool, args, section: \"elevage\" }. Les outils d'écriture demandent une confirmation dans le client appelant.",
          security: [{ mcpBearer: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tool"],
                  properties: {
                    tool: { type: "string" },
                    args: { type: "object", additionalProperties: true },
                    section: { type: "string", enum: ["elevage"] },
                  },
                },
              },
            },
          },
          responses: { "200": jsonResponse, "400": jsonResponse, "401": jsonResponse, "429": jsonResponse },
        },
      },
    },
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "next-auth.session-token",
          description: "Session web Gleba. Ne pas transmettre ce cookie à un tiers.",
        },
        mcpBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "glb_*",
          description: "Jeton créé et révocable depuis Paramètres > Intégrations/API.",
        },
      },
      schemas: {
        AnimalInput: {
          type: "object",
          required: ["especeAnimaleId"],
          properties: {
            especeAnimaleId: { type: "string" },
            identifiant: { type: ["string", "null"] },
            nom: { type: ["string", "null"] },
            sexe: { type: ["string", "null"], enum: ["male", "femelle", "inconnu", null] },
            race: { type: ["string", "null"] },
            dateNaissance: { type: ["string", "null"], format: "date" },
          },
        },
        SoinInput: {
          type: "object",
          required: ["type"],
          properties: {
            animalId: { type: ["integer", "null"] },
            lotId: { type: ["integer", "null"] },
            type: { type: "string" },
            date: { type: "string", format: "date-time" },
            produitId: { type: ["string", "null"] },
            stockMedicamentId: { type: ["string", "null"] },
            quantite: { type: ["number", "null"] },
            unite: { type: ["string", "null"] },
            nbInjections: { type: "integer", minimum: 1, maximum: 30 },
            intervalleInjectionsHeures: { type: ["integer", "null"] },
            tempsAttenteLaitJ: { type: ["integer", "null"] },
            tempsAttenteViandeJ: { type: ["integer", "null"] },
          },
        },
        CollecteLaitInput: {
          type: "object",
          required: ["date", "traite", "quantiteLitres"],
          properties: {
            animalId: { type: ["integer", "null"] },
            lotId: { type: ["integer", "null"] },
            date: { type: "string", format: "date" },
            traite: { type: "string", enum: ["Matin", "Soir", "Unique"] },
            quantiteLitres: { type: "number", minimum: 0 },
            confirmerVolumeInhabituel: { type: "boolean" },
          },
        },
      },
    },
  })
}
