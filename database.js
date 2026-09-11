import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const dataDirectory = fileURLToPath(new URL("./data/", import.meta.url));
const databasePath = fileURLToPath(
  new URL("./data/cetanex.db", import.meta.url),
);

mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    country TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    summary TEXT,
    follow_up_question TEXT,
    missing_fields TEXT NOT NULL,
    processed_locally INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL,
    modality TEXT,
    quantity INTEGER,
    brand TEXT,
    model TEXT,
    age_years INTEGER,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (observation_id) REFERENCES observations(id)
  );
`);

database.exec(`
  UPDATE equipment
  SET modality = 'Tomógrafo'
  WHERE LOWER(modality) LIKE '%tomograf%';

  UPDATE equipment
  SET modality = 'Resonador magnético'
  WHERE LOWER(modality) LIKE '%reson%';

  UPDATE equipment
  SET modality = 'Ecógrafo'
  WHERE LOWER(modality) LIKE '%ecograf%'
     OR LOWER(modality) LIKE '%ultrason%';

  UPDATE equipment
  SET modality = 'Rayos X'
  WHERE LOWER(modality) LIKE '%rayos x%'
     OR LOWER(modality) LIKE '%radiograf%';

  UPDATE equipment
  SET modality = 'Mamógrafo'
  WHERE LOWER(modality) LIKE '%mamograf%';
`);

const findClientStatement = database.prepare(`
  SELECT id
  FROM clients
  WHERE name = ?
    AND COALESCE(city, '') = ?
    AND COALESCE(country, '') = ?
  LIMIT 1
