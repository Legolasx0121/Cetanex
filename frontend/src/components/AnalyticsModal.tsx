import { useState, type FormEvent } from "react";
import {
  Database,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import "./AnalyticsModal.css";

interface AppliedFilters {
  country: string | null;
  city: string | null;
  modality: string | null;
  brand: string | null;
  status: string | null;
  minimumAge: number | null;
  minimumAgeInclusive: boolean;
  maximumAge: number | null;
  maximumAgeInclusive: boolean;
}

interface AnalyticsResult {
  answer: string;
  matchedClients: string[];
  keyFindings: string[];
  dataLimitations: string[];
  appliedFilters: AppliedFilters;
}

interface AnalyticsResponse {
  success: boolean;
  processedLocally: boolean;
  analytics: AnalyticsResult;
  performance?: {
    tokensPerSecond: number | null;
    stopReason: string | null;
  };
  error?: string;
  details?: string;
}

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const suggestedQuestions = [
  "¿Qué clientes tienen equipos con siete años o más?",
  "¿Qué equipos Philips están registrados?",
  "¿Qué equipos tienen antigüedad desconocida?",
];

export default function AnalyticsModal({
  isOpen,
  onClose,
}: AnalyticsModalProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] =
    useState<AnalyticsResult | null>(null);
  const [performance, setPerformance] =
    useState<AnalyticsResponse["performance"] | null>(
      null,
    );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function askCetanex(event?: FormEvent) {
    event?.preventDefault();

    if (!question.trim()) {
      setError("Escribe una pregunta sobre la base instalada.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "http://localhost:3001/api/ask",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
          }),
        },
      );

      const payload: AnalyticsResponse =
        await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.details ||
            payload.error ||
            "No fue posible realizar la consulta.",
        );
      }

      setResult(payload.analytics);
      setPerformance(payload.performance ?? null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar con Cetanex.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function closeModal() {
    setQuestion("");
    setResult(null);
    setPerformance(null);
    setError("");
    onClose();
  }

  function describeAgeFilter(filters: AppliedFilters) {
    if (filters.minimumAge !== null) {
      return filters.minimumAgeInclusive
        ? `${filters.minimumAge} años o más`
        : `Más de ${filters.minimumAge} años`;
    }

    if (filters.maximumAge !== null) {
      return filters.maximumAgeInclusive
        ? `${filters.maximumAge} años o menos`
        : `Menos de ${filters.maximumAge} años`;
    }

    return null;
  }

  return (
    <div
      className="analytics-backdrop"
      onMouseDown={closeModal}
    >
      <section
        className="analytics-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="analytics-header">
          <div className="analytics-heading">
            <div className="analytics-symbol">
              <Sparkles size={22} />
            </div>

            <div>
              <p>CETANEX INTELLIGENCE</p>
              <h2 id="analytics-title">
                Consulta la base instalada
              </h2>
              <span>
                Pregunta en lenguaje natural, sin enviar datos a la nube
              </span>
            </div>
          </div>

          <button
            className="analytics-close"
            onClick={closeModal}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="analytics-content">
          <aside className="analytics-sidebar">
            <div className="analytics-privacy">
              <ShieldCheck size={19} />
              <div>
                <strong>Consulta privada</strong>
                <span>
                  QVAC interpreta la pregunta localmente.
                </span>
              </div>
            </div>

            <div className="suggested-questions">
              <strong>Preguntas sugeridas</strong>

              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuestion(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="analytics-method">
              <Database size={18} />
              <div>
                <strong>Respuesta verificable</strong>
                <p>
                  Los filtros se ejecutan directamente sobre SQLite para
                  evitar resultados inventados.
                </p>
              </div>
            </div>
          </aside>

          <main className="analytics-main">
            <form
              className="analytics-form"
              onSubmit={askCetanex}
            >
              <label htmlFor="analytics-question">
                ¿Qué deseas conocer?
              </label>

              <div className="analytics-input">
                <input
                  id="analytics-question"
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  placeholder="Ejemplo: clientes con equipos de siete años o más"
                  disabled={isLoading}
                />

                <button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <LoaderCircle
                      className="spinner"
                      size={18}
                    />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="analytics-error">
                <TriangleAlert size={17} />
                {error}
              </div>
            )}

            {!result && !isLoading && (
              <div className="analytics-empty">
                <div>
                  <Sparkles size={34} />
                </div>
                <h3>Pregunta a tus datos</h3>
                <p>
                  Cetanex convertirá la pregunta en filtros,
                  consultará SQLite y mostrará una respuesta sustentada.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="analytics-loading">
                <LoaderCircle
                  className="spinner"
                  size={35}
                />
                <h3>Analizando la consulta</h3>
                <p>
                  QVAC está interpretando tu pregunta en el dispositivo.
                </p>
              </div>
            )}

            {result && (
              <div className="analytics-result">
                <div className="analytics-answer">
                  <div className="answer-icon">
                    <Sparkles size={19} />
                  </div>

                  <div>
                    <span>RESPUESTA DE CETANEX</span>
                    <p>{result.answer}</p>
                  </div>
                </div>

                {result.matchedClients.length > 0 && (
                  <div className="matched-clients">
                    <strong>Clientes encontrados</strong>

                    <div>
                      {result.matchedClients.map((client) => (
                        <span key={client}>{client}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="analytics-findings">
                  <strong>Hallazgos verificables</strong>

                  {result.keyFindings.map((finding) => (
                    <div key={finding}>
                      <ShieldCheck size={15} />
                      <span>{finding}</span>
                    </div>
                  ))}
                </div>

                {result.dataLimitations.length > 0 && (
                  <div className="analytics-limitations">
                    <TriangleAlert size={17} />

                    <div>
                      <strong>Limitaciones de los datos</strong>

                      {result.dataLimitations.map(
                        (limitation) => (
                          <p key={limitation}>{limitation}</p>
                        ),
                      )}
                    </div>
                  </div>
                )}

                <div className="applied-filters">
                  <strong>Plan de consulta ejecutado</strong>

                  <div>
                    {result.appliedFilters.country && (
                      <span>
                        País: {result.appliedFilters.country}
                      </span>
                    )}

                    {result.appliedFilters.city && (
                      <span>
                        Ciudad: {result.appliedFilters.city}
                      </span>
                    )}

                    {result.appliedFilters.modality && (
                      <span>
                        Modalidad:{" "}
                        {result.appliedFilters.modality}
                      </span>
                    )}

                    {result.appliedFilters.brand && (
                      <span>
                        Marca: {result.appliedFilters.brand}
                      </span>
                    )}

                    {describeAgeFilter(
                      result.appliedFilters,
                    ) && (
                      <span>
                        Antigüedad:{" "}
                        {describeAgeFilter(
                          result.appliedFilters,
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {performance?.tokensPerSecond && (
                  <div className="analytics-performance">
                    Consulta interpretada localmente a{" "}
                    {performance.tokensPerSecond.toFixed(1)}{" "}
                    tokens/segundo
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}