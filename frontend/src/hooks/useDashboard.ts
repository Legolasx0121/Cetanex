import { useCallback, useEffect, useState } from "react";

interface DashboardMetrics {
  totalClients: number;
  totalEquipment: number;
  renewalOpportunities: number;
  averageConfidence: number;
}

interface ModalityData {
  name: string;
  cantidad: number;
}

interface RecentObservation {
  hospital: string;
  location: string;
  equipment: string;
  brand: string;
  age: string;
  confidence: number;
  status: string;
}

interface DashboardApiResponse {
  success: boolean;
  dashboard: {
    metrics: DashboardMetrics;
    modalities: ModalityData[];
    recentObservations: Array<{
      hospital: string;
      city: string | null;
      country: string | null;
      equipment: string;
      brand: string;
      age: string;
      confidence: number;
      status: string;
    }>;
  };
}

const emptyMetrics: DashboardMetrics = {
  totalClients: 0,
  totalEquipment: 0,
  renewalOpportunities: 0,
  averageConfidence: 0,
};

export function useDashboard() {
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [modalityData, setModalityData] = useState<ModalityData[]>([]);
  const [observations, setObservations] = useState<RecentObservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const refreshDashboard = useCallback(async () => {
    try {
      setDashboardError("");

      const response = await fetch("http://localhost:3001/api/dashboard");
      const payload: DashboardApiResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error("No fue posible cargar el dashboard.");
      }

      setMetrics(payload.dashboard.metrics);
      setModalityData(payload.dashboard.modalities);

      setObservations(
        payload.dashboard.recentObservations.map((observation) => ({
          hospital: observation.hospital,
          location:
            [observation.city, observation.country]
              .filter(Boolean)
              .join(", ") || "Ubicación no identificada",
          equipment: observation.equipment,
          brand: observation.brand,
          age: observation.age,
          confidence: observation.confidence,
          status: observation.status,
        })),
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el servidor local.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  return {
    metrics,
    modalityData,
    observations,
    isLoading,
    dashboardError,
    refreshDashboard,
  };
}