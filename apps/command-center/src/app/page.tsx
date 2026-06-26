"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:3333";

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceHealth {
  name: string;
  state: string;
  healthy: boolean;
  startedAt?: string;
  checkedAt: string;
}

interface KernelHealth {
  status: string;
  state: string;
  services: ServiceHealth[];
  startedAt?: string;
  checkedAt: string;
}

interface ProjectHealth {
  state: string;
  healthy: boolean;
  errorMessage?: string;
  lastCheckedAt: string;
}

interface ProjectRecord {
  config: { id: string; name: string; tier: string; port?: number };
  health: ProjectHealth;
  registeredAt: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  state: string;
}

interface AIOSEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  severity: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

interface SystemState {
  kernel: KernelHealth;
  projects: ProjectRecord[];
  agents: Agent[];
  recentEvents: AIOSEvent[];
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function eventColor(type: string): string {
  if (type.startsWith("kernel.")) return "#3b82f6";
  if (type.startsWith("agent.")) return "#a855f7";
  if (type.startsWith("policy.")) return "#f97316";
  if (type.startsWith("memory.")) return "#14b8a6";
  if (type.startsWith("monitoring.")) return "#6366f1";
  if (type.startsWith("project.")) return "#84cc16";
  return "#6b7280";
}

function stateColor(state: string): string {
  if (["running", "idle", "healthy", "active"].includes(state)) return "#22c55e";
  if (["error", "down", "blocked", "critical"].includes(state)) return "#ef4444";
  if (["thinking", "working", "booting", "degraded"].includes(state)) return "#eab308";
  if (["stopped", "offline"].includes(state)) return "#6b7280";
  return "#e2e2f0";
}

function dot(healthy: boolean) {
  return (
    <span style={{ color: healthy ? "#22c55e" : "#ef4444", marginRight: 6 }}>
      ●
    </span>
  );
}

// ── Uptime ────────────────────────────────────────────────────────────────────

function useUptime(startedAt?: string) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () =>
      setSecs(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#12121a",
        border: "1px solid #1e1e2e",
        borderRadius: 6,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#4a4a6a",
          textTransform: "uppercase",
          borderBottom: "1px solid #1e1e2e",
          paddingBottom: 8,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function KernelCard({ kernel }: { kernel: KernelHealth }) {
  const uptime = useUptime(kernel.startedAt);
  const healthyCount = kernel.services.filter((s) => s.healthy).length;
  return (
    <Card title="Kernel">
      <Row label="state">
        <Badge label={kernel.state} color={stateColor(kernel.state)} />
      </Row>
      <Row label="status">
        <Badge label={kernel.status} color={stateColor(kernel.status)} />
      </Row>
      <Row label="services">
        <span style={{ color: "#e2e2f0" }}>
          {healthyCount}/{kernel.services.length}
        </span>
      </Row>
      <Row label="uptime">
        <span style={{ color: "#e2e2f0" }}>{uptime}</span>
      </Row>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "#4a4a6a", fontSize: 12 }}>{label}</span>
      {children}
    </div>
  );
}

function ProjectsCard({ projects }: { projects: ProjectRecord[] }) {
  return (
    <Card title={`Projects (${projects.length})`}>
      {projects.length === 0 && (
        <span style={{ color: "#4a4a6a" }}>No projects registered</span>
      )}
      {projects.map((p) => (
        <div key={p.config.id}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#e2e2f0" }}>
              {dot(p.health.healthy)}
              {p.config.name}
            </span>
            <Badge label={p.health.state} color={stateColor(p.health.state)} />
          </div>
          <div style={{ marginLeft: 18, color: "#4a4a6a", fontSize: 11 }}>
            {p.config.id}
            {p.config.port && ` :${p.config.port}`}
            {p.health.errorMessage && (
              <span style={{ color: "#ef4444" }}> — {p.health.errorMessage}</span>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}

function AgentsCard({ agents }: { agents: Agent[] }) {
  return (
    <Card title={`Agents (${agents.length})`}>
      {agents.length === 0 && (
        <span style={{ color: "#4a4a6a" }}>No agents registered</span>
      )}
      {agents.map((a) => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#e2e2f0" }}>
            {a.name}
            <span style={{ color: "#4a4a6a", marginLeft: 6, fontSize: 11 }}>
              [{a.role}]
            </span>
          </span>
          <Badge label={a.state} color={stateColor(a.state)} />
        </div>
      ))}
    </Card>
  );
}

function EventRow({ event }: { event: AIOSEvent }) {
  const color = eventColor(event.type);
  const ts = new Date(event.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "3px 0",
        borderBottom: "1px solid #1e1e2e",
        alignItems: "center",
        fontSize: 12,
      }}
    >
      <span style={{ color: "#4a4a6a", flexShrink: 0, width: 80 }}>{ts}</span>
      <span style={{ color, flexShrink: 0, minWidth: 240 }}>{event.type}</span>
      <span
        style={{
          color: "#4a4a6a",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 11,
        }}
      >
        [{event.correlationId}]
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const [system, setSystem] = useState<SystemState | null>(null);
  const [liveEvents, setLiveEvents] = useState<AIOSEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Poll system state every 5 s
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/system/state`);
        const body = await res.json() as { ok: boolean; data: SystemState };
        if (body.ok) {
          setSystem(body.data);
          setError(null);
        }
      } catch {
        setError("Cannot reach API at " + API_BASE);
      }
    };
    void fetchState();
    const id = setInterval(() => void fetchState(), 5_000);
    return () => clearInterval(id);
  }, []);

  // SSE live event feed
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/events/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as AIOSEvent & { type: string };
        if (data.type === "heartbeat") return;
        setLiveEvents((prev) => [data, ...prev].slice(0, 50));
      } catch {
        // ignore malformed frames
      }
    };
    return () => es.close();
  }, []);

  const displayEvents = liveEvents.length > 0 ? liveEvents : (system?.recentEvents ?? []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#e2e2f0",
        padding: "0 0 40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #1e1e2e",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#12121a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.06em" }}>
            AIOS COMMAND CENTER
          </span>
          <span style={{ color: "#4a4a6a", fontSize: 12 }}>v1.9.0</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            style={{
              fontSize: 11,
              color: connected ? "#22c55e" : "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>{connected ? "●" : "○"}</span>
            <span>{connected ? "LIVE" : "DISCONNECTED"}</span>
          </span>
          {system && (
            <Badge
              label={system.kernel.status.toUpperCase()}
              color={stateColor(system.kernel.status)}
            />
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "#1a0808",
            border: "1px solid #ef444444",
            color: "#ef4444",
            padding: "8px 20px",
            fontSize: 12,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Top row: Kernel | Projects | Agents */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {system ? (
            <KernelCard kernel={system.kernel} />
          ) : (
            <Card title="Kernel">
              <span style={{ color: "#4a4a6a" }}>Connecting...</span>
            </Card>
          )}
          <ProjectsCard projects={system?.projects ?? []} />
          <AgentsCard agents={system?.agents ?? []} />
        </div>

        {/* Services row */}
        {system && (
          <Card title={`Services (${system.kernel.services.length})`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {system.kernel.services.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#0a0a0f",
                    border: "1px solid #1e1e2e",
                    borderRadius: 4,
                    padding: "5px 10px",
                  }}
                >
                  <span style={{ color: "#e2e2f0", fontSize: 12 }}>{s.name}</span>
                  <span style={{ color: s.healthy ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                    {s.healthy ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Live event feed */}
        <Card title={`Live Event Feed${connected ? " — LIVE" : " — POLLING"}`}>
          <div
            ref={feedRef}
            style={{
              maxHeight: 320,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {displayEvents.length === 0 && (
              <span style={{ color: "#4a4a6a" }}>Waiting for events...</span>
            )}
            {displayEvents.slice(0, 50).map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
