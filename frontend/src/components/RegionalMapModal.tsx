import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Database,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import "./RegionalMapModal.css";

interface MapEquipment {
  id: string;
  modality: string;
  quantity: number;
  brand: string | null;
  model: string | null;
  ageYears: number | null;
  status: string;
}

interface MapClient {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  totalEquipment: number;
  averageConfidence: number;
  renewalOpportunities: number;
  equipment: MapEquipment[];
}

interface ClientsResponse {
  success: boolean;
  clients: MapClient[];
  error?: string;
}

interface RegionalMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PANAMA_COORDINATES: Array<[number, number]> = [
  [-77.881571, 7.223771],
  [-78.214936, 7.512255],
  [-78.429161, 8.052041],
  [-78.182096, 8.319182],
  [-78.435465, 8.387705],
  [-78.622121, 8.718124],
  [-79.120307, 8.996092],
  [-79.557877, 8.932375],
  [-79.760578, 8.584515],
  [-80.164481, 8.333316],
  [-80.382659, 8.298409],
  [-80.480689, 8.090308],
  [-80.00369, 7.547524],
  [-80.421158, 7.271572],
  [-80.886401, 7.220541],
  [-81.059543, 7.817921],
  [-81.519515, 7.70661],
  [-81.721311, 8.108963],
  [-82.131441, 8.175393],
  [-82.390934, 8.292362],
  [-82.820081, 8.290864],
  [-82.850958, 8.073823],
  [-82.965783, 8.225028],
  [-82.913176, 8.423517],
  [-82.829771, 8.626295],
  [-82.868657, 8.807266],
  [-82.719183, 8.925709],
  [-82.927155, 9.07433],
  [-82.932891, 9.476812],
  [-82.546196, 9.566135],
  [-82.187123, 9.207449],
  [-81.808567, 8.950617],
  [-81.714154, 9.031955],
  [-81.439287, 8.786234],
  [-80.947302, 8.858504],
  [-80.521901, 9.111072],
  [-79.9146, 9.312765],
  [-79.573303, 9.61161],
  [-79.021192, 9.552931],
  [-79.05845, 9.454565],
  [-78.500888, 9.420459],
  [-78.055928, 9.24773],
  [-77.729514, 8.946844],
  [-77.353361, 8.670505],
  [-77.474723, 8.524286],
  [-77.242566, 7.935278],
  [-77.431108, 7.638061],
  [-77.753414, 7.70984],
  [-77.881571, 7.223771],
];

const CITY_COORDINATES: Record<string, [number, number]> = {
  "ciudad de panama": [-79.5199, 8.9824],
  panama: [-79.5199, 8.9824],
  colon: [-79.9000, 9.3592],
  david: [-82.4308, 8.4273],
  santiago: [-80.9833, 8.1000],
  chitre: [-80.4297, 7.9608],
  "las tablas": [-80.2740, 7.7650],
  penonome: [-80.3550, 8.5189],
  aguadulce: [-80.5460, 8.2415],
  "la chorrera": [-79.7790, 8.8800],
  arraijan: [-79.6200, 8.9500],
  chepo: [-79.1000, 9.1700],
  boquete: [-82.4400, 8.7800],
  changuinola: [-82.5200, 9.4300],
  "bocas del toro": [-82.2400, 9.3400],
  "puerto armuelles": [-82.8600, 8.2800],
};