`);

const insertClientStatement = database.prepare(`
  INSERT INTO clients (id, name, city, country, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const insertObservationStatement = database.prepare(`
  INSERT INTO observations (
    id,
    client_id,
    raw_text,
    confidence,
    summary,
    follow_up_question,
    missing_fields,
    processed_locally,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
`);

const insertEquipmentStatement = database.prepare(`
  INSERT INTO equipment (
    id,
    observation_id,
    modality,
    quantity,
    brand,
    model,
    age_years,
    status,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function normalizeSignatureValue(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function createObservationSignature(client, equipment) {
  const clientSignature = [
    client?.name,
    client?.city,
    client?.country,
  ]
    .map(normalizeSignatureValue)
    .join("|");

  const equipmentSignature = [...(equipment ?? [])]
    .map((item) =>
      [
        item.modality,
        item.quantity ?? 1,
        item.brand,
        item.model,
        item.ageYears,
        item.status,
      ]
        .map(normalizeSignatureValue)
        .join("|"),
    )
    .sort()
    .join("::");

  return `${clientSignature}::${equipmentSignature}`;
}

export function saveObservation(rawText, data) {
    const incomingSignature = createObservationSignature(
    data.client,
    data.equipment,
  );

  const duplicate = getObservations().find((observation) => {
    const existingSignature = createObservationSignature(
      {
        name: observation.clientName,
        city: observation.city,
        country: observation.country,
      },
      observation.equipment,
    );

    return existingSignature === incomingSignature;
  });

  if (duplicate) {
    return {
      duplicate: true,
      existingObservationId: duplicate.id,
      createdAt: duplicate.createdAt,
    };
  }
  
  
  const createdAt = new Date().toISOString();
  const clientName = data.client?.name || "Cliente no identificado";
  const city = data.client?.city || "";
  const country = data.client?.country || "";

  database.exec("BEGIN TRANSACTION");

  try {
    let client = findClientStatement.get(clientName, city, country);
    let clientId = client?.id;

    if (!clientId) {
      clientId = randomUUID();

      insertClientStatement.run(
        clientId,
        clientName,
        city || null,
        country || null,
        createdAt,
      );
    }

    const observationId = randomUUID();

    insertObservationStatement.run(
      observationId,
      clientId,
      rawText,
      data.confidence ?? 0,
      data.summary ?? null,
      data.followUpQuestion ?? null,
      JSON.stringify(data.missingFields ?? []),
      createdAt,
    );

    for (const equipment of data.equipment ?? []) {
      insertEquipmentStatement.run(
        randomUUID(),
        observationId,
        equipment.modality ?? null,
        equipment.quantity ?? null,
        equipment.brand ?? null,
        equipment.model ?? null,
        equipment.ageYears ?? null,
        equipment.status ?? "Desconocido",
        createdAt,
      );
    }

    database.exec("COMMIT");

    return {
      observationId,
      clientId,
      createdAt,
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getObservations() {
  const observations = database
    .prepare(`
      SELECT
        o.id,
        o.raw_text AS rawText,
        o.confidence,
        o.summary,
        o.follow_up_question AS followUpQuestion,
        o.missing_fields AS missingFields,
        o.processed_locally AS processedLocally,
        o.created_at AS createdAt,
        c.id AS clientId,
        c.name AS clientName,
        c.city,
        c.country
      FROM observations o
      JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC
    `)
    .all();

  const equipmentStatement = database.prepare(`
    SELECT
      id,
      modality,
      quantity,
      brand,
      model,
      age_years AS ageYears,
      status
    FROM equipment
    WHERE observation_id = ?
    ORDER BY created_at ASC
  `);

  return observations.map((observation) => ({
    ...observation,
    processedLocally: Boolean(observation.processedLocally),
    missingFields: JSON.parse(observation.missingFields),
    equipment: equipmentStatement.all(observation.id),
  }));
}

export function getDashboardSummary() {
  const metrics = database
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM clients) AS totalClients,
        COALESCE(
          (SELECT SUM(COALESCE(quantity, 1)) FROM equipment),
          0
        ) AS totalEquipment,
        COALESCE(
          (
            SELECT SUM(COALESCE(quantity, 1))
            FROM equipment
            WHERE age_years >= 7
          ),
          0
        ) AS renewalOpportunities,
        COALESCE(
          (SELECT ROUND(AVG(confidence)) FROM observations),
          0
        ) AS averageConfidence
    `)
    .get();

  const modalities = database
    .prepare(`
      SELECT
        COALESCE(modality, 'Sin clasificar') AS name,
        SUM(COALESCE(quantity, 1)) AS cantidad
      FROM equipment
      GROUP BY modality
      ORDER BY cantidad DESC
    `)
    .all();

  const recentObservations = database
    .prepare(`
      SELECT
        c.name AS hospital,
        c.city,
        c.country,
        COALESCE(e.modality, 'Sin identificar') AS equipment,
        COALESCE(e.brand, 'Sin identificar') AS brand,
        CASE
          WHEN e.age_years IS NOT NULL
          THEN e.age_years || ' años'
          ELSE 'Sin confirmar'
        END AS age,
        o.confidence,
        e.status
      FROM equipment e
      JOIN observations o ON o.id = e.observation_id
      JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC
      LIMIT 6
    `)
    .all();

  return {
    metrics,
    modalities,
    recentObservations,
  };
}

export function getClientsOverview() {
  const clients = database
    .prepare(`
      SELECT
        c.id,
        c.name,
        c.city,
        c.country,

        (
          SELECT COUNT(*)
          FROM observations o
          WHERE o.client_id = c.id
        ) AS observationCount,

        COALESCE(
          (
            SELECT SUM(COALESCE(e.quantity, 1))
            FROM equipment e
            JOIN observations o ON o.id = e.observation_id
            WHERE o.client_id = c.id
          ),
          0
        ) AS totalEquipment,

        COALESCE(
          (
            SELECT ROUND(AVG(o.confidence))
            FROM observations o
            WHERE o.client_id = c.id
          ),
          0
        ) AS averageConfidence,

        (
          SELECT MAX(o.created_at)
          FROM observations o
          WHERE o.client_id = c.id
        ) AS lastUpdated

      FROM clients c
      ORDER BY c.name ASC
    `)
    .all();

  const equipmentStatement = database.prepare(`
    SELECT
      e.id,
      e.modality,
      e.quantity,
      e.brand,
      e.model,
      e.age_years AS ageYears,
      e.status,
      o.created_at AS observedAt
    FROM equipment e
    JOIN observations o ON o.id = e.observation_id
    WHERE o.client_id = ?
    ORDER BY e.modality ASC
  `);

  return clients.map((client) => {
    const equipment = equipmentStatement.all(client.id);

    return {
      ...client,
      renewalOpportunities: equipment
        .filter((item) => item.ageYears !== null && item.ageYears >= 7)
        .reduce((total, item) => total + (item.quantity ?? 1), 0),
      equipment,
    };
  });
}

