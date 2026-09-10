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

export function saveObservation(rawText, data) {
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