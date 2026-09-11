import { useState } from "react";
import {
  Activity,
  CircleAlert,
  Database,
  Hospital,
  LayoutDashboard,
  Map,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
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
import CaptureModal from "./components/CaptureModal";
import ClientsModal from "./components/ClientsModal";
import AnalyticsModal from "./components/AnalyticsModal";
import VerificationModal from "./components/VerificationModal";
import { useDashboard } from "./hooks/useDashboard";
import RegionalMapModal from "./components/RegionalMapModal";


function App() {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isClientsOpen, setIsClientsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isRegionalMapOpen, setIsRegionalMapOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] =
  useState(false);
  const {
    metrics,
    modalityData,
    observations,
    isLoading,
    refreshDashboard,
  } = useDashboard();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={24} />
          </div>
          <div>
            <strong>Cetanex</strong>
            <span>Installed Intelligence</span>
          </div>
        </div>

        <nav className="navigation">
          <button className="nav-item active">
            <LayoutDashboard size={19} />
            Panorama
          </button>
          <button
  className="nav-item"
  onClick={() => setIsCaptureOpen(true)}
>
  <MessageSquareText size={19} />
  Capturar observación
</button>
          
          <button
            className="nav-item"
            onClick={() => setIsClientsOpen(true)}
          >
            <Database size={19} />
            Base instalada
          </button>

          <button
  className="nav-item"
  onClick={() => setIsVerificationOpen(true)}
>
  <CircleAlert size={19} />
  Verificaciones
</button>

          <button
            className="nav-item"
            onClick={() => setIsAnalyticsOpen(true)}
          >
            <Sparkles size={19} />
            Consultar con IA
          </button>
          <button
  className="nav-item"
  onClick={() => setIsRegionalMapOpen(true)}
>
  <Map size={19} />
  Mapa regional
</button>
        </nav>

        <div className="privacy-card">
          <ShieldCheck size={22} />
          <div>
            <strong>Privacidad protegida</strong>
            <p>La inferencia se ejecuta localmente con QVAC.</p>
          </div>
        </div>

        <div className="profile">
          <div className="avatar">SR</div>
          <div>
            <strong>Sergio Rojas</strong>
            <span>Colaborador de campo</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">INTELIGENCIA DE BASE INSTALADA</p>
            <h1>Buenos días, Sergio</h1>
            <p className="subtitle">
              Convierte observaciones de campo en decisiones confiables.
            </p>
          </div>

          <div className="top-actions">
            <div className="search">
              <Search size={18} />
              <input placeholder="Buscar cliente o equipo..." />
            </div>
            <div className="local-badge">
              <span className="status-dot" />
              IA local activa
            </div>
            <button
              className="primary-button"
              onClick={() => setIsCaptureOpen(true)}
            >
              <Plus size={18} />
              Nueva observación
            </button>
          </div>
        </header>

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-icon blue">
              <Hospital size={21} />
            </div>
            <div>
              <span>Clientes registrados</span>
              <strong>{isLoading ? "—" : metrics.totalClients}</strong>
              <small>Datos guardados localmente</small>
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-icon purple">
              <Database size={21} />
            </div>
            <div>
              <span>Equipos identificados</span>
              <strong>{isLoading ? "—" : metrics.totalEquipment}</strong>
              <small>Suma de cantidades registradas</small>
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-icon amber">
              <RefreshCw size={21} />
            </div>
            <div>
              <span>Oportunidades de renovación</span>
              <strong>{isLoading ? "—" : metrics.renewalOpportunities}</strong>
              <small>Equipos con 7 años o más</small>
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-icon green">
              <ShieldCheck size={21} />
            </div>
            <div>
              <span>Confianza promedio</span>
              <strong>
                {isLoading ? "—" : `${metrics.averageConfidence}%`}
              </strong>
              <small>Promedio de las observaciones</small>
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>Equipos por modalidad</h2>
                <p>Distribución actual de la base instalada</p>
              </div>
              <button className="ghost-button">Ver detalles</button>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modalityData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e8edf4"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#667085", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#667085", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f5f7fb" }}
                    contentStyle={{
                      border: "none",
                      borderRadius: 12,
                      boxShadow: "0 10px 30px rgba(16,24,40,.12)",
                    }}
                  />
                  <Bar
                    dataKey="cantidad"
                    fill="#635bff"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel intelligence-panel">
            <div className="ai-symbol">
              <Sparkles size={25} />
            </div>
            <p className="eyebrow">CETANEX INTELLIGENCE</p>
            <h2>La IA encontró una oportunidad</h2>
            <p>
  Cetanex identificó{" "}
  {metrics.renewalOpportunities}{" "}
  {metrics.renewalOpportunities === 1
    ? "equipo con siete años o más"
    : "equipos con siete años o más"}
  . Puede priorizarse para una revisión comercial y técnica.
</p>
            <button
            className="insight-button"
            onClick={() => setIsAnalyticsOpen(true)}
          >
            Explorar oportunidad
          </button>

            <div className="offline-note">
              <ShieldCheck size={17} />
              Resultado procesado sin enviar datos a la nube
            </div>
          </article>
        </section>

        <section className="panel observations-panel">
          <div className="panel-heading">
            <div>
              <h2>Observaciones recientes</h2>
              <p>Información capturada por colaboradores de campo</p>
            </div>
            <button className="ghost-button">Ver todas</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Equipo</th>
                  <th>Marca</th>
                  <th>Antigüedad</th>
                  <th>Confianza</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((item) => (
                  <tr key={`${item.hospital}-${item.equipment}`}>
                    <td>
                      <div className="client-cell">
                        <div className="hospital-icon">
                          <Hospital size={17} />
                        </div>
                        <div>
                          <strong>{item.hospital}</strong>
                          <span>{item.location}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.equipment}</td>
                    <td>{item.brand}</td>
                    <td>{item.age}</td>
                    <td>
                      <div className="confidence-cell">
                        <div className="confidence-track">
                          <span style={{ width: `${item.confidence}%` }} />
                        </div>
                        {item.confidence}%
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="attention-banner">
          <CircleAlert size={20} />
          <div>
            <strong>3 observaciones necesitan información adicional</strong>
            <span>
              Cetanex preparó preguntas para aumentar su nivel de confianza.
            </span>
          </div>
          <button onClick={() => setIsVerificationOpen(true)}>
  Revisar ahora
</button>
        </div>
      </main>
      <CaptureModal
        isOpen={isCaptureOpen}
        onClose={() => {
          setIsCaptureOpen(false);
          void refreshDashboard();
        }}
      />
      <ClientsModal
        isOpen={isClientsOpen}
        onClose={() => setIsClientsOpen(false)}
      />

      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />

      <RegionalMapModal
  isOpen={isRegionalMapOpen}
  onClose={() => setIsRegionalMapOpen(false)}
/>

      <VerificationModal
  isOpen={isVerificationOpen}
  onClose={() => setIsVerificationOpen(false)}
/>
    </div>
  );
}

export default App;