export function getVerificationAlerts() {
  const rows = database
    .prepare(`
      SELECT
        e.id AS equipmentId,
        c.id AS clientId,
        c.name AS clientName,
        c.city,
        c.country,
        e.modality,
        e.quantity,
        e.brand,
        e.model,
        e.age_years AS ageYears,
        e.status,
        o.confidence,
        o.created_at AS observedAt
      FROM equipment e
      JOIN observations o ON o.id = e.observation_id
      JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at ASC
    `)
    .all();

  const currentTime = Date.now();

  return rows
    .map((row) => {
      const observedTime = Date.parse(row.observedAt);

      const daysSinceObserved = Number.isFinite(observedTime)
        ? Math.max(
            0,
            Math.floor(
              (currentTime - observedTime) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

      const reasons = [];
      let priorityScore = 0;

      if (row.status === "Desconocido") {
        reasons.push("La evidencia de la observación es desconocida.");
        priorityScore += 3;
      } else if (row.status === "Estimado") {
        reasons.push("La información contiene valores estimados.");
        priorityScore += 2;
      } else if (row.status === "Reportado") {
        reasons.push("El equipo fue reportado, pero no confirmado.");
        priorityScore += 1;
      }

      if (!row.brand) {
        reasons.push("La marca no ha sido identificada.");
        priorityScore += 2;
      }

      if (!row.model) {
        reasons.push("El modelo no ha sido identificado.");
        priorityScore += 2;
      }

      if (row.ageYears === null) {
        reasons.push("La antigüedad no ha sido verificada.");
        priorityScore += 2;
      }

      if (daysSinceObserved >= 180) {
        reasons.push(
          `La observación tiene ${daysSinceObserved} días sin actualizarse.`,
        );
        priorityScore += 3;
      } else if (daysSinceObserved >= 90) {
        reasons.push(
          `La observación tiene ${daysSinceObserved} días sin actualizarse.`,
        );
        priorityScore += 1;
      }

      if (row.confidence < 60) {
        reasons.push("La observación tiene confianza baja.");
        priorityScore += 2;
      } else if (row.confidence < 80) {
        reasons.push("La observación requiere revisión adicional.");
        priorityScore += 1;
      }

      const priority =
        priorityScore >= 6
          ? "Alta"
          : priorityScore >= 3
            ? "Media"
            : "Baja";

      let recommendedAction =
        "Solicitar una confirmación independiente.";

      if (!row.model) {
        recommendedAction =
          "Confirmar el modelo mediante una placa o etiqueta.";
      } else if (!row.brand) {
        recommendedAction =
          "Confirmar la marca del equipo.";
      } else if (row.ageYears === null) {
        recommendedAction =
          "Verificar la antigüedad o fecha de instalación.";
      } else if (daysSinceObserved >= 90) {
        recommendedAction =
          "Programar una nueva verificación de campo.";
      }

      return {
        ...row,
        daysSinceObserved,
        priority,
        priorityScore,
        reasons,
        recommendedAction,
      };
    })
    .filter((alert) => alert.reasons.length > 0)
    .sort((first, second) => {
      if (second.priorityScore !== first.priorityScore) {
        return second.priorityScore - first.priorityScore;
      }

      return (
        second.daysSinceObserved -
        first.daysSinceObserved
      );
    });
}