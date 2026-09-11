import express from "express";
import cors from "cors";
import { jsonrepair } from "jsonrepair";

import {
  loadModel,
  completion,
  unloadModel,
  QWEN3_1_7B_INST_Q4,
} from "@qvac/sdk";

import {
  getClientsOverview,
  getDashboardSummary,
  getObservations,
  saveObservation,
} from "./database.js";

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "2mb" }));

let modelId = null;
let modelReady = false;

const extractionPrompt = `
/no_think

Eres Cetanex, un extractor de información sobre equipos médicos instalados
en hospitales. Convierte la observación del usuario en JSON válido.

REGLAS OBLIGATORIAS:
- No inventes ni deduzcas datos que el usuario no proporcionó.
- Un atributo solamente pertenece al equipo mencionado junto a él.
- Nunca copies marca, modelo o antigüedad de un equipo hacia otro.
- Usa null para cualquier dato ausente.
- Nunca escribas "Desconocido" dentro de un campo de datos.
- La cantidad debe ser numérica.
- La antigüedad debe expresarse como número de años.
- "Estimado": contiene expresiones como "parece", "unos" o "aproximadamente".
- "Reportado": el colaborador afirma directamente que observó el equipo.
- "Confirmado": existe placa, etiqueta, documento o verificación explícita.
- "Desconocido": no puede determinarse cómo se obtuvo la información.
- El estado describe la evidencia del equipo, aunque otros campos estén vacíos.
- Incluye todos los equipos mencionados.
- Calcula una confianza entre 0 y 100 según completitud y precisión.
- Enumera los campos importantes que faltan.
- Formula una sola pregunta sobre el dato faltante más valioso.
- Devuelve exclusivamente JSON.
- No agregues Markdown ni explicaciones.

FORMATO EXACTO:
{
  "client": {
    "name": null,
    "city": null,
    "country": null
  },
  "equipment": [
    {
      "modality": null,
      "quantity": null,
      "brand": null,
      "model": null,
      "ageYears": null,
      "status": "Reportado"
    }
  ],
  "confidence": 0,
  "missingFields": [],
  "followUpQuestion": null,
  "summary": ""
}
`;

function extractJSON(text) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1) {
    throw new Error("QVAC no devolvió un objeto JSON reconocible.");
  }

  const candidate =
    lastBrace >= firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned.slice(firstBrace);

  try {
    return JSON.parse(candidate);
  } catch (originalError) {
    console.warn("Corrigiendo automáticamente la estructura JSON...");

    try {
      return JSON.parse(jsonrepair(candidate));
    } catch {
      console.error("Respuesta original de QVAC:", text);
      throw originalError;
    }
  }
}

function normalizeModality(modality) {
  if (!modality) return null;

  const normalized = modality.toLowerCase();

  if (normalized.includes("tomograf")) {
    return "Tomógrafo";
  }

  if (normalized.includes("reson")) {
    return "Resonador magnético";
  }

  if (
    normalized.includes("ecograf") ||
    normalized.includes("ultrason")
  ) {
    return "Ecógrafo";
  }

  if (
    normalized.includes("rayos x") ||
    normalized.includes("radiograf")
  ) {
    return "Rayos X";
  }

  if (normalized.includes("mamograf")) {
    return "Mamógrafo";
  }

  return modality.trim();
}

function validateAndEnrich(data, observation) {
  if (!data.client) {
    data.client = {
      name: null,
      city: null,
      country: null,
    };
  }

  if (!data.client.name) {
    const clientPattern =
      /\b((?:Hospital|Clínica|Clinica|Centro Médico|Centro Medico|Instituto)\s+[^,.;]+)/iu;

    const clientMatch = observation.match(clientPattern);

    if (clientMatch) {
      data.client.name = clientMatch[1].trim();
    }
  }

  if (data.client.country === "Panama") {
    data.client.country = "Panamá";
  }

  data.equipment = (data.equipment ?? []).map((equipment) => ({
    ...equipment,
    modality: normalizeModality(equipment.modality),
  }));

  return data;
}

async function initializeQVAC() {
  console.log("Cetanex está cargando QVAC localmente...");

  modelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: {
      ctx_size: 4096,
      gpu_layers: 99,
      device: "gpu",
    },
    onProgress: (progress) => {
      const percentage = progress.percentage.toFixed(0);
      process.stdout.write(
        `\rPreparando modelo: ${percentage}%`,
      );
    },
  });

  modelReady = true;

  console.log("\nQVAC está listo.");
}

