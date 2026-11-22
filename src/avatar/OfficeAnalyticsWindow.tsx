/**
 * OFFICE ANALYTICS WINDOW — Part 10. Every department's real status,
 * read live from the sources inside this app (gate log, Kiwix
 * catalog, Ollama, Khadija's store, the device registry). Finance
 * and Social Media have no in-app source and say UNAVAILABLE —
 * the truth rule: real data or an honest label, never invented
 * busyness.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getOperatorAccessToken } from "./trustedDevice";
import { getOfficeAnalytics, type OfficeAnalyticsView } from "./officeAnalytics.server";
import { departmentDef, type DepartmentStatus } from "./departments";

const STATUS_LABEL: Record<DepartmentStatus, string> = {
  working: "WORKING",
  problem: "PROBLEM",
  unavailable: "UNAVAILABLE",
};

export function OfficeAnalyticsWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<OfficeAnalyticsView | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const token = await getOperatorAccessToken();
    if (!token) {
      setError("No operator session — analytics stay closed.");
      return;
    }
    try {
      const result = await getOfficeAnalytics({ data: { accessToken: token } });
      if (!result.authorized) {
        setError("This session is not authorized for office analytics.");
        return;
      }
      setView(result);
    } catch {
      setError("Office analytics could not be gathered. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FloatingWindow
      id="office-analytics"
      title="Office Analytics — every department"
      onClose={onClose}
      initialWidth={620}
      initialHeight={560}
    >
      <div className="window-analytics">
        {error && (
          <p role="alert" className="window-analytics__error">
            {error}
          </p>
        )}
        {!view && !error && <p role="status">Gathering every department's real status…</p>}
        {view && (
          <>
            <p className="window-analytics__stamp">
              Read live at {new Date(view.generatedAt).toLocaleTimeString()} — from the sources
              inside this app only.
            </p>
            {view.departments.map((dept) => (
              <section key={dept.id} className="window-analytics__dept">
                <h3>
                  {dept.label}{" "}
                  <span className={`window-analytics__status is-${dept.status}`}>
                    {STATUS_LABEL[dept.status]}
                  </span>
                </h3>
                <p className="window-analytics__blurb">{departmentDef(dept.id).blurb}</p>
                <p>{dept.detail}</p>
                {dept.stats.length > 0 && (
                  <ul className="window-analytics__stats">
                    {dept.stats.map((stat) => (
                      <li key={stat.label}>
                        <strong>{stat.value}</strong> {stat.label}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <button type="button" className="window-btn" onClick={() => void load()}>
              Read again
            </button>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
