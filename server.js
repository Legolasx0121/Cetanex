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
- Si varios equipos de la misma modalidad tienen atributos diferentes, sepáralos en elementos distintos.
- Si se mencionan dos equipos pero solo uno tiene antigüedad, crea uno con quantity 1 y esa antigüedad, y otro con quantity 1 y ageYears null.
- Las expresiones estimadas como "parece tener ocho años" afectan únicamente al equipo correspondiente y su estado debe ser "Estimado".
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

const ageWords = {
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
};

function splitPartiallyDescribedEquipment(data, observation) {
  const match = observation.match(
    /\buno\s+de\s+(?:los|las)\s+([a-záéíóúñü]+)[^.]{0,100}?(?:parece(?:\s+tener)?|tiene)\s+(?:unos?\s+|aproximadamente\s+)?(\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s+años?\b/iu,
  );

  if (!match || !Array.isArray(data.equipment)) {
    return data;
  }

  const mentionedModality = match[1]
    .toLowerCase()
    .replace(/(?:es|s)$/u, "");

  const ageToken = match[2].toLowerCase();
  const ageYears = /^\d+$/.test(ageToken)
    ? Number(ageToken)
    : ageWords[ageToken];

  const equipmentIndex = data.equipment.findIndex((equipment) => {
    const modality = String(equipment.modality ?? "").toLowerCase();

    return (
      Number(equipment.quantity) > 1 &&
      modality.includes(mentionedModality)
    );
  });

  if (equipmentIndex === -1 || !ageYears) {
    return data;
  }

  const original = data.equipment[equipmentIndex];
  const totalQuantity = Number(original.quantity);

  data.equipment.splice(
    equipmentIndex,
    1,
    {
      ...original,
      quantity: 1,
      ageYears,
      status: "Estimado",
    },
    {
      ...original,
      quantity: totalQuantity - 1,
      ageYears: null,
      status: "Reportado",
    },
  );

  return data;
}

function rebuildObservationMetadata(data) {
  const missingFields = [];

  if (!data.client?.name) missingFields.push("Nombre del cliente");
  if (!data.client?.city) missingFields.push("Ciudad");
  if (!data.client?.country) missingFields.push("País");

  data.equipment.forEach((equipment, index) => {
    const equipmentName =
      equipment.modality || `Equipo ${index + 1}`;

    if (!equipment.modality) {
      missingFields.push(`Modalidad de ${equipmentName}`);
    }

    if (!equipment.quantity) {
      missingFields.push(`Cantidad de ${equipmentName}`);
    }

    if (!equipment.brand) {
      missingFields.push(`Marca de ${equipmentName}`);
    }

    if (!equipment.model) {
      missingFields.push(`Modelo de ${equipmentName}`);
    }

    if (equipment.ageYears === null || equipment.ageYears === undefined) {
      missingFields.push(`Antigüedad de ${equipmentName}`);
    }
  });

  data.missingFields = [...new Set(missingFields)];

  const renewalCandidate = data.equipment.find(
    (equipment) =>
      Number(equipment.ageYears) >= 7 &&
      !equipment.model,
  );

  const equipmentWithoutBrand = data.equipment.find(
    (equipment) => !equipment.brand,
  );

  const equipmentWithoutAge = data.equipment.find(
    (equipment) =>
      equipment.ageYears === null ||
      equipment.ageYears === undefined,
  );

  if (renewalCandidate) {
    data.followUpQuestion =
      `¿Cuál es el modelo exacto del ${renewalCandidate.modality} ` +
      `estimado en ${renewalCandidate.ageYears} años?`;
  } else if (equipmentWithoutBrand) {
    data.followUpQuestion =
      `¿Cuál es la marca del ${equipmentWithoutBrand.modality}?`;
  } else if (equipmentWithoutAge) {
    data.followUpQuestion =
      `¿Cuál es la antigüedad aproximada del ${equipmentWithoutAge.modality}?`;
  } else {
    data.followUpQuestion = null;
  }

  if (typeof data.summary !== "string" || !data.summary.trim()) {
    const clientName = data.client?.name || "el cliente";

    const equipmentSummary = data.equipment
      .map((equipment) => {
        const quantity = equipment.quantity ?? 1;
        const modality = equipment.modality || "equipo";
        const brand = equipment.brand
          ? ` ${equipment.brand}`
          : "";
        const age =
          equipment.ageYears !== null &&
          equipment.ageYears !== undefined
            ? ` de ${equipment.ageYears} años`
            : "";

        return `${quantity} × ${modality}${brand}${age}`;
      })
      .join(", ");

    data.summary =
      `En ${clientName} se registraron: ${equipmentSummary}.`;
  }

  return data;
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

splitPartiallyDescribedEquipment(data, observation);
rebuildObservationMetadata(data);

return data;

}

function calculateConfidence(data) {
  const client = data.client ?? {};
  const equipment = data.equipment ?? [];

  const clientScore =
    (client.name ? 8 : 0) +
    (client.city ? 4 : 0) +
    (client.country ? 3 : 0);

  const equipmentWeights = {
    modality: 0.25,
    quantity: 0.15,
    brand: 0.2,
    model: 0.2,
    ageYears: 0.2,
  };

  const completenessRatios = equipment.map((item) => {
    let ratio = 0;

    if (item.modality) {
      ratio += equipmentWeights.modality;
    }

    if (item.quantity !== null && item.quantity !== undefined) {
      ratio += equipmentWeights.quantity;
    }

    if (item.brand) {
      ratio += equipmentWeights.brand;
    }

    if (item.model) {
      ratio += equipmentWeights.model;
    }

    if (item.ageYears !== null && item.ageYears !== undefined) {
      ratio += equipmentWeights.ageYears;
    }

    return ratio;
  });

  const averageCompleteness =
    completenessRatios.length > 0
      ? completenessRatios.reduce(
          (total, value) => total + value,
          0,
        ) / completenessRatios.length
      : 0;

  const completenessScore = Math.round(
    averageCompleteness * 45,
  );

  const evidenceValues = {
    Confirmado: 1,
    Reportado: 0.7,
    Estimado: 0.4,
    Desconocido: 0.1,
  };

  const averageEvidence =
    equipment.length > 0
      ? equipment.reduce(
          (total, item) =>
            total +
            (evidenceValues[item.status] ??
              evidenceValues.Desconocido),
          0,
        ) / equipment.length
      : 0;

  const evidenceScore = Math.round(
    averageEvidence * 25,
  );

  const followUpScore =
    data.missingFields?.length > 0
      ? data.followUpQuestion
        ? 10
        : 3
      : 10;

  const freshnessScore = 5;

  const totalScore = Math.min(
    100,
    clientScore +
      completenessScore +
      evidenceScore +
      followUpScore +
      freshnessScore,
  );

  return {
    score: totalScore,
    factors: [
      {
        label: "Identificación del cliente",
        score: clientScore,
        maximum: 15,
      },
      {
        label: "Completitud del equipo",
        score: completenessScore,
        maximum: 45,
      },
      {
        label: "Calidad de la evidencia",
        score: evidenceScore,
        maximum: 25,
      },
      {
        label: "Seguimiento de faltantes",
        score: followUpScore,
        maximum: 10,
      },
      {
        label: "Vigencia de la observación",
        score: freshnessScore,
        maximum: 5,
      },
    ],
  };
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

    const confidence = calculateConfidence(
      structuredObservation,
    );

    structuredObservation.confidence =
      confidence.score;

    structuredObservation.confidenceBreakdown =
      confidence.factors;


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

app.post("/api/ask", async (request, response) => {
  try {
    const question = request.body?.question?.trim();

    if (!question) {
      return response.status(400).json({
        success: false,
        error: "Debes escribir una pregunta.",
      });
    }

    if (!modelReady || !modelId) {
      return response.status(503).json({
        success: false,
        error: "El modelo local todavía se está preparando.",
      });
    }

    const filterPrompt = `
/no_think

Convierte la pregunta del usuario en filtros estructurados para consultar
una base instalada de equipos médicos.

REGLAS:
- No respondas la pregunta.
- Devuelve exclusivamente JSON válido.
- Usa null cuando no exista un filtro.
- "Siete años o más" significa minimumAge 7 e inclusive true.
- "Más de siete años" significa minimumAge 7 e inclusive false.
- Convierte números escritos con palabras a números.
- No inventes filtros.

FORMATO EXACTO:
{
  "country": null,
  "city": null,
  "modality": null,
  "brand": null,
  "status": null,
  "minimumAge": null,
  "minimumAgeInclusive": true,
  "maximumAge": null,
  "maximumAgeInclusive": true
}
`;

    console.log("\nInterpretando consulta localmente...");

    const run = completion({
      modelId,
      history: [
        {
          role: "system",
          content: filterPrompt,
        },
        {
          role: "user",
          content: question,
        },
      ],
      generationParams: {
        temp: 0,
        seed: 42,
        predict: 350,
      },
      stream: true,
      captureThinking: true,
    });

    const final = await run.final;
    const generatedFilters = extractJSON(final.contentText);

    const filters = {
      country: generatedFilters.country ?? null,
      city: generatedFilters.city ?? null,
      modality: generatedFilters.modality ?? null,
      brand: generatedFilters.brand ?? null,
      status: generatedFilters.status ?? null,
      minimumAge:
        generatedFilters.minimumAge !== null &&
        generatedFilters.minimumAge !== undefined
          ? Number(generatedFilters.minimumAge)
          : null,
      minimumAgeInclusive:
        generatedFilters.minimumAgeInclusive !== false,
      maximumAge:
        generatedFilters.maximumAge !== null &&
        generatedFilters.maximumAge !== undefined
          ? Number(generatedFilters.maximumAge)
          : null,
      maximumAgeInclusive:
        generatedFilters.maximumAgeInclusive !== false,
    };

    const normalizeSearch = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();

    const matchesText = (value, filter) => {
      if (!filter) return true;

      const normalizedValue = normalizeSearch(value);
      const normalizedFilter = normalizeSearch(filter);

      return (
        normalizedValue.includes(normalizedFilter) ||
        normalizedFilter.includes(normalizedValue)
      );
    };

    const clients = getClientsOverview();

    const filteredClients = clients
      .map((client) => {
        if (!matchesText(client.country, filters.country)) {
          return null;
        }

        if (!matchesText(client.city, filters.city)) {
          return null;
        }

        const matchingEquipment = client.equipment.filter(
          (equipment) => {
            if (
              !matchesText(
                equipment.modality,
                filters.modality,
              )
            ) {
              return false;
            }

            if (
              !matchesText(equipment.brand, filters.brand)
            ) {
              return false;
            }

            if (
              !matchesText(equipment.status, filters.status)
            ) {
              return false;
            }

            if (filters.minimumAge !== null) {
              if (equipment.ageYears === null) {
                return false;
              }

              const passesMinimum =
                filters.minimumAgeInclusive
                  ? equipment.ageYears >= filters.minimumAge
                  : equipment.ageYears > filters.minimumAge;

              if (!passesMinimum) {
                return false;
              }
            }

            if (filters.maximumAge !== null) {
              if (equipment.ageYears === null) {
                return false;
              }

              const passesMaximum =
                filters.maximumAgeInclusive
                  ? equipment.ageYears <= filters.maximumAge
                  : equipment.ageYears < filters.maximumAge;

              if (!passesMaximum) {
                return false;
              }
            }

            return true;
          },
        );

        if (matchingEquipment.length === 0) {
          return null;
        }

        return {
          client: client.name,
          city: client.city,
          country: client.country,
          equipment: matchingEquipment.map((equipment) => ({
            modality: equipment.modality,
            quantity: equipment.quantity,
            brand: equipment.brand,
            model: equipment.model,
            ageYears: equipment.ageYears,
            status: equipment.status,
          })),
        };
      })
      .filter(Boolean);

    const matchedClients = filteredClients.map(
      (client) => client.client,
    );

    const keyFindings = filteredClients.flatMap((client) =>
      client.equipment.map((equipment) => {
        const brand = equipment.brand
          ? ` ${equipment.brand}`
          : "";

        const age =
          equipment.ageYears !== null
            ? ` de ${equipment.ageYears} años`
            : " con antigüedad no disponible";

        return `${client.client}: ${equipment.quantity ?? 1} × ${
          equipment.modality
        }${brand}${age}.`;
      }),
    );

    const unknownAgeCount = clients.reduce(
      (total, client) =>
        total +
        client.equipment.filter(
          (equipment) => equipment.ageYears === null,
        ).length,
      0,
    );

    const answer =
      keyFindings.length > 0
        ? `Se encontraron ${matchedClients.length} cliente(s) que cumplen la consulta. ${keyFindings.join(
            " ",
          )}`
        : "No se encontraron clientes que cumplan los criterios de la consulta.";

    const dataLimitations = [];

    if (
      filters.minimumAge !== null ||
      filters.maximumAge !== null
    ) {
      if (unknownAgeCount > 0) {
        dataLimitations.push(
          `${unknownAgeCount} registro(s) no pudieron evaluarse porque no tienen antigüedad disponible.`,
        );
      }
    }

    response.json({
      success: true,
      processedLocally: true,
      question,
      analytics: {
        answer,
        matchedClients,
        keyFindings,
        dataLimitations,
        appliedFilters: filters,
      },
      performance: {
        tokensPerSecond:
          final.stats?.tokensPerSecond ?? null,
        stopReason: final.stopReason ?? null,
      },
    });

    console.log("Consulta analítica completada.");
  } catch (error) {
    console.error("Error realizando la consulta:", error);

    response.status(500).json({
      success: false,
      error: "No fue posible responder la consulta.",
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