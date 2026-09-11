import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  BrainCircuit,
  Camera,
  Check,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Sparkles,
  Square,
  ImageUp,
  X,
} from "lucide-react";
import "./CaptureModal.css";
import {
  startWavRecording,
  type WavRecorder,
} from "../utils/audioRecorder";

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

interface OcrResponse {
  success: boolean;
  processedLocally?: boolean;
  text?: string;
  blockCount?: number;
  error?: string;
  details?: string;
}

interface TranscriptionResponse {
  success: boolean;
  processedLocally: boolean;
  transcript?: string;
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
  const [isRecording, setIsRecording] = useState(false);
const [isTranscribing, setIsTranscribing] = useState(false);
const recorderRef = useRef<WavRecorder | null>(null);
const imageInputRef = useRef<HTMLInputElement | null>(null);
const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
const cameraStreamRef = useRef<MediaStream | null>(null);
const [isCameraOpen, setIsCameraOpen] = useState(false);
const [isReadingImage, setIsReadingImage] = useState(false);
const [ocrMessage, setOcrMessage] = useState("");

useEffect(() => {
  if (
    isCameraOpen &&
    cameraVideoRef.current &&
    cameraStreamRef.current
  ) {
    cameraVideoRef.current.srcObject = cameraStreamRef.current;
    void cameraVideoRef.current.play();
  }
}, [isCameraOpen]);

useEffect(() => {
  return () => {
    cameraStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
  };
}, []);

  if (!isOpen) return null;

  async function toggleVoiceRecording() {
  if (isRecording) {
    const recorder = recorderRef.current;

    recorderRef.current = null;
    setIsRecording(false);

    if (!recorder) return;

    setIsTranscribing(true);
    setError("");

    try {
      const audioBlob = await recorder.stop();

      const response = await fetch(
        "http://localhost:3001/api/transcribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
          },
          body: audioBlob,
        },
      );

      const payload: TranscriptionResponse =
        await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.details ||
            payload.error ||
            "No fue posible transcribir el audio.",
        );
      }

      const transcript = payload.transcript?.trim();

      if (!transcript) {
        throw new Error(
          "QVAC no detectó palabras en la grabación.",
        );
      }

      setObservation((currentObservation) => {
        const currentText = currentObservation.trim();

        return currentText
          ? `${currentText} ${transcript}`
          : transcript;
      });

      setResult(null);
      setSaved(false);
      setDuplicateMessage("");
    } catch (transcriptionError) {
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : "No fue posible procesar la grabación.",
      );
    } finally {
      setIsTranscribing(false);
    }

    return;
  }

  try {
    setError("");

    const recorder = await startWavRecording();

    recorderRef.current = recorder;
    setIsRecording(true);
  } catch {
    setError(
      "No fue posible acceder al micrófono. Revisa el permiso del navegador.",
    );
  }
}

