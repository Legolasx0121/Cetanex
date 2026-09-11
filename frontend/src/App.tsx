import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CircleAlert,
  Database,
  Hospital,
  LayoutDashboard,
  Map,
  MessageSquareText,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import AnalyticsModal from "./components/AnalyticsModal";
import CaptureModal from "./components/CaptureModal";
import ClientsModal from "./components/ClientsModal";
import RegionalMapModal from "./components/RegionalMapModal";
import VerificationModal from "./components/VerificationModal";
import { useDashboard } from "./hooks/useDashboard";

function normalizeSearchValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function App() {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isClientsOpen, setIsClientsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isRegionalMapOpen, setIsRegionalMapOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    metrics,
    modalityData,
    observations,
    isLoading,
    refreshDashboard,
  } = useDashboard();

  const visibleObservations = useMemo(() => {
    const query = normalizeSearchValue(searchTerm.trim());

    if (!query) return observations;

    return observations.filter((item) =>
      [
        item.hospital,
        item.location,
        item.equipment,
        item.brand,
        item.age,
        item.status,
      ].some((value) => normalizeSearchValue(value).includes(query)),
    );
  }, [observations, searchTerm]);

  const dateLabel = new Intl.DateTimeFormat("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const renewalMessage =
    metrics.renewalOpportunities === 0
      ? "La base actual no presenta equipos que superen el umbral de renovación."
      : `Cetanex identificó ${metrics.renewalOpportunities} ${
          metrics.renewalOpportunities === 1
            ? "equipo con siete años o más"
            : "equipos con siete años o más"
        } para revisión comercial y técnica.`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">
            <Activity size={25} strokeWidth={2.3} />
          </div>
          <div className="brand-copy">
            <strong>Cetanex</strong>
            <span>Installed Intelligence</span>
          </div>
        </div>

        <nav className="navigation" aria-label="Navegación principal">
          <p className="nav-section-label">Operación</p>

          <button className="nav-item active" type="button">
            <span className="nav-icon"><LayoutDashboard size={18} /></span>
            <span className="nav-copy">
              <strong>Panorama</strong>
              <small>Visión ejecutiva</small>
            </span>
          </button>

          <button className="nav-item" type="button" onClick={() => setIsCaptureOpen(true)}>
            <span className="nav-icon"><MessageSquareText size={18} /></span>
            <span className="nav-copy">
              <strong>Capturar</strong>
              <small>Texto, voz o placa</small>
            </span>
          </button>

          <button className="nav-item" type="button" onClick={() => setIsClientsOpen(true)}>
            <span className="nav-icon"><Database size={18} /></span>
            <span className="nav-copy">
              <strong>Base instalada</strong>
              <small>Clientes y equipos</small>
            </span>
          </button>

          <p className="nav-section-label intelligence-label">Inteligencia</p>

          <button className="nav-item" type="button" onClick={() => setIsVerificationOpen(true)}>
            <span className="nav-icon"><CircleAlert size={18} /></span>
            <span className="nav-copy">
              <strong>Verificaciones</strong>
              <small>Calidad y evidencia</small>
            </span>
            <span className="nav-signal" aria-label="Requiere revisión" />
          </button>

          <button className="nav-item" type="button" onClick={() => setIsAnalyticsOpen(true)}>
            <span className="nav-icon"><Sparkles size={18} /></span>
            <span className="nav-copy">
              <strong>Consultar con IA</strong>
              <small>Analítica local</small>
            </span>
          </button>

          <button className="nav-item" type="button" onClick={() => setIsRegionalMapOpen(true)}>
            <span className="nav-icon"><Map size={18} /></span>
            <span className="nav-copy">
              <strong>Mapa nacional</strong>
              <small>Inteligencia territorial</small>
            </span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <section className="runtime-card" aria-label="Estado del procesamiento local">
          <div className="runtime-heading">
            <span className="runtime-shield"><ShieldCheck size={17} /></span>
            <div>
              <strong>Núcleo privado</strong>
              <small>Todos los motores activos</small>
            </div>
            <span className="runtime-online">LOCAL</span>
          </div>
          <div className="runtime-engines">
            <span><i /> QVAC</span>
            <span><i /> Whisper</span>
            <span><i /> OCR</span>
          </div>
        </section>

        <div className="profile">
          <div className="avatar">SR</div>
          <div>
            <strong>Sergio Rojas</strong>
            <span>Colaborador de campo</span>
          </div>
          <span className="profile-status" title="Sesión local activa" />
        </div>
      </aside>

      <main className="main-content">
        <div className="ambient-orb ambient-orb-one" />
        <div className="ambient-orb ambient-orb-two" />

        <header className="topbar">
          <div className="page-intro">
            <p className="eyebrow">CENTRO DE INTELIGENCIA INSTALADA</p>
            <div className="title-line">
              <h1>Buenos días, Sergio</h1>
              <span>{dateLabel}</span>
            </div>
            <p className="subtitle">Convierte cada visita de campo en una decisión confiable.</p>
          </div>

          <div className="top-actions">
            <label className="search" htmlFor="dashboard-search">
              <Search size={17} />
              <input
                id="dashboard-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente o equipo"
              />
              {searchTerm && <span className="search-count">{visibleObservations.length}</span>}
            </label>
            <div className="local-badge" title="La inferencia no utiliza la nube">
              <span className="status-dot" /> IA local activa
            </div>
            <button className="primary-button" type="button" onClick={() => setIsCaptureOpen(true)}>
              <Plus size={18} /> Nueva observación
            </button>
          </div>
        </header>

        <section className="command-hero">
          <div className="hero-grid-lines" />
          <div className="hero-copy">
            <div className="hero-status"><span /> Operación privada lista</div>
            <h2>De la visita al dato confiable, sin salir del dispositivo.</h2>
            <p>
              Captura lo observado, estructura la evidencia y descubre oportunidades
              comerciales incluso sin conexión a internet.
            </p>
            <div className="hero-actions">
              <button className="hero-primary" type="button" onClick={() => setIsCaptureOpen(true)}>
                <MessageSquareText size={18} /> Iniciar captura <ArrowRight size={16} />
              </button>
              <button className="hero-secondary" type="button" onClick={() => setIsRegionalMapOpen(true)}>
                <Map size={17} /> Explorar territorio
              </button>
            </div>
            <div className="hero-proofs">
              <span><ShieldCheck size={14} /> Sin nube</span>
              <span><Database size={14} /> SQLite local</span>
              <span><ScanLine size={14} /> Evidencia temporal</span>
            </div>
          </div>

          <div className="local-core" aria-label="Motores de inteligencia local activos">
            <div className="core-orbit core-orbit-outer" />
            <div className="core-orbit core-orbit-inner" />
            <div className="core-center">
              <BrainCircuit size={34} />
              <strong>QVAC</strong>
              <span>ON-DEVICE</span>
            </div>
            <div className="engine-chip engine-chip-llm">
              <Sparkles size={14} /><span><strong>LLM</strong><small>Estructura</small></span>
            </div>
            <div className="engine-chip engine-chip-voice">
              <Waves size={14} /><span><strong>VOICE</strong><small>Transcribe</small></span>
            </div>
            <div className="engine-chip engine-chip-ocr">
              <ScanLine size={14} /><span><strong>OCR</strong><small>Lee placas</small></span>
            </div>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Indicadores principales">
          <article className="metric-card metric-clients">
            <span className="metric-index">01</span>
            <div className="metric-topline"><div className="metric-icon blue"><Hospital size={20} /></div><span className="metric-label">Clientes registrados</span></div>
            <strong>{isLoading ? "—" : metrics.totalClients}</strong>
            <small>Perfiles consolidados localmente</small>
          </article>
          <article className="metric-card metric-equipment">
            <span className="metric-index">02</span>
            <div className="metric-topline"><div className="metric-icon cyan"><Database size={20} /></div><span className="metric-label">Equipos identificados</span></div>
            <strong>{isLoading ? "—" : metrics.totalEquipment}</strong>
            <small>Suma de cantidades registradas</small>
          </article>
          <article className="metric-card metric-renewal">
            <span className="metric-index">03</span>
            <div className="metric-topline"><div className="metric-icon amber"><RefreshCw size={20} /></div><span className="metric-label">Posibles renovaciones</span></div>
            <strong>{isLoading ? "—" : metrics.renewalOpportunities}</strong>
            <small>Equipos con siete años o más</small>
          </article>
          <article className="metric-card metric-confidence">
            <span className="metric-index">04</span>
            <div className="metric-topline"><div className="metric-icon green"><ShieldCheck size={20} /></div><span className="metric-label">Confianza promedio</span></div>
            <strong>{isLoading ? "—" : `${metrics.averageConfidence}%`}</strong>
            <small>Calidad de las observaciones</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">PORTAFOLIO TECNOLÓGICO</span>
                <h2>Equipos por modalidad</h2>
                <p>Distribución actual de la base instalada</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsClientsOpen(true)}>
                Ver base instalada <ArrowRight size={14} />
              </button>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modalityData} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="medicalBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1677ff" />
                      <stop offset="100%" stopColor="#17b8d4" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 7" vertical={false} stroke="#dfe8f4" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#60738f", fontSize: 11 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8a9ab1", fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(22, 119, 255, 0.045)" }}
                    contentStyle={{ border: "1px solid #dfe8f4", borderRadius: 13, boxShadow: "0 14px 35px rgba(7, 26, 69, .12)" }}
                  />
                  <Bar dataKey="cantidad" fill="url(#medicalBar)" radius={[9, 9, 3, 3]} maxBarSize={52} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel intelligence-panel">
            <div className="intelligence-glow" />
            <div className="intelligence-heading">
              <div className="ai-symbol"><Sparkles size={21} /></div>
              <div><span>CETANEX INTELLIGENCE</span><small>Hallazgo generado localmente</small></div>
            </div>
            <h2>{metrics.renewalOpportunities > 0 ? "Hay una oportunidad que merece atención." : "La base instalada está al día."}</h2>
            <p>{renewalMessage}</p>
            <div className="opportunity-score">
              <span>Equipos priorizados</span><strong>{metrics.renewalOpportunities}</strong>
            </div>
            <button className="insight-button" type="button" onClick={() => setIsAnalyticsOpen(true)}>
              Consultar la oportunidad <ArrowRight size={15} />
            </button>
            <div className="offline-note"><ShieldCheck size={16} /> Procesado sin enviar información a la nube</div>
          </article>
        </section>

        <section className="panel observations-panel">
          <div className="panel-heading observations-heading">
            <div>
              <span className="panel-kicker">ACTIVIDAD DE CAMPO</span>
              <h2>Observaciones recientes</h2>
              <p>Información capturada por los colaboradores</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => setIsClientsOpen(true)}>
              Ver inventario <ArrowRight size={14} />
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Cliente</th><th>Equipo</th><th>Marca</th><th>Antigüedad</th><th>Confianza</th><th>Estado</th></tr></thead>
              <tbody>
                {visibleObservations.map((item, index) => (
                  <tr key={`${item.hospital}-${item.equipment}-${index}`}>
                    <td><div className="client-cell"><div className="hospital-icon"><Hospital size={16} /></div><div><strong>{item.hospital}</strong><span>{item.location}</span></div></div></td>
                    <td><span className="equipment-name">{item.equipment}</span></td>
                    <td>{item.brand}</td>
                    <td>{item.age}</td>
                    <td><div className="confidence-cell"><div className="confidence-track"><span style={{ width: `${item.confidence}%` }} /></div><strong>{item.confidence}%</strong></div></td>
                    <td><span className={`status-badge ${item.status.toLowerCase()}`}><i /> {item.status}</span></td>
                  </tr>
                ))}
                {!isLoading && visibleObservations.length === 0 && (
                  <tr><td colSpan={6} className="empty-table"><Search size={22} /><strong>No encontramos coincidencias</strong><span>Prueba con otro cliente, equipo, marca o estado.</span></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="attention-banner">
          <div className="attention-icon"><CircleAlert size={20} /></div>
          <div>
            <span className="attention-kicker">CONTROL DE CALIDAD ACTIVO</span>
            <strong>Hay registros que pueden ganar mayor confianza.</strong>
            <p>Revisa datos faltantes, evidencia estimada y confirmaciones independientes desde una sola bandeja.</p>
          </div>
          <button type="button" onClick={() => setIsVerificationOpen(true)}>
            Abrir verificaciones <ArrowRight size={15} />
          </button>
        </section>
      </main>

      <CaptureModal isOpen={isCaptureOpen} onClose={() => { setIsCaptureOpen(false); void refreshDashboard(); }} />
      <ClientsModal isOpen={isClientsOpen} onClose={() => setIsClientsOpen(false)} />
      <AnalyticsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
      <RegionalMapModal isOpen={isRegionalMapOpen} onClose={() => setIsRegionalMapOpen(false)} />
      <VerificationModal isOpen={isVerificationOpen} onClose={() => setIsVerificationOpen(false)} />
    </div>
  );
}

export default App;
