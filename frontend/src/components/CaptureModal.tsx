import { useState } from "react";
import {
  BrainCircuit,
  Check,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import "./CaptureModal.css";

type EquipmentStatus =
  | "Confirmado"
  | "Reportado"
  | "Estimado"
  | "Desconocido";

interface Equipment {
  modality: string | null;
  quantity: number | null;
  brand: string | null;
  model: string | null;
  ageYears: number | null;
  status: EquipmentStatus;
}

interface AnalysisData {
  client: {
    name: string | null;
    city: string | null;
    country: string | null;
  };
  equipment: Equipment[];
  confidence: number;
  confidenceBreakdown?: Array<{
  label: string;
  score: number;
  maximum: number;
}>;
  missingFields: string[];
  followUpQuestion: string | null;
  summary: string;
}

interface AnalysisResponse {
  success: boolean;
  processedLocally: boolean;
  data: AnalysisData;
  performance?: {
    tokensPerSecond: number | null;
    stopReason: string | null;
  };
  error?: string;
  details?: string;
}

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const exampleObservation =
  "Estoy en Hospital DemoCare Pacific, en Ciudad de Panamá. Vi dos resonadores Philips y un tomógrafo. Uno de los resonadores parece tener unos ocho años.";

export default function CaptureModal({
  isOpen,
  onClose,
}: CaptureModalProps) {
  const [observation, setObservation] = useState("");
  const [result, setResult] = useState<AnalysisData | null>(null);
 const [performance, setPerformance] =
  useState<AnalysisResponse["performance"] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState("");

  if (!isOpen) return null;

  async function analyzeObservation() {
    if (!observation.trim()) {
      setError("Escribe una observación antes de analizarla.");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setResult(null);
    setSaved(false);
    setDuplicateMessage("");

    try {
      const response = await fetch("http://localhost:3001/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          observation,
        }),
      });

      const payload: AnalysisResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.details || payload.error || "No fue posible analizar el texto",
        );
      }

      setResult(payload.data);
      setPerformance(payload.performance);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar con QVAC.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function saveObservation() {
  if (!result) return;

  setError("");

  try {
    const response = await fetch(
      "http://localhost:3001/api/observations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawObservation: observation,
          data: result,
        }),
      },
    );

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(
        payload.details ||
          payload.error ||
          "No fue posible guardar la observación.",
      );
    }

    if (payload.duplicate) {
      setDuplicateMessage(payload.message);
      return;
    }

    setSaved(true);
  } catch (saveError) {
    setError(
      saveError instanceof Error
        ? saveError.message
        : "No fue posible guardar en SQLite.",
    );
  }
}

  function closeModal() {
    setObservation("");
    setResult(null);
    setPerformance(null);
    setError("");
    setSaved(false);
    setDuplicateMessage("");
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={closeModal}>
      <section
        className="capture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="capture-header">
          <div>
            <div className="capture-title-row">
              <div className="capture-symbol">
                <Sparkles size={21} />
              </div>
              <div>
                <p>NUEVA OBSERVACIÓN</p>
                <h2 id="capture-title">Captura inteligente de campo</h2>
              </div>
            </div>
            <span className="capture-description">
              Describe naturalmente lo que observaste durante la visita.
            </span>
          </div>

          <button
            className="close-button"
            onClick={closeModal}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="capture-body">
          <div className="capture-input-section">
            <div className="local-processing">
              <ShieldCheck size={17} />
              <div>
                <strong>Procesamiento privado</strong>
                <span>El contenido se analiza localmente con QVAC.</span>
              </div>
            </div>

            <label htmlFor="observation">
              ¿Qué observaste en el hospital?
            </label>

            <div className="textarea-container">
              <textarea
                id="observation"
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                placeholder="Ejemplo: Estoy en Hospital DemoCare Pacific..."
                rows={8}
                disabled={isAnalyzing}
              />

              <button
                className="voice-button"
                type="button"
                title="Dictado por voz: próximamente"
              >
                <Mic size={18} />
              </button>
            </div>

            <div className="input-actions">
              <button
                className="example-button"
                type="button"
                onClick={() => setObservation(exampleObservation)}
                disabled={isAnalyzing}
              >
                Usar ejemplo
              </button>

              <span>{observation.length} caracteres</span>
            </div>

            {error && <div className="capture-error">{error}</div>}

            <button
              className="analyze-button"
              type="button"
              onClick={analyzeObservation}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <LoaderCircle className="spinner" size={19} />
                  Analizando en el dispositivo...
                </>
              ) : (
                <>
                  <BrainCircuit size={19} />
                  Analizar con QVAC
                </>
              )}
            </button>
          </div>

          <div className="result-section">
            {!result && !isAnalyzing && (
              <div className="empty-result">
                <div>
                  <BrainCircuit size={34} />
                </div>
                <h3>La información estructurada aparecerá aquí</h3>
                <p>
                  Cetanex identificará el cliente, los equipos, los datos
                  faltantes y su nivel de confianza.
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="analysis-state">
                <LoaderCircle className="spinner" size={34} />
                <h3>QVAC está analizando la observación</h3>
                <p>Los datos permanecen dentro de este dispositivo.</p>
              </div>
            )}

            {result && (
              <div className="structured-result">
                <div className="result-heading">
                  <div>
                    <p>RESULTADO ESTRUCTURADO</p>
                    <h3>{result.client.name || "Cliente no identificado"}</h3>
                    <span>
                      {[result.client.city, result.client.country]
                        .filter(Boolean)
                        .join(", ") || "Ubicación no identificada"}
                    </span>
                  </div>

                  <div className="confidence-score">
                    <strong>{result.confidence}%</strong>
                    <span>Confianza</span>
                  </div>
                </div>

                <div className="equipment-results">
                  {result.equipment.map((equipment, index) => (
                    <article
                      className="equipment-result-card"
                      key={`${equipment.modality}-${index}`}
                    >
                      <div className="equipment-result-top">
                        <strong>
                          {equipment.quantity ?? "?"} ×{" "}
                          {equipment.modality || "Equipo no identificado"}
                        </strong>
                        <span
                          className={`result-status ${equipment.status.toLowerCase()}`}
                        >
                          {equipment.status}
                        </span>
                      </div>

                      <dl>
                        <div>
                          <dt>Marca</dt>
                          <dd>{equipment.brand || "Sin identificar"}</dd>
                        </div>
                        <div>
                          <dt>Modelo</dt>
                          <dd>{equipment.model || "Sin identificar"}</dd>
                        </div>
                        <div>
                          <dt>Antigüedad</dt>
                          <dd>
                            {equipment.ageYears !== null
                              ? `${equipment.ageYears} años`
                              : "Sin identificar"}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>

                {result.confidenceBreakdown && (
  <div className="confidence-breakdown">
    <div className="confidence-breakdown-title">
      <strong>Confianza explicable</strong>
      <span>{result.confidence}% total</span>
    </div>

    {result.confidenceBreakdown.map((factor) => {
      const percentage =
        (factor.score / factor.maximum) * 100;

      return (
        <div
          className="confidence-factor"
          key={factor.label}
        >
          <div>
            <span>{factor.label}</span>
            <strong>
              {factor.score}/{factor.maximum}
            </strong>
          </div>

          <div className="factor-progress">
            <span
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>
        </div>
      );
    })}
  </div>
)}

                {result.followUpQuestion && (
                  <div className="follow-up-card">
                    <Sparkles size={17} />
                    <div>
                      <strong>Pregunta recomendada</strong>
                      <p>{result.followUpQuestion}</p>
                    </div>
                  </div>
                )}

                <div className="result-summary">
                  <strong>Resumen de Cetanex</strong>
                  <p>{result.summary}</p>
                </div>

                {performance?.tokensPerSecond && (
                  <div className="performance-note">
                    Procesado localmente a{" "}
                    {performance.tokensPerSecond.toFixed(1)} tokens/segundo
                  </div>
                )}

                {duplicateMessage && (
                  <div className="duplicate-warning">
                    <strong>Posible duplicado detectado</strong>
                    <p>{duplicateMessage}</p>
                    <span>No se creó un registro adicional.</span>
                  </div>
                )}

                <button
                  className={`save-observation-button ${
                    saved || duplicateMessage ? "saved" : ""
                  }`}
                  type="button"
                  onClick={saveObservation}
                  disabled={saved || Boolean(duplicateMessage)}
                >
                  <Check size={18} />
                  {duplicateMessage
                    ? "Duplicado no guardado"
                    : saved
                      ? "Observación guardada"
                      : "Guardar en la base instalada"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}