app.get("/api/health", (_request, response) => {
  response.json({
    application: "Cetanex",
    status: "online",
    inference: modelReady ? "local-ready" : "loading",
    cloudInference: false,
  });
});

app.get("/api/dashboard", (_request, response) => {
  try {
    const dashboard = getDashboardSummary();

    response.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error("Error generando el dashboard:", error);

    response.status(500).json({
      success: false,
      error: "No fue posible generar el dashboard.",
      details:
        error instanceof Error
          ? error.message
          : "Error desconocido",
    });
  }
});

app.get("/api/clients", (_request, response) => {
  try {
    const clients = getClientsOverview();

    response.json({
      success: true,
      total: clients.length,
      clients,
    });
  } catch (error) {
    console.error("Error consultando clientes:", error);

    response.status(500).json({
      success: false,
      error: "No fue posible consultar los clientes.",
      details:
        error instanceof Error
          ? error.message
          : "Error desconocido",
    });
  }
});

app.get("/api/observations", (_request, response) => {
  try {
    const observations = getObservations();

    response.json({
      success: true,
      total: observations.length,
      observations,
    });
  } catch (error) {
    console.error(
      "Error consultando observaciones:",
      error,
    );

    response.status(500).json({
      success: false,
      error:
        "No fue posible consultar la base instalada.",
      details:
        error instanceof Error
          ? error.message
          : "Error desconocido",
    });
  }
});

app.post("/api/observations", (request, response) => {
  try {
    const { rawObservation, data } = request.body;

    if (!rawObservation?.trim() || !data) {
      return response.status(400).json({
        success: false,
        error:
          "La observación y los datos estructurados son obligatorios.",
      });
    }

    const savedRecord = saveObservation(
      rawObservation,
      data,
    );

    if (savedRecord.duplicate) {
      return response.status(200).json({
        success: true,
        duplicate: true,
        message:
          "Esta observación ya existe en la base instalada.",
        record: savedRecord,
      });
    }

    return response.status(201).json({
      success: true,
      duplicate: false,
      message: "Observación guardada localmente.",
      record: savedRecord,
    });
  } catch (error) {
    console.error(
      "Error guardando observación:",
      error,
    );

    return response.status(500).json({
      success: false,
      error:
        "No fue posible guardar la observación.",
      details:
        error instanceof Error
          ? error.message
          : "Error desconocido",
    });
  }
});

app.post("/api/analyze", async (request, response) => {
  try {
    const observation =
      request.body?.observation?.trim();

    if (!observation) {
      return response.status(400).json({
        success: false,
        error: "Debes escribir una observación.",
      });
    }

    if (!modelReady || !modelId) {
      return response.status(503).json({
        success: false,
        error:
          "El modelo local todavía se está preparando.",
      });
    }

    console.log(
      "\nAnalizando observación localmente...",
    );

    const run = completion({
      modelId,
      history: [
        {
          role: "system",
          content: extractionPrompt,
        },
        {
          role: "user",
          content: observation,
        },
      ],
      generationParams: {
        temp: 0,
        seed: 42,
        predict: 1200,
      },
      stream: true,
      captureThinking: true,
    });

    const final = await run.final;
    const extractedData = extractJSON(
      final.contentText,
    );

    const structuredObservation =
      validateAndEnrich(
        extractedData,
        observation,
      );

    response.json({
      success: true,
      processedLocally: true,
      data: structuredObservation,
      performance: {
        tokensPerSecond:
          final.stats?.tokensPerSecond ?? null,
        stopReason: final.stopReason ?? null,
      },
    });

    console.log(
      "Observación procesada correctamente.",
    );
  } catch (error) {
    console.error(
      "Error procesando la observación:",
      error,
    );

    response.status(500).json({
      success: false,
      error:
        "No fue posible estructurar la observación.",
      details:
        error instanceof Error
          ? error.message
          : "Error desconocido",
    });
  }
});

async function shutdown() {
  console.log("\nCerrando Cetanex...");

  modelReady = false;

  if (modelId) {
    await unloadModel({
      modelId,
      clearStorage: false,
    });

    modelId = null;
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await initializeQVAC();

  app.listen(PORT, () => {
    console.log(
      `Servidor local: http://localhost:${PORT}`,
    );
    console.log(
      `Estado: http://localhost:${PORT}/api/health`,
    );
  });
} catch (error) {
  console.error(
    "No se pudo iniciar Cetanex:",
    error,
  );

  process.exit(1);
}