import { NavLink, Route, Routes } from "react-router-dom";
import { Overview } from "./pages/Overview";
import { Assistant } from "./pages/Assistant";
import { CompanyIntel } from "./pages/CompanyIntel";
import { CustomerInsights } from "./pages/CustomerInsights";
import { Opportunities } from "./pages/Opportunities";
import { Roadmaps } from "./pages/Roadmaps";
import { Prds } from "./pages/Prds";
import { Strategy } from "./pages/Strategy";
import { Settings } from "./pages/Settings";
import { Scaffold, type ScaffoldId } from "./pages/Scaffold";
import { Card, EmptyState, PageHeader } from "./components/ui";
import { useStore } from "./lib/store";

type Status = "live" | "scaffold";

const NAV: Array<{ group: string; items: Array<{ to: string; label: string; status: Status }> }> = [
  {
    group: "Command",
    items: [
      { to: "/", label: "Overview", status: "live" },
      { to: "/assistant", label: "AI Product Manager", status: "live" },
    ],
  },
  {
    group: "Discovery",
    items: [
      { to: "/company", label: "Company Intelligence", status: "live" },
      { to: "/market", label: "Market Research", status: "scaffold" },
      { to: "/customers", label: "Customer Insights", status: "live" },
      { to: "/opportunities", label: "Opportunities", status: "live" },
    ],
  },
  {
    group: "Strategy & delivery",
    items: [
      { to: "/strategy", label: "Product Strategy", status: "live" },
      { to: "/roadmaps", label: "Roadmaps", status: "live" },
      { to: "/prds", label: "PRDs & Documentation", status: "live" },
      { to: "/design", label: "Design & Prototyping", status: "scaffold" },
      { to: "/engineering", label: "Engineering", status: "scaffold" },
    ],
  },
  {
    group: "Measurement",
    items: [
      { to: "/analytics", label: "Product Analytics", status: "scaffold" },
      { to: "/experiments", label: "Experiments", status: "scaffold" },
      { to: "/finance", label: "Business & Finance", status: "scaffold" },
      { to: "/reports", label: "Reports", status: "scaffold" },
    ],
  },
  {
    group: "Platform",
    items: [
      { to: "/integrations", label: "Integrations", status: "scaffold" },
      { to: "/agents", label: "Agent Management", status: "scaffold" },
      { to: "/settings", label: "Settings", status: "live" },
    ],
  },
];

const scaffoldRoute = (path: string, id: ScaffoldId) => (
  <Route path={path} element={<Scaffold id={id} />} />
);

export default function App() {
  const { storageError } = useStore();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">◆</span>
          <div>
            <div className="brand-name">AI Product Manager</div>
            <div className="brand-sub">Product command centre</div>
          </div>
        </div>
        <nav aria-label="Main">
          {NAV.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-label">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <span>{item.label}</span>
                  {item.status === "scaffold" && <span className="nav-tag">soon</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot small muted">Data is stored in this browser. Export regularly from Settings.</div>
      </aside>

      <main className="content">
        {storageError && <div className="notice notice-bad" role="alert">{storageError}</div>}
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/company" element={<CompanyIntel />} />
          <Route path="/customers" element={<CustomerInsights />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/strategy" element={<Strategy />} />
          <Route path="/roadmaps" element={<Roadmaps />} />
          <Route path="/prds" element={<Prds />} />
          <Route path="/settings" element={<Settings />} />
          {scaffoldRoute("/market", "market")}
          {scaffoldRoute("/design", "design")}
          {scaffoldRoute("/engineering", "engineering")}
          {scaffoldRoute("/analytics", "analytics")}
          {scaffoldRoute("/experiments", "experiments")}
          {scaffoldRoute("/finance", "finance")}
          {scaffoldRoute("/reports", "reports")}
          {scaffoldRoute("/integrations", "integrations")}
          {scaffoldRoute("/agents", "agents")}
          <Route
            path="*"
            element={
              <>
                <PageHeader title="Page not found" />
                <Card>
                  <EmptyState title="This page does not exist." />
                </Card>
              </>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
