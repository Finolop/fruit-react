import React, { useEffect, useState } from "react";
import Header from "../../components/auth/Header";
import ForemanSummaryCards from "../../components/foreman/ForemanSummaryCards";
import GanttProgressCard from "../../components/foreman/GanttProgressCard";
import ScheduleSetupCard from "../../components/foreman/ScheduleSetupCard";
import ForemanAlertsCard from "../../components/foreman/ForemanAlertsCard";

import "../../styles/ForemanPage.css";

const CURRENT_PROJECT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

export interface LiveSummaryData {
  project_name: string;
  address?: string;
  current_stage: {
    name: string;
    days_remaining: number;
    progress_status: string;
  };
  alert_level: "GREEN" | "YELLOW" | "RED";
  special_status: "NONE" | "PURPLE" | "ORANGE";
  equipment_realtime: {
    required_total: number;
    detected_total: number;
    active_count: number;
    idle_count: number;
  };
  contract_days_total: number;
  contract_days_passed: number;
  progress_percent: number;
}

const ForemanPage: React.FC = () => {
  const [summary, setSummary] = useState<LiveSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLiveSummary = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${CURRENT_PROJECT_ID}/live-summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        setSummary({
          project_name: 'ЖК «Пресня-Сити», Корп. 2',
          address: "г. Москва, ул. Пресненский Вал, 21",
          current_stage: {
            name: "Разработка котлована (День 18 из 45)",
            days_remaining: 27,
            progress_status: "BEHIND_SCHEDULE",
          },
          alert_level: "YELLOW",
          special_status: "NONE",
          equipment_realtime: {
            required_total: 6,
            detected_total: 4,
            active_count: 2,
            idle_count: 2,
          },
          contract_days_total: 120,
          contract_days_passed: 18,
          progress_percent: 15.0,
        });
      }
    } catch {
      setSummary({
        project_name: 'ЖК «Пресня-Сити», Корп. 2',
        address: "г. Москва, ул. Пресненский Вал, 21",
        current_stage: {
          name: "Разработка котлована (День 18 из 45)",
          days_remaining: 27,
          progress_status: "BEHIND_SCHEDULE",
        },
        alert_level: "YELLOW",
        special_status: "NONE",
        equipment_realtime: {
          required_total: 6,
          detected_total: 4,
          active_count: 2,
          idle_count: 2,
        },
        contract_days_total: 120,
        contract_days_passed: 18,
        progress_percent: 15.0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSummary();
  }, []);

  return (
    <div className="foreman-page">
      <Header />

      <main className="foreman-content">
        <ForemanSummaryCards summary={summary} loading={loading} />

        <div className="foreman-layout">
          <section className="foreman-main-card">
            <GanttProgressCard summary={summary} />
            <ScheduleSetupCard
              projectId={CURRENT_PROJECT_ID}
              onScheduleUpdated={fetchLiveSummary}
            />
          </section>

          <aside className="foreman-sidebar">
            <ForemanAlertsCard
              projectId={CURRENT_PROJECT_ID}
              onAlertResolved={fetchLiveSummary}
            />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ForemanPage;