function normalizeText(value: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function projectCoordinate(longitude: number, latitude: number) {
  const minimumLongitude = -83.15;
  const maximumLongitude = -77.1;
  const minimumLatitude = 7.0;
  const maximumLatitude = 9.8;

  return {
    x: 35 + ((longitude - minimumLongitude) /
      (maximumLongitude - minimumLongitude)) * 830,
    y: 385 - ((latitude - minimumLatitude) /
      (maximumLatitude - minimumLatitude)) * 345,
  };
}

const panamaPath = PANAMA_COORDINATES.map(([longitude, latitude], index) => {
  const point = projectCoordinate(longitude, latitude);
  return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
}).join(" ") + " Z";

export default function RegionalMapModal({
  isOpen,
  onClose,
}: RegionalMapModalProps) {
  const [clients, setClients] = useState<MapClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3001/api/clients");
      const payload: ClientsResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "No fue posible cargar el mapa.");
      }

      setClients(payload.clients);

      const firstNationalClient = payload.clients.find(
        (client) =>
          normalizeText(client.country) === "panama" &&
          Boolean(CITY_COORDINATES[normalizeText(client.city)]),
      );

      setSelectedClientId((current) => current ?? firstNationalClient?.id ?? null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible consultar la información regional.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadClients();
    }
  }, [isOpen, loadClients]);

  const nationalClients = useMemo(
    () =>
      clients.filter(
        (client) => normalizeText(client.country) === "panama",
      ),
    [clients],
  );

  const mappedClients = useMemo(
    () =>
      nationalClients.flatMap((client) => {
        const coordinates = CITY_COORDINATES[normalizeText(client.city)];

        if (!coordinates) return [];

        const point = projectCoordinate(coordinates[0], coordinates[1]);

        return [{ client, point }];
      }),
    [nationalClients],
  );

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;

  const totalEquipment = nationalClients.reduce(
    (total, client) => total + client.totalEquipment,
    0,
  );

  const totalRenewals = nationalClients.reduce(
    (total, client) => total + client.renewalOpportunities,
    0,
  );

  const mappedCities = new Set(
    mappedClients.map(({ client }) => normalizeText(client.city)),
  ).size;

  const internationalClients = clients.length - nationalClients.length;

  if (!isOpen) return null;

  return (
    <div className="regional-backdrop" onMouseDown={onClose}>
      <section
        className="regional-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regional-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="regional-header">
          <div className="regional-heading">
            <div className="regional-symbol">
              <MapPin size={22} />
            </div>

            <div>
              <p>INTELIGENCIA TERRITORIAL</p>
              <h2 id="regional-title">Mapa nacional de base instalada</h2>
              <span>Distribución de clientes y equipos registrados en Panamá</span>
            </div>
          </div>

          <div className="regional-header-actions">
            <div className="regional-local-badge">
              <ShieldCheck size={15} />
              Datos locales
            </div>

            <button
              className="regional-refresh"
              type="button"
              onClick={() => void loadClients()}
              disabled={isLoading}
            >
              <RefreshCw
                size={16}
                className={isLoading ? "spinner" : ""}
              />
              Actualizar
            </button>

            <button
              className="close-button"
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="regional-metrics">
          <article>
            <Building2 size={18} />
            <div>
              <strong>{nationalClients.length}</strong>
              <span>Clientes en Panamá</span>
            </div>
          </article>

          <article>
            <Database size={18} />
            <div>
              <strong>{totalEquipment}</strong>
              <span>Equipos registrados</span>
            </div>
          </article>

          <article>
            <RefreshCw size={18} />
            <div>
              <strong>{totalRenewals}</strong>
              <span>Posibles renovaciones</span>
            </div>
          </article>

          <article>
            <MapPin size={18} />
            <div>
              <strong>{mappedCities}</strong>
              <span>Ciudades cubiertas</span>
            </div>
          </article>
        </div>

        <div className="regional-content">
          <div className="national-map-panel">
            {isLoading && clients.length === 0 ? (
              <div className="regional-loading">
                <LoaderCircle className="spinner" size={30} />
                Preparando mapa local...
              </div>
            ) : (
              <div className="national-map-canvas">
                <div className="map-grid" />

                <svg
                  viewBox="0 0 900 420"
                  role="img"
                  aria-label="Mapa de Panamá"
                >
                  <defs>
                    <linearGradient
                      id="panama-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#dedbff" />
                      <stop offset="100%" stopColor="#b9e8e1" />
                    </linearGradient>
                  </defs>

                  <path
                    d={panamaPath}
                    className="panama-territory"
                  />
                </svg>

                {mappedClients.map(({ client, point }) => (
                  <button
                    key={client.id}
                    className={`hospital-map-marker ${
                      selectedClientId === client.id ? "selected" : ""
                    } ${
                      client.renewalOpportunities > 0 ? "has-renewal" : ""
                    }`}
                    style={{
                      left: `${(point.x / 900) * 100}%`,
                      top: `${(point.y / 420) * 100}%`,
                    }}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    title={`${client.name} · ${client.totalEquipment} equipos`}
                  >
                    <span>
                      <Building2 size={14} />
                    </span>
                    <small>{client.city}</small>
                  </button>
                ))}

                <div className="map-legend">
                  <span><i className="normal-marker" /> Cliente</span>
                  <span><i className="renewal-marker" /> Renovación</span>
                </div>
              </div>
            )}

            {error && <div className="regional-error">{error}</div>}

            <div className="map-note">
              <ShieldCheck size={15} />
              Ubicaciones aproximadas por ciudad, procesadas sin geocodificación
              externa.
            </div>
          </div>

          <aside className="regional-client-panel">
            {!selectedClient ? (
              <div className="regional-empty">
                <MapPin size={32} />
                <h3>Selecciona un hospital</h3>
                <p>Pulsa un marcador para consultar su base instalada.</p>
              </div>
            ) : (
              <>
                <p className="regional-eyebrow">CLIENTE SELECCIONADO</p>
                <h3>{selectedClient.name}</h3>

                <span className="regional-location">
                  <MapPin size={14} />
                  {[selectedClient.city, selectedClient.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>

                <div className="regional-client-stats">
                  <div>
                    <strong>{selectedClient.totalEquipment}</strong>
                    <span>Equipos</span>
                  </div>
                  <div>
                    <strong>{selectedClient.averageConfidence}%</strong>
                    <span>Confianza</span>
                  </div>
                  <div>
                    <strong>{selectedClient.renewalOpportunities}</strong>
                    <span>Renovaciones</span>
                  </div>
                </div>

                <div className="regional-equipment-list">
                  <strong>Base instalada</strong>

                  {selectedClient.equipment.map((equipment) => (
                    <article key={equipment.id}>
                      <div>
                        <span>{equipment.quantity} × {equipment.modality}</span>
                        <small>
                          {equipment.brand || "Marca pendiente"}
                          {equipment.model ? ` · ${equipment.model}` : ""}
                        </small>
                      </div>

                      <span
                        className={`regional-status ${equipment.status.toLowerCase()}`}
                      >
                        {equipment.status}
                      </span>
                    </article>
                  ))}
                </div>

                {selectedClient.renewalOpportunities > 0 && (
                  <div className="regional-renewal-alert">
                    <TriangleAlert size={17} />
                    <span>
                      Este cliente tiene equipos con siete años o más.
                    </span>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>

        {internationalClients > 0 && (
          <footer className="regional-footer">
            {internationalClients} cliente(s) internacional(es) no se muestran
            en el mapa nacional de Panamá.
          </footer>
        )}
      </section>
    </div>
  );
}