async function processPlateImage(image: Blob) {
  setIsReadingImage(true);
  setError("");
  setOcrMessage("");
  setResult(null);
  setSaved(false);

  try {
    const response = await fetch("http://localhost:3001/api/ocr", {
      method: "POST",
      headers: {
        "Content-Type": image.type || "image/jpeg",
      },
      body: image,
    });

    const responseText = await response.text();

    let payload: OcrResponse;

    try {
      payload = JSON.parse(responseText) as OcrResponse;
    } catch {
      throw new Error(
        "El backend no devolvió una respuesta OCR válida.",
      );
    }

    if (!response.ok || !payload.success || !payload.text) {
      throw new Error(
        payload.details ||
          payload.error ||
          "No fue posible reconocer el texto de la placa.",
      );
    }

    setObservation((current) =>
      [
        current.trim(),
        `Información confirmada mediante fotografía de placa:\n${payload.text}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );

    setOcrMessage(
      `Placa leída localmente: ${payload.blockCount ?? 0} fragmentos identificados.`,
    );
  } catch (ocrError) {
    setError(
      ocrError instanceof Error
        ? ocrError.message
        : "No fue posible procesar la fotografía.",
    );
  } finally {
    setIsReadingImage(false);
  }
}

async function readPlateImage(event: ChangeEvent<HTMLInputElement>) {
  const image = event.target.files?.[0];

  if (!image) return;

  try {
    await processPlateImage(image);
  } finally {
    event.target.value = "";
  }
}

async function openCamera() {
  setError("");
  setOcrMessage("");

  if (!navigator.mediaDevices?.getUserMedia) {
    setError("Este navegador no permite acceder a la cámara.");
    return;
  }

  try {
    stopCamera();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment",
        },
        width: {
          ideal: 1920,
        },
        height: {
          ideal: 1080,
        },
      },
      audio: false,
    });

    cameraStreamRef.current = stream;
    setIsCameraOpen(true);
  } catch (cameraError) {
    setError(
      cameraError instanceof Error &&
        cameraError.name === "NotAllowedError"
        ? "Debes autorizar el acceso a la cámara."
        : "No fue posible abrir la cámara de este dispositivo.",
    );
  }
}


function stopCamera() {
  cameraStreamRef.current
    ?.getTracks()
    .forEach((track) => track.stop());

  cameraStreamRef.current = null;

  if (cameraVideoRef.current) {
    cameraVideoRef.current.srcObject = null;
  }

  setIsCameraOpen(false);
}

async function captureCameraImage() {
  const video = cameraVideoRef.current;

  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    setError("La cámara todavía se está preparando.");
    return;
  }

  try {
    const maximumWidth = 1600;
    const scale = Math.min(1, maximumWidth / video.videoWidth);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No fue posible preparar la fotografía.");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });

    stopCamera();

    if (!image) {
      throw new Error("No fue posible capturar la fotografía.");
    }

    await processPlateImage(image);
  } catch (captureError) {
    stopCamera();

    setError(
      captureError instanceof Error
        ? captureError.message
        : "No fue posible capturar la fotografía.",
    );
  }
}



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
    stopCamera()
    if (recorderRef.current) {
  const activeRecorder = recorderRef.current;
  recorderRef.current = null;

  void activeRecorder.stop().catch(() => {});
}

setIsRecording(false);
setIsTranscribing(false);
    setObservation("");
    setResult(null);
    setPerformance(null);
    setError("");
    setSaved(false);
    setDuplicateMessage("");
    setOcrMessage("");
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
                disabled={isAnalyzing || isRecording || isTranscribing}
              />
              {isRecording && (
  <div className="voice-feedback recording">
    <span />
    Grabando en el dispositivo... Presiona el botón para detener.
  </div>
)}

{isTranscribing && (
  <div className="voice-feedback">
    <LoaderCircle className="spinner" size={15} />
    Whisper está transcribiendo localmente...
  </div>
)}

              <button
  className={`voice-button${isRecording ? " recording" : ""}`}
  type="button"
  onClick={toggleVoiceRecording}
  disabled={isAnalyzing || isTranscribing}
  title={
    isRecording
      ? "Detener grabación"
      : "Dictar observación"
  }
  aria-label={
    isRecording
      ? "Detener grabación"
      : "Iniciar dictado por voz"
  }
>
  {isTranscribing ? (
    <LoaderCircle className="spinner" size={18} />
  ) : isRecording ? (
    <Square size={16} fill="currentColor" />
  ) : (
    <Mic size={18} />
  )}
</button>
            </div>
            <input
  ref={imageInputRef}
  className="plate-image-input"
  type="file"
  accept="image/jpeg,image/png,image/webp,image/bmp"
  onChange={readPlateImage}
/>

<div className="plate-capture-row">
  <div className="plate-action-buttons">
    <button
      className="plate-capture-button"
      type="button"
      onClick={() => void openCamera()}
      disabled={
        isAnalyzing ||
        isReadingImage ||
        isRecording ||
        isTranscribing ||
        isCameraOpen
      }
    >
      <Camera size={17} />
      Abrir cámara
    </button>

    <button
      className="plate-upload-button"
      type="button"
      onClick={() => imageInputRef.current?.click()}
      disabled={
        isAnalyzing ||
        isReadingImage ||
        isRecording ||
        isTranscribing ||
        isCameraOpen
      }
    >
      {isReadingImage ? (
        <LoaderCircle className="spinner" size={17} />
      ) : (
        <ImageUp size={17} />
      )}

      {isReadingImage ? "Leyendo placa..." : "Subir imagen"}
    </button>
  </div>

  <span>OCR local · La imagen no se guarda</span>
</div>

{isCameraOpen && (
  <div className="camera-preview-panel">
    <div className="camera-preview-frame">
      <video
        ref={cameraVideoRef}
        autoPlay
        playsInline
        muted
      />

      <div className="camera-guide">
        <span>Coloca la placa dentro del recuadro</span>
      </div>
    </div>

    <div className="camera-preview-actions">
      <button
        className="camera-cancel-button"
        type="button"
        onClick={stopCamera}
      >
        <X size={16} />
        Cancelar
     </button>

      <button
        className="camera-shot-button"
        type="button"
        onClick={() => void captureCameraImage()}
      >
        <Camera size={16} />
        Tomar fotografía
      </button>
    </div>
  </div>
)}

{ocrMessage && (
  <div className="ocr-success">
    <Check size={16} />
    {ocrMessage}
  </div>
)}
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