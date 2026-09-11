import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import "./VerificationModal.css";

interface VerificationAlert {
  equipmentId: string;
  clientId: string;
  clientName: string;
  city: string | null;
  country: string | null;
  modality: string | null;
  quantity: number | null;
  brand: string | null;
  model: string | null;
  ageYears: number | null;
  status: string;
  confidence: number;
  observedAt: string;
  daysSinceObserved: number;
  priority: "Alta" | "Media" | "Baja";
  priorityScore: number;
  reasons: string[];
  recommendedAction: string;
}

interface VerificationResponse {
  success: boolean;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  alerts: VerificationAlert[];
  error?: string;
  details?: string;
}

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VerificationModal({
  isOpen,
  onClose,
}: VerificationModalProps) {
  const [payload, setPayload] =
    useState<VerificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:3001/api/verification-alerts",
      );

      const data: VerificationResponse =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.details ||
            data.error ||
            "No fue posible cargar las alertas.",
        );
      }

      setPayload(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar con Cetanex.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadAlerts();
    }
  }, [isOpen, loadAlerts]);

  if (!isOpen) return null;

  return (
    <div
      className="verification-backdrop"
      onMouseDown={onClose}
    >
      <section
        className="verification-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="verification-header">
          <div className="verification-heading">
            <div className="verification-symbol">
              <ShieldAlert size={23} />
            </div>

            <div>
              <p>CENTRO DE CALIDAD</p>
              <h2 id="verification-title">
                Pendientes de verificación
              </h2>
              <span>
                Cetanex prioriza los datos que necesitan una
                nueva confirmación.
              </span>
            </div>
          </div>

          <div className="verification-header-actions">
            <button
              type="button"
              onClick={() => void loadAlerts()}
              disabled={isLoading}
              aria-label="Actualizar alertas"
            >
              <RefreshCw
                className={isLoading ? "spinner" : ""}
                size={18}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="verification-body">
          {payload && (
            <div className="verification-summary">
              <article>
                <span>Total pendientes</span>
                <strong>{payload.summary.total}</strong>
              </article>

              <article className="high">
                <span>Prioridad alta</span>
                <strong>{payload.summary.high}</strong>
              </article>

              <article className="medium">
                <span>Prioridad media</span>
                <strong>{payload.summary.medium}</strong>
              </article>

              <article className="low">
                <span>Prioridad baja</span>
                <strong>{payload.summary.low}</strong>
              </article>
            </div>
          )}

          {isLoading && !payload && (
            <div className="verification-state">
              <LoaderCircle className="spinner" size={32} />
              <h3>Evaluando la calidad del dataset</h3>
              <p>Todo el análisis ocurre localmente.</p>
            </div>
          )}

          {error && (
            <div className="verification-error">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {payload && payload.alerts.length === 0 && (
            <div className="verification-state">
              <ShieldAlert size={34} />
              <h3>No hay verificaciones pendientes</h3>
              <p>La base instalada se encuentra actualizada.</p>
            </div>
          )}

          {payload && payload.alerts.length > 0 && (
            <div className="verification-list">
              {payload.alerts.map((alert) => (
                <article
                  className="verification-card"
                  key={alert.equipmentId}
                >
                  <div className="verification-card-header">
                    <div>
                      <span className="verification-client">
                        {alert.clientName}
                      </span>

                      <h3>
                        {alert.quantity ?? 1} ×{" "}
                        {alert.modality || "Equipo sin identificar"}
                      </h3>

                      <p>
                        <MapPin size={14} />
                        {[alert.city, alert.country]
                          .filter(Boolean)
                          .join(", ") || "Ubicación desconocida"}
                      </p>
                    </div>

                    <span
                      className={`priority-badge ${alert.priority.toLowerCase()}`}
                    >
                      {alert.priority}
                    </span>
                  </div>

                  <div className="verification-equipment-data">
                    <span>
                      Marca
                      <strong>
                        {alert.brand || "Sin identificar"}
                      </strong>
                    </span>

                    <span>
                      Modelo
                      <strong>
                        {alert.model || "Sin identificar"}
                      </strong>
                    </span>

                    <span>
                      Antigüedad
                      <strong>
                        {alert.ageYears !== null
                          ? `${alert.ageYears} años`
                          : "Sin verificar"}
                      </strong>
                    </span>

                    <span>
                      Confianza
                      <strong>{alert.confidence}%</strong>
                    </span>
                  </div>

                  <ul>
                    {alert.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>

                  <div className="verification-action">
                    <CalendarClock size={18} />
                    <div>
                      <span>Siguiente mejor acción</span>
                      <strong>{alert.recommendedAction}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}