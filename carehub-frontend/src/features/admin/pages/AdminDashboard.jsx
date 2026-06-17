import React, { useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
} from "recharts";
import "../styles/AdminDashboard.css";
import AdminSidebar from "../components/AdminSidebar";
import AdminHeader from "../components/AdminHeader";

// ── Mock data ──────────────────────────────────────────────
const departmentData = [
    { name: "Khoa A", active: 45, inactive: 3 },
    { name: "Khoa B", active: 32, inactive: 4 },
    { name: "Khoa C", active: 58, inactive: 5 },
    { name: "Khoa D", active: 38, inactive: 2 },
    { name: "Khoa E", active: 18, inactive: 3 },
    { name: "Khoa F", active: 40, inactive: 4 },
];

const roleData = [
    { name: "User", value: 182 },
    { name: "Manager", value: 22 },
    { name: "Admin", value: 44 },
];

const importHistoryData = [
    { batch: "B1", success: 50, errors: 0 },
    { batch: "B2", success: 48, errors: 2 },
    { batch: "B3", success: 52, errors: 0 },
    { batch: "B4", success: 47, errors: 3 },
    { batch: "B5", success: 49, errors: 1 },
    { batch: "B6", success: 44, errors: 4 },
];

const recentActivity = [
    { id: 1, avatar: "NV", color: "#b0bec5", text: "NV-00142 logged in", time: "04/06 · 08:42", tag: "Login", tagColor: "#1976d2" },
    { id: 2, avatar: "NV", color: "#f9c74f", text: "Password reset · NV-00089", time: "04/06 · 08:35", tag: "Edit", tagColor: "#6c757d" },
    { id: 3, avatar: "NV", color: "#adb5bd", text: "Alert threshold updated", time: "04/06 · 08:10", tag: "Config", tagColor: "#495057" },
    { id: 4, avatar: "NV", color: "#80cbc4", text: "Employee import · 308/312 ok", time: "04/06 · 07:55", tag: "Partial", tagColor: "#e6a817" },
    { id: 5, avatar: "NV", color: "#ef9a9a", text: "NV-00089 logged out", time: "03/06 · 17:10", tag: "Logout", tagColor: "#c62828" },
];

const ROLE_COLORS = ["#1a3a6b", "#2e7d32", "#311b92"];

// ── Sub-components ─────────────────────────────────────────
function StatCard({ label, value, sub, subColor }) {
    return (
        <div className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {sub && <div className="stat-sub" style={{ color: subColor || "#555" }}>{sub}</div>}
        </div>
    );
}

function ImportStatusCard() {
    return (
        <div className="stat-card">
            <div className="stat-label">Import status</div>
            <span className="badge badge-partial">Partial</span>
            <div className="stat-sub" style={{ color: "#555", marginTop: 6 }}>4 row errors · 04/06</div>
        </div>
    );
}

function ActivityTag({ label, color }) {
    return (
        <span className="activity-tag" style={{ background: color }}>
            {label}
        </span>
    );
}

// ── Main component ─────────────────────────────────────────
export default function AdminDashboard() {
    const [syncing, setSyncing] = useState(false);

    const handleSync = () => {
        setSyncing(true);
        setTimeout(() => setSyncing(false), 1500);
    };

    return (
        <div className="dashboard-layout">
            <AdminSidebar />
            <div className="dashboard-layout__content">
                <AdminHeader title="Admin Dashboard" />
                <div className="dashboard-root">

                    {/* Scrollable body */}
                    <main className="dashboard-body">
                        {/* Page header */}
                        <div className="page-header">
                            <div>
                                <h1 className="page-title">System overview</h1>
                                <p className="page-sub">
                                    <span className="accent-bar" />
                                    Viet Duc Hospital · last updated 07:30
                                </p>
                            </div>
                            <div className="header-actions">
                                <button className="btn-secondary" onClick={handleSync} disabled={syncing}>
                                    {syncing ? "Syncing…" : "Sync now"}
                                </button>
                                <button className="btn-primary">Export report</button>
                            </div>
                        </div>

                        {/* KPI row 1 */}
                        <div className="kpi-grid">
                            <StatCard label="Total accounts" value="248" sub="+3  since last import" subColor="#555" />
                            <StatCard label="Active" value={<span style={{ color: "#1a7f37" }}>231</span>} sub="93.1% of total accounts" subColor="#555" />
                            <StatCard label="Inactive" value={<span style={{ color: "#cf1b1b" }}>17</span>} sub="+2  from last month" subColor="#555" />
                            <ImportStatusCard />
                        </div>

                        {/* KPI row 2 */}
                        <div className="kpi-grid">
                            <StatCard label="Departments" value="14" sub="Across 3 divisions" />
                            <StatCard label="Managers" value="22" sub="Avg 1.6 per dept" />
                            <StatCard label="Active checklists" value="11" sub="3 inactive" />
                            <StatCard
                                label="Logs today"
                                value="87"
                                sub={<><span style={{ color: "#cf1b1b" }}>−12</span>  vs yesterday</>}
                            />
                        </div>

                        {/* Charts row */}
                        <div className="charts-row">
                            {/* Bar chart – accounts by dept */}
                            <div className="chart-card wide">
                                <div className="chart-header">
                                    <div>
                                        <div className="chart-title">Accounts by department</div>
                                        <div className="chart-sub">Top 6 departments</div>
                                    </div>
                                    <div className="legend-row">
                                        <span className="legend-dot" style={{ background: "#1a3a6b" }} /> Active
                                        <span className="legend-dot" style={{ background: "#e57373", marginLeft: 12 }} /> Inactive
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={departmentData} barSize={32}>
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} />
                                        <Bar dataKey="active" stackId="a" fill="#1a3a6b" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="inactive" stackId="a" fill="#e57373" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Donut – role distribution */}
                            <div className="chart-card">
                                <div className="chart-header">
                                    <div>
                                        <div className="chart-title">Role distribution</div>
                                        <div className="chart-sub">248 accounts</div>
                                    </div>
                                </div>
                                <div className="legend-row" style={{ marginBottom: 8 }}>
                                    {roleData.map((r, i) => (
                                        <span key={r.name} style={{ marginRight: 10, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                            <span className="legend-dot" style={{ background: ROLE_COLORS[i] }} />
                                            {r.name} {r.value}
                                        </span>
                                    ))}
                                </div>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie
                                            data={roleData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={80}
                                            dataKey="value"
                                            startAngle={90}
                                            endAngle={-270}
                                        >
                                            {roleData.map((_, i) => (
                                                <Cell key={i} fill={ROLE_COLORS[i]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bottom row */}
                        <div className="charts-row">
                            {/* Import history */}
                            <div className="chart-card wide">
                                <div className="chart-header">
                                    <div>
                                        <div className="chart-title">Import history</div>
                                        <div className="chart-sub">Last 6 batches · rows processed</div>
                                    </div>
                                    <div className="legend-row">
                                        <span className="legend-dot" style={{ background: "#1a3a6b" }} /> Success
                                        <span className="legend-dot" style={{ background: "#e57373", marginLeft: 12 }} /> Errors
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={importHistoryData} barSize={36}>
                                        <XAxis dataKey="batch" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} />
                                        <Bar dataKey="success" stackId="a" fill="#1a3a6b" />
                                        <Bar dataKey="errors" stackId="a" fill="#e57373" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Recent activity */}
                            <div className="chart-card">
                                <div className="chart-title">Recent activity</div>
                                <div className="chart-sub" style={{ marginBottom: 12 }}>Last 5 audit events</div>
                                <ul className="activity-list">
                                    {recentActivity.map((item) => (
                                        <li key={item.id} className="activity-item">
                                            <div className="activity-avatar" style={{ background: item.color }}>
                                                {item.avatar}
                                            </div>
                                            <div className="activity-info">
                                                <div className="activity-text">{item.text}</div>
                                                <div className="activity-time">{item.time}</div>
                                            </div>
                                            <ActivityTag label={item.tag} color={item.tagColor} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>



    );
}