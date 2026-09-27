import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Bridge between the ZENITH mode-selection experience and the existing
 * FSOC Testbed dashboards. Both applications are now served by the same
 * Vite/React server and share one origin.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { mode?: string } | null;
    const mode = state?.mode;

    if (mode === "ground-space" || mode === "space-space") {
      navigate("/d2", {
        replace: true,
        state: { mode },
      });
      return;
    }

    // Ground-to-ground is Dashboard 1 and is the default.
    navigate("/d1", { replace: true });
  }, [location.state, navigate]);

  return (
    <div className="min-h-screen bg-[#05070c] flex items-center justify-center text-[#5cd8f0] font-mono text-sm">
      INITIALIZING FSOC TESTBED…
    </div>
  );
}
