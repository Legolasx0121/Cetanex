import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  Database,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import "./ClientsModal.css";

interface ClientEquipment {
  id: string;
  modality: string;
  quantity: number;
  brand: string | null;
  model: string | null;
  ageYears: number | null;
  status: string;
  baseConfidence: number;
confirmationCount: number;
confidence: number;
lastConfirmedAt: string | null;
  observedAt: string;
}

interface Client {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  observationCount: number;
  totalEquipment: number;
  averageConfidence: number;
  lastUpdated: string;
  renewalOpportunities: number;
  equipment: ClientEquipment[];
}

interface ClientsResponse {
  success: boolean;
  clients: Client[];
  error?: string;
}

interface ConfirmationResponse {
  success: boolean;
  duplicate: boolean;
  message: string;
  error?: string;
  details?: string;
}

interface ClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientsModal({
  isOpen,
  onClose,
}: ClientsModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingEquipmentId, setConfirmingEquipmentId] =
  useState<string | null>(null);
const [observerName, setObserverName] = useState("");
const [confirmationMessage, setConfirmationMessage] =
  useState("");
const [isConfirming, setIsConfirming] = useState(false);

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3001/api/clients");
      const payload: ClientsResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "No fue posible cargar los clientes.");
      }

      setClients(payload.clients);
      setSelectedClient((current) => {
        if (!current) return payload.clients[0] ?? null;

        return (
          payload.clients.find((client) => client.id === current.id) ??
          payload.clients[0] ??
          null
        );
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar con la base local.",
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

  async function registerIndependentConfirmation(
  equipmentId: string,
) {
  if (!observerName.trim()) {
    setError(
      "Escribe el nombre del colaborador que confirma.",
    );
    return;
  }

  setIsConfirming(true);
  setError("");
  setConfirmationMessage("");

  try {
    const response = await fetch(
      `http://localhost:3001/api/equipment/${equipmentId}/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          observerName: observerName.trim(),
        }),
      },
    );

    const payload: ConfirmationResponse =
      await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(
        payload.details ||
          payload.error ||
          "No fue posible registrar la confirmación.",
      );
    }

    setConfirmationMessage(payload.message);
    setObserverName("");
    setConfirmingEquipmentId(null);

    await loadClients();
  } catch (confirmationError) {
    setError(
      confirmationError instanceof Error
        ? confirmationError.message
        : "No fue posible registrar la confirmación.",
    );
  } finally {
    setIsConfirming(false);
  }
}

  if (!isOpen) return null;

  return (
    <div className="clients-backdrop" onMouseDown={onClose}>
      <section
        className="clients-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clients-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="clients-header">
          <div className="clients-heading">
            <div className="clients-symbol">
              <Building2 size={22} />
            </div>
            <div>
              <p>BASE INSTALADA</p>
              <h2 id="clients-title">Clientes y equipos médicos</h2>
              <span>
                Información consolidada desde observaciones de campo
              </span>
            </div>
          </div>

          <div className="clients-header-actions">
            <button
              className="refresh-clients"
              onClick={() => void loadClients()}
              disabled={isLoading}
            >
              <RefreshCw
                size={17}
                className={isLoading ? "spinner" : ""}
              />
              Actualizar
            </button>

            <button
              className="close-button"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="clients-content">
          <aside className="client-list">
            <div className="client-list-title">
              <strong>Clientes registrados</strong>
              <span>{clients.length}</span>
            </div>

            {isLoading && clients.length === 0 && (
              <div className="clients-loading">
                <LoaderCircle className="spinner" size={26} />
                Cargando base local...
              </div>
            )}

            {error && <div className="clients-error">{error}</div>}

            {clients.map((client) => (
              <button
                key={client.id}
                className={`client-option ${
                  selectedClient?.id === client.id ? "selected" : ""
                }`}
                onClick={() => setSelectedClient(client)}
              >
                <div className="client-option-icon">
                  <Building2 size={18} />
                </div>

                <div className="client-option-info">
                  <strong>{client.name}</strong>
                  <span>
                    {[client.city, client.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>

                <span className="equipment-count">
                  {client.totalEquipment}
                </span>
              </button>
            ))}
          </aside>

          <main className="client-details">
            {!selectedClient ? (
              <div className="no-client-selected">
                <Building2 size={36} />
                <h3>No hay clientes registrados</h3>
                <p>Guarda una observación para comenzar.</p>
              </div>
            ) : (
              <>
                <div className="client-detail-heading">
                  <div>
                    <p>PERFIL DEL CLIENTE</p>
                    <h3>{selectedClient.name}</h3>
                    <span>
                      <MapPin size={14} />
                      {[selectedClient.city, selectedClient.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>

                  <div className="client-confidence">
                    <strong>{selectedClient.averageConfidence}%</strong>
                    <span>Confianza</span>
                  </div>
                </div>

                <div className="client-metrics">
                  <article>
                    <Database size={18} />
                    <div>
                      <strong>{selectedClient.totalEquipment}</strong>
                      <span>Equipos</span>
                    </div>
                  </article>

                  <article>
                    <RefreshCw size={18} />
                    <div>
                      <strong>
                        {selectedClient.renewalOpportunities}
                      </strong>
                      <span>Posibles renovaciones</span>
                    </div>
                  </article>

                  <article>
                    <ShieldCheck size={18} />
                    <div>
                      <strong>{selectedClient.observationCount}</strong>
                      <span>Observaciones</span>
                    </div>
                  </article>
                </div>

                <div className="installed-heading">
                  <div>
                    <h4>Equipos instalados</h4>
                    <p>Inventario consolidado para este cliente</p>
                  </div>

                  <span>
                    <CalendarDays size={14} />
                    Actualizado{" "}
                    {new Intl.DateTimeFormat("es", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(selectedClient.lastUpdated))}
                  </span>
                </div>

                <div className="installed-equipment-list">
  {confirmationMessage && (
    <div className="confirmation-success">
      <UserCheck size={16} />
      {confirmationMessage}
    </div>
  )}

  {selectedClient.equipment.map((equipment) => (
    <div
      className="installed-equipment-wrapper"
      key={equipment.id}
    >
      <article className="installed-equipment">
        <div className="installed-equipment-main">
          <div className="equipment-quantity">
            {equipment.quantity}
          </div>

          <div>
            <strong>{equipment.modality}</strong>
            <span>
              {equipment.brand || "Marca sin identificar"}
              {equipment.model
                ? ` · ${equipment.model}`
                : ""}
            </span>
          </div>
        </div>

        <div className="equipment-age">
          <span>Antigüedad</span>
          <strong>
            {equipment.ageYears !== null
              ? `${equipment.ageYears} años`
              : "Pendiente"}
          </strong>
        </div>

        <span
          className={`client-equipment-status ${equipment.status.toLowerCase()}`}
        >
          {equipment.status}
        </span>
      </article>

      <div className="equipment-validation-row">
        <div className="equipment-effective-confidence">
          <ShieldCheck size={15} />

          <div>
            <span>Confianza efectiva</span>
            <strong>{equipment.confidence}%</strong>
          </div>

          <small>
            {equipment.confirmationCount === 0
              ? "Sin confirmaciones independientes"
              : `${equipment.confirmationCount} ${
                  equipment.confirmationCount === 1
                    ? "confirmación independiente"
                    : "confirmaciones independientes"
                }`}
          </small>
        </div>

        <button
          className="confirm-equipment-button"
          type="button"
          onClick={() => {
            setError("");
            setConfirmationMessage("");
            setObserverName("");
            setConfirmingEquipmentId(
              confirmingEquipmentId === equipment.id
                ? null
                : equipment.id,
            );
          }}
        >
          <UserCheck size={15} />
          Confirmación independiente
        </button>
      </div>

      {confirmingEquipmentId === equipment.id && (
        <div className="confirmation-form">
          <label htmlFor={`observer-${equipment.id}`}>
            Nombre del colaborador que verificó el equipo
          </label>

          <div>
            <input
              id={`observer-${equipment.id}`}
              value={observerName}
              onChange={(event) =>
                setObserverName(event.target.value)
              }
              placeholder="Ejemplo: Laura Gómez"
              disabled={isConfirming}
            />

            <button
              type="button"
              onClick={() =>
                void registerIndependentConfirmation(
                  equipment.id,
                )
              }
              disabled={
                isConfirming || !observerName.trim()
              }
            >
              {isConfirming ? (
                <LoaderCircle
                  className="spinner"
                  size={15}
                />
              ) : (
                <UserCheck size={15} />
              )}
              Registrar
            </button>
          </div>

          <small>
            Cada colaborador solo puede confirmar una vez
            este equipo.
          </small>
        </div>
      )}
    </div>
  ))}
</div>

                {selectedClient.renewalOpportunities > 0 && (
                  <div className="renewal-message">
                    <RefreshCw size={19} />
                    <div>
                      <strong>Oportunidad de renovación detectada</strong>
                      <p>
                        Este cliente tiene equipos con siete años o más.
                        Se recomienda una revisión comercial.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}