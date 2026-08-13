import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Package as PackageIcon, KeyRound, Info, FileText,
  Plus, Trash2, RotateCcw, Search, Copy, Check, X, Ban, Smartphone,
  ChevronDown, ChevronUp, LogOut, Download, Book, ShieldAlert, Eye, EyeOff,
  MessageSquare, Send, Settings2, RefreshCw, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ============================================================
// API client — the web app only ever talks to the backend over
// these calls. It never touches a database directly and never
// holds DATABASE_URL / ADMIN_PASSWORD_HASH / SERVER_HMAC_SECRET.
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SESSION_KEY = "kdash_admin_token";
const SESSION_EXP_KEY = "kdash_admin_token_expires";

function getSession() {
  const token = localStorage.getItem(SESSION_KEY);
  const expiresAt = localStorage.getItem(SESSION_EXP_KEY);
  if (!token || !expiresAt) return null;
  if (new Date(expiresAt) <= new Date()) return null;
  return { token, expiresAt };
}
function setSession(token, expiresAt) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(SESSION_EXP_KEY, expiresAt);
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_EXP_KEY);
}

async function apiFetch(path, { method = "GET", body, params } = {}) {
  const session = getSession();
  const url = new URL(API_BASE + path);
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && url.searchParams.set(k, v));

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event("kdash:session-expired"));
    const err = new Error("session_expired");
    err.code = "session_expired";
    throw err;
  }

  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `http_${res.status}`);
    err.code = data?.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  login: (username, password) => apiFetch("/v1/admin/login", { method: "POST", body: { username, password } }),
  logout: () => apiFetch("/v1/admin/logout", { method: "POST" }),

  listPackages: () => apiFetch("/v1/admin/packages"),
  createPackage: (payload) => apiFetch("/v1/admin/packages", { method: "POST", body: payload }),
  updatePackage: (id, payload) => apiFetch(`/v1/admin/packages/${id}`, { method: "PUT", body: payload }),
  deletePackage: (id) => apiFetch(`/v1/admin/packages/${id}`, { method: "DELETE" }),
  resetPackageKeys: (id) => apiFetch(`/v1/admin/packages/${id}/reset-keys`, { method: "POST" }),
  deletePackageKeys: (id) => apiFetch(`/v1/admin/packages/${id}/keys`, { method: "DELETE" }),

  listKeys: (params) => apiFetch("/v1/admin/keys", { params }),
  createKey: (payload) => apiFetch("/v1/admin/keys", { method: "POST", body: payload }),
  revokeKey: (id) => apiFetch(`/v1/admin/keys/${id}/revoke`, { method: "POST" }),
  deleteKey: (id) => apiFetch(`/v1/admin/keys/${id}`, { method: "DELETE" }),
  purgeKeys: () => apiFetch("/v1/admin/keys/purge", { method: "POST" }),
  setKeyNote: (id, note) => apiFetch(`/v1/admin/keys/${id}/note`, { method: "PUT", body: { note } }),
  listKeyMessages: (id) => apiFetch(`/v1/admin/keys/${id}/messages`),
  sendKeyMessage: (id, text) => apiFetch(`/v1/admin/keys/${id}/messages`, { method: "POST", body: { text } }),

  listBannedDevices: () => apiFetch("/v1/admin/devices"),
  banDevice: (uid, label) => apiFetch("/v1/admin/devices/ban", { method: "POST", body: { uid, label } }),
  unbanDevice: (hash) => apiFetch(`/v1/admin/devices/${hash}`, { method: "DELETE" }),

  getStats: () => apiFetch("/v1/admin/stats"),
};

// ---------- helpers ----------
const fmtDate = (ts) => new Date(ts).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const DURATIONS = [
  { key: "1d", label: "1 ngày" },
  { key: "3d", label: "3 ngày" },
  { key: "7d", label: "7 ngày" },
  { key: "1th", label: "1 tháng" },
  { key: "3th", label: "3 tháng" },
  { key: "1nam", label: "1 năm" },
];

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Hết hạn", expired: true };
  const days = Math.floor(diff / (24 * 3600 * 1000));
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  if (days > 0) return { label: `còn ${days} ngày`, expired: false };
  return { label: `còn ${hours} giờ`, expired: false };
}

function errorMessage(err) {
  const map = {
    invalid_credentials: "Sai tài khoản hoặc mật khẩu",
    too_many_attempts: "Thử quá nhiều lần, vui lòng đợi một chút",
    session_expired: "Phiên đăng nhập đã hết hạn",
    name_required: "Vui lòng nhập tên package",
    invalid_input: "Dữ liệu không hợp lệ",
    not_found: "Không tìm thấy dữ liệu",
  };
  return map[err?.code] || map[err?.message] || "Đã có lỗi xảy ra, vui lòng thử lại";
}

// ---------- small UI atoms ----------
function Badge({ tone = "pink", children }) {
  const tones = {
    pink: "bg-pink-100 text-pink-700 border-pink-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function CopyField({ value, mono = true }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 text-xs transition ${mono ? "font-mono" : ""}`}
      title="Sao chép"
    >
      {value}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none">
      <span className="text-sm text-gray-700">{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={`rounded-full relative transition shrink-0 ${checked ? "bg-pink-500" : "bg-gray-200"}`}
        style={{ width: 40, height: 22 }}
      >
        <span
          className="absolute top-0.5 bg-white rounded-full shadow transition-all"
          style={{ width: 18, height: 18, left: checked ? 20 : 2, top: 2 }}
        />
      </span>
    </label>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls =
  "w-full px-3 py-2 rounded-lg border border-pink-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent placeholder:text-gray-400";

function Toast({ msg, tone = "dark", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, []);
  const tones = { dark: "bg-gray-900 text-white", error: "bg-rose-600 text-white" };
  return (
    <div className={`fixed bottom-5 right-5 z-50 text-sm px-4 py-2.5 rounded-lg shadow-lg ${tones[tone]}`}>{msg}</div>
  );
}

function Confirm({ title, desc, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-pink-100">
        <div className="flex items-center gap-2 text-rose-600 mb-2">
          <ShieldAlert size={18} />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">{desc}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Huỷ</button>
          <button onClick={onConfirm} className="px-3 py-1.5 rounded-lg text-sm bg-rose-500 text-white hover:bg-rose-600">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

function ReloadButton({ loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm border border-pink-200 text-pink-600 hover:bg-pink-50 disabled:opacity-50 px-3 py-2 rounded-xl"
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Tải lại
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-14 border-2 border-dashed border-pink-100 rounded-2xl">
      <KeyRound size={28} className="mx-auto text-pink-200 mb-3" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-700">{value}</p>
    </div>
  );
}

// ---------- Login ----------
function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass.trim()) {
      setErr("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const { token, expiresAt } = await api.login(user.trim(), pass);
      setSession(token, expiresAt);
      onLogin();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-pink-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-200">
            <KeyRound size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Key Server Console</h1>
          <p className="text-sm text-gray-400 mt-1">Quản lý package &amp; key phát triển</p>
        </div>
        <form onSubmit={submit} className="bg-white border border-pink-100 rounded-2xl p-6 shadow-xl shadow-pink-100/50">
          <Field label="Tài khoản">
            <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" autoComplete="username" />
          </Field>
          <Field label="Mật khẩu">
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                className={inputCls + " pr-9"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-2.5 text-gray-400">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          {err && <p className="text-xs text-rose-500 mb-2">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition shadow-md shadow-pink-200"
          >
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!getSession());
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const notify = (msg, tone = "dark") => setToast({ msg, tone });
  const notifyError = (err) => setToast({ msg: errorMessage(err), tone: "error" });

  useEffect(() => {
    const onExpired = () => setLoggedIn(false);
    window.addEventListener("kdash:session-expired", onExpired);
    return () => window.removeEventListener("kdash:session-expired", onExpired);
  }, []);

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  const nav = [
    { id: "dashboard", label: "Trang chủ", icon: LayoutDashboard },
    { id: "packages", label: "Quản lý Package", icon: PackageIcon },
    { id: "keys", label: "Quản lý Key", icon: KeyRound },
    { id: "usage", label: "Gói đang sử dụng", icon: Info },
    { id: "docs", label: "Tài liệu & Tích hợp", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-pink-50/40 flex text-gray-800">
      <aside className="w-60 shrink-0 bg-white border-r border-pink-100 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-pink-100">
          <div className="w-8 h-8 rounded-lg bg-pink-500 text-white flex items-center justify-center">
            <KeyRound size={16} />
          </div>
          <span className="font-bold text-gray-800 text-sm">Key Server</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active ? "bg-pink-500 text-white shadow-md shadow-pink-200" : "text-gray-500 hover:bg-pink-50 hover:text-pink-600"
                }`}
              >
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-pink-100">
          <button
            onClick={async () => {
              try { await api.logout(); } catch { /* best effort */ }
              clearSession();
              setLoggedIn(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 md:p-8">
        {tab === "dashboard" && <Dashboard notify={notify} notifyError={notifyError} />}
        {tab === "packages" && (
          <Packages notify={notify} notifyError={notifyError} confirmModal={confirmModal} setConfirmModal={setConfirmModal} goHome={() => setTab("dashboard")} />
        )}
        {tab === "keys" && (
          <Keys notify={notify} notifyError={notifyError} confirmModal={confirmModal} setConfirmModal={setConfirmModal} />
        )}
        {tab === "usage" && <UsageInfo notifyError={notifyError} />}
        {tab === "docs" && <Docs />}
      </main>

      {toast && <Toast msg={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
      {confirmModal && (
        <Confirm
          title={confirmModal.title}
          desc={confirmModal.desc}
          onCancel={() => setConfirmModal(null)}
          onConfirm={async () => {
            setConfirmModal(null);
            await confirmModal.onConfirm();
          }}
        />
      )}
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ notify, notifyError }) {
  const [stats, setStats] = useState(null);
  const [bannedDevices, setBannedDevices] = useState([]);
  const [deviceInput, setDeviceInput] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([api.getStats(), api.listBannedDevices()]);
      setStats(s);
      setBannedDevices(d);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const chartData = (stats?.usageByPackage || []).map((p) => ({
    name: p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name,
    "Đã sử dụng": p.used,
    "Còn lại": p.remaining,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Trang chủ</h1>
          <p className="text-sm text-gray-400">Thống kê lấy trực tiếp từ server</p>
        </div>
        <ReloadButton loading={loading} onClick={load} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Package" value={stats?.totalPackages ?? "—"} icon={PackageIcon} />
        <StatCard label="Tổng key" value={stats?.totalKeys ?? "—"} icon={KeyRound} />
        <StatCard label="Key bị ban" value={stats?.revokedKeys ?? "—"} icon={Ban} tone="rose" />
        <StatCard label="Thiết bị bị ban" value={stats?.bannedDevices ?? "—"} icon={Smartphone} tone="rose" />
      </div>

      <div className="bg-white border border-pink-100 rounded-2xl p-5 mb-6 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm">Sơ đồ lượt key đã sử dụng theo package</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Chưa có package nào để hiển thị.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#fbcfe8", fontSize: 12 }} />
                <Bar dataKey="Đã sử dụng" fill="#ec4899" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Còn lại" fill="#fbcfe8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white border border-pink-100 rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2">
          <Smartphone size={15} className="text-rose-500" /> Ban UID / thiết bị
        </h3>
        <p className="text-xs text-gray-400 mb-3">UID được băm (HMAC) trên server ngay khi ban — không lưu UID gốc.</p>
        <div className="flex gap-2 mb-3">
          <input
            value={deviceInput}
            onChange={(e) => setDeviceInput(e.target.value)}
            placeholder="Nhập UID thiết bị..."
            className={inputCls}
          />
          <button
            onClick={async () => {
              if (!deviceInput.trim()) return;
              try {
                await api.banDevice(deviceInput.trim());
                setDeviceInput("");
                notify("Đã ban thiết bị");
                load();
              } catch (e) {
                notifyError(e);
              }
            }}
            className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm shrink-0"
          >
            Ban
          </button>
        </div>
        {bannedDevices.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có thiết bị nào bị ban.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {bannedDevices.map((d) => (
              <div key={d.device_hash} className="flex items-center justify-between text-sm border border-rose-100 bg-rose-50/50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-mono text-xs text-rose-700">{d.device_hash.slice(0, 16)}…</span>
                  {d.device_label && <span className="text-xs text-gray-400 ml-2">{d.device_label}</span>}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.unbanDevice(d.device_hash);
                      notify("Đã bỏ ban thiết bị");
                      load();
                    } catch (e) {
                      notifyError(e);
                    }
                  }}
                  className="text-xs text-pink-600 hover:underline"
                >
                  Bỏ ban
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "pink" }) {
  const tones = { pink: "text-pink-500 bg-pink-50", rose: "text-rose-500 bg-rose-50" };
  return (
    <div className="bg-white border border-pink-100 rounded-2xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon size={17} />
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

// ---------- Packages ----------
const emptyForm = {
  name: "", description: "", key_name: "", version: "1.0.0",
  status: "active", allow_free_login: false, get_real_uid_ios: false,
  contact_link: "", update_link: "", notify_message: "",
};

function Packages({ notify, notifyError, setConfirmModal, goHome }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setPackages(await api.listPackages());
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };
  const startCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description, key_name: p.key_name, version: p.version,
      status: p.status, allow_free_login: p.allow_free_login, get_real_uid_ios: p.get_real_uid_ios,
      contact_link: p.contact_link, update_link: p.update_link, notify_message: p.notify_message,
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) { notify("Vui lòng nhập tên package", "error"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.updatePackage(editingId, form);
        notify("Đã lưu tuỳ chỉnh package");
        closeForm();
        await load();
        goHome();
      } else {
        await api.createPackage(form);
        notify("Đã tạo package");
        closeForm();
        await load();
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Package</h1>
          <p className="text-sm text-gray-400">Tạo và cấu hình các package dev cho ứng dụng của bạn</p>
        </div>
        <div className="flex items-center gap-2">
          <ReloadButton loading={loading} onClick={load} />
          <button
            onClick={() => (showForm ? closeForm() : startCreate())}
            className="flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-md shadow-pink-200"
          >
            <Plus size={16} /> Tạo package
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-pink-100 rounded-2xl p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-700 text-sm mb-4">
            {editingId ? "Tuỳ chỉnh thông tin package" : "Tạo package mới"}
          </h3>
          <div className="grid md:grid-cols-2 gap-x-6">
            <Field label="Tên package">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: App Pro Package" />
            </Field>
            <Field label="Tên key">
              <input className={inputCls} value={form.key_name} onChange={(e) => setForm({ ...form, key_name: e.target.value })} placeholder="VD: PRO-KEY" />
            </Field>
            <Field label="Mô tả">
              <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả package..." />
            </Field>
            <Field label="Version">
              <input className={inputCls} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
            </Field>
            <Field label="Trạng thái hoạt động">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Đang hoạt động</option>
                <option value="maintenance">Bảo trì</option>
              </select>
            </Field>
            <Field label="Link liên hệ">
              <input className={inputCls} value={form.contact_link} onChange={(e) => setForm({ ...form, contact_link: e.target.value })} placeholder="https://t.me/..." />
            </Field>
            <Field label="Link cập nhật app">
              <input className={inputCls} value={form.update_link} onChange={(e) => setForm({ ...form, update_link: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="Thông báo đến người dùng key">
              <input className={inputCls} value={form.notify_message} onChange={(e) => setForm({ ...form, notify_message: e.target.value })} placeholder="VD: Bảo trì từ 0h-2h..." />
            </Field>
          </div>
          <div className="border-t border-pink-100 mt-2 pt-2">
            <Toggle checked={form.allow_free_login} onChange={(v) => setForm({ ...form, allow_free_login: v })} label="Cho phép đăng nhập key miễn phí" />
            <Toggle checked={form.get_real_uid_ios} onChange={(v) => setForm({ ...form, get_real_uid_ios: v })} label="Lấy UID thật từ iOS" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Huỷ</button>
            <button onClick={submitForm} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-medium">
              {saving ? "Đang lưu..." : editingId ? "Hoàn thành" : "Tạo package"}
            </button>
          </div>
        </div>
      )}

      {!loading && packages.length === 0 ? (
        <EmptyState text="Chưa có package nào. Tạo package đầu tiên để bắt đầu." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {packages.map((p) => {
            const open = expanded === p.id;
            return (
              <div key={p.id} className="bg-white border border-pink-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="font-semibold text-gray-800">{p.name}</h3>
                    <p className="text-xs text-gray-400">Tạo ngày {fmtDate(p.created_at)}</p>
                  </div>
                  <Badge tone={p.status === "active" ? "green" : "amber"}>{p.status === "active" ? "Đang hoạt động" : "Bảo trì"}</Badge>
                </div>
                {p.description && <p className="text-sm text-gray-500 mb-3">{p.description}</p>}

                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge tone="gray">v{p.version}</Badge>
                  <Badge tone="pink">{p.key_count} key</Badge>
                  {p.allow_free_login && <Badge tone="gray">Free login</Badge>}
                  {p.get_real_uid_ios && <Badge tone="gray">UID iOS thật</Badge>}
                </div>

                <div className="text-xs text-gray-500 mb-1">API ID</div>
                <div className="mb-3"><CopyField value={p.api_id} /></div>

                <button
                  onClick={() => setExpanded(open ? null : p.id)}
                  className="text-xs text-pink-600 flex items-center gap-1 mb-3"
                >
                  Xem key của package này {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {open && <PackageKeyPreview packageId={p.id} notifyError={notifyError} />}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-pink-50">
                  <button
                    onClick={() => startEdit(p)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-pink-200 text-pink-600 hover:bg-pink-50"
                  >
                    <Settings2 size={12} /> Tuỳ chỉnh
                  </button>
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Reset tất cả key",
                        desc: `Đặt lại lượt dùng của toàn bộ key thuộc "${p.name}"?`,
                        onConfirm: async () => {
                          try {
                            await api.resetPackageKeys(p.id);
                            notify("Đã reset all key");
                          } catch (e) { notifyError(e); }
                        },
                      })
                    }
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-pink-200 text-pink-600 hover:bg-pink-50"
                  >
                    <RotateCcw size={12} /> Reset all key
                  </button>
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Xoá tất cả key",
                        desc: `Xoá toàn bộ key thuộc "${p.name}"? Hành động không thể hoàn tác.`,
                        onConfirm: async () => {
                          try {
                            await api.deletePackageKeys(p.id);
                            notify("Đã xoá all key của package");
                            load();
                          } catch (e) { notifyError(e); }
                        },
                      })
                    }
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={12} /> Xoá all key
                  </button>
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Xoá package",
                        desc: `Xoá package "${p.name}" và toàn bộ key liên quan?`,
                        onConfirm: async () => {
                          try {
                            await api.deletePackage(p.id);
                            notify("Đã xoá package");
                            load();
                          } catch (e) { notifyError(e); }
                        },
                      })
                    }
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 ml-auto"
                  >
                    <Trash2 size={12} /> Xoá package
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PackageKeyPreview({ packageId, notifyError }) {
  const [keys, setKeys] = useState(null);
  useEffect(() => {
    api.listKeys({ package_id: packageId }).then(setKeys).catch(notifyError);
  }, [packageId]);
  if (keys === null) return <p className="text-xs text-gray-400 mb-3">Đang tải...</p>;
  if (keys.length === 0) return <p className="text-xs text-gray-400 mb-3">Package này chưa có key nào.</p>;
  return (
    <div className="mb-3 space-y-1 max-h-32 overflow-auto">
      {keys.map((k) => (
        <div key={k.id} className="flex items-center justify-between text-xs bg-pink-50 rounded-md px-2 py-1">
          <span className="font-mono">{k.key_prefix}••••</span>
          <span className="text-gray-500">{k.device_bound ? "Đã gắn thiết bị" : "Chưa gắn thiết bị"}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Keys ----------
function Keys({ notify, notifyError, setConfirmModal }) {
  const [packages, setPackages] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pkgId, setPkgId] = useState("");
  const [duration, setDuration] = useState("7d");
  const [uses, setUses] = useState(1);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [newKey, setNewKey] = useState(null); // one-time plaintext reveal
  const [creating, setCreating] = useState(false);

  const loadPackages = async () => {
    try {
      const ps = await api.listPackages();
      setPackages(ps);
      if (!pkgId && ps.length) setPkgId(ps[0].id);
    } catch (e) { notifyError(e); }
  };
  const loadKeys = async () => {
    setLoading(true);
    try {
      setKeys(await api.listKeys({ search }));
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadPackages(); loadKeys(); }, []);
  useEffect(() => {
    const t = setTimeout(loadKeys, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const createKey = async () => {
    if (!pkgId) { notify("Vui lòng chọn package", "error"); return; }
    setCreating(true);
    try {
      const created = await api.createKey({ package_id: pkgId, duration, max_uses: uses });
      setNewKey(created);
      notify("Đã tạo key");
      loadKeys();
    } catch (e) {
      notifyError(e);
    } finally {
      setCreating(false);
    }
  };

  const detailKey = keys.find((k) => k.id === detailId) || null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Key</h1>
          <p className="text-sm text-gray-400">Key được tạo bằng crypto.randomBytes trên server</p>
        </div>
        <div className="flex items-center gap-2">
          <ReloadButton loading={loading} onClick={loadKeys} />
          <button
            onClick={() =>
              setConfirmModal({
                title: "Dọn key",
                desc: "Xoá toàn bộ key của tất cả package? Hành động không thể hoàn tác.",
                onConfirm: async () => {
                  try {
                    await api.purgeKeys();
                    notify("Đã dọn toàn bộ key");
                    loadKeys();
                  } catch (e) { notifyError(e); }
                },
              })
            }
            className="flex items-center gap-1.5 text-sm border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2.5 rounded-xl"
          >
            <Trash2 size={15} /> Dọn key
          </button>
        </div>
      </div>

      <div className="bg-white border border-pink-100 rounded-2xl p-5 mb-6 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm">Tạo key nhanh</h3>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <Field label="Chọn package">
            <select className={inputCls} value={pkgId} onChange={(e) => setPkgId(e.target.value)}>
              {packages.length === 0 && <option value="">-- Chưa có package --</option>}
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Lượt nhập key tuỳ chỉnh">
            <input type="number" min={1} className={inputCls} value={uses} onChange={(e) => setUses(e.target.value)} />
          </Field>
          <Field label="&nbsp;">
            <button
              onClick={createKey}
              disabled={creating}
              className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5"
            >
              <Plus size={15} /> {creating ? "Đang tạo..." : "Tạo key"}
            </button>
          </Field>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Thời hạn</label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDuration(d.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  duration === d.key ? "bg-pink-500 border-pink-500 text-white" : "border-pink-200 text-pink-600 hover:bg-pink-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-pink-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 text-sm">Danh sách key đã tạo ({keys.length})</h3>
          <div className="relative w-56">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên key..." className={inputCls + " pl-8"} />
          </div>
        </div>

        {!loading && keys.length === 0 ? (
          <EmptyState text="Không có key nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-pink-100">
                  <th className="py-2 pr-3 font-medium">Tên</th>
                  <th className="py-2 pr-3 font-medium">Key</th>
                  <th className="py-2 pr-3 font-medium">Package</th>
                  <th className="py-2 pr-3 font-medium">Lượt nhập</th>
                  <th className="py-2 pr-3 font-medium">Tạo ngày</th>
                  <th className="py-2 pr-3 font-medium">Thời hạn</th>
                  <th className="py-2 pr-3 font-medium">Trạng thái</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const tl = timeLeft(k.expires_at);
                  return (
                    <tr key={k.id} className="border-b border-pink-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-gray-700">{k.name}</td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-pink-50 border border-pink-200 text-pink-700 text-xs font-mono">
                          {k.key_prefix}•••• <span className="text-gray-400">(ẩn)</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500">{k.package_name}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{k.used_count}/{k.max_uses}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{fmtDate(k.created_at)}</td>
                      <td className="py-2.5 pr-3"><Badge tone={tl.expired ? "rose" : "gray"}>{tl.label}</Badge></td>
                      <td className="py-2.5 pr-3">
                        {k.revoked ? <Badge tone="rose">Đã ban</Badge> : <Badge tone="green">Hoạt động</Badge>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setDetailId(k.id)}
                            className="text-xs px-2 py-1 rounded-md border border-pink-200 text-pink-600 hover:bg-pink-50 flex items-center gap-1"
                          >
                            <Settings2 size={11} /> Chi tiết
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await api.revokeKey(k.id);
                                loadKeys();
                              } catch (e) { notifyError(e); }
                            }}
                            className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1"
                          >
                            <Ban size={11} /> {k.revoked ? "Bỏ ban" : "Ban"}
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                title: "Xoá key",
                                desc: `Xoá key "${k.name}"?`,
                                onConfirm: async () => {
                                  try {
                                    await api.deleteKey(k.id);
                                    loadKeys();
                                  } catch (e) { notifyError(e); }
                                },
                              })
                            }
                            className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {newKey && <NewKeyRevealModal keyData={newKey} onClose={() => setNewKey(null)} />}

      {detailKey && (
        <KeyDetailModal
          k={detailKey}
          onClose={() => setDetailId(null)}
          notify={notify}
          notifyError={notifyError}
        />
      )}
    </div>
  );
}

function NewKeyRevealModal({ keyData, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl border border-pink-100">
        <div className="flex items-center gap-2 text-pink-600 mb-2">
          <ShieldCheck size={18} />
          <h3 className="font-semibold">Key đã tạo — {keyData.name}</h3>
        </div>
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Đây là lần duy nhất key được hiển thị đầy đủ. Sau khi đóng, hệ thống chỉ còn giữ tiền tố ({keyData.key_prefix}••••) để nhận diện.
        </div>
        <div className="bg-gray-900 text-pink-100 font-mono text-sm rounded-xl p-4 break-all mb-4">{keyData.key}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(keyData.key).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-pink-200 text-pink-600 hover:bg-pink-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã sao chép" : "Sao chép"}
          </button>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm bg-pink-500 hover:bg-pink-600 text-white font-medium">
            Đã lưu, đóng lại
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyDetailModal({ k, onClose, notify, notifyError }) {
  const [note, setNote] = useState(k.note || "");
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const tl = timeLeft(k.expires_at);

  const loadMessages = async () => {
    setLoadingMsgs(true);
    try {
      setMessages(await api.listKeyMessages(k.id));
    } catch (e) { notifyError(e); } finally { setLoadingMsgs(false); }
  };
  useEffect(() => { loadMessages(); }, [k.id]);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-pink-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              {k.name}
              {k.revoked ? <Badge tone="rose">Đã ban</Badge> : <Badge tone={tl.expired ? "rose" : "green"}>{tl.expired ? "Hết hạn" : "Hoạt động"}</Badge>}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{k.package_name} · {k.key_prefix}••••</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <InfoRow label="Thiết bị" value={k.device_bound ? "Đã gắn" : "Chưa gắn"} />
            <InfoRow label="Lượt dùng" value={`${k.used_count}/${k.max_uses}`} />
            <InfoRow label="Tạo ngày" value={fmtDate(k.created_at)} />
            <InfoRow label="Hạn dùng" value={tl.label} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Thông tin tuỳ chỉnh cho key này</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="VD: khách VIP, ưu tiên hỗ trợ, ghi chú nội bộ..."
              className={inputCls + " resize-none"}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={async () => {
                  try {
                    await api.setKeyNote(k.id, note);
                    notify("Đã lưu thông tin tuỳ chỉnh");
                  } catch (e) { notifyError(e); }
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-pink-500 hover:bg-pink-600 text-white font-medium"
              >
                Lưu thông tin
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <MessageSquare size={13} /> Gửi tin nhắn đến người dùng key này
            </label>
            <div className="flex gap-2">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Nhập nội dung tin nhắn..."
                className={inputCls}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && msg.trim()) {
                    try {
                      await api.sendKeyMessage(k.id, msg.trim());
                      setMsg("");
                      loadMessages();
                    } catch (e2) { notifyError(e2); }
                  }
                }}
              />
              <button
                onClick={async () => {
                  if (!msg.trim()) return;
                  try {
                    await api.sendKeyMessage(k.id, msg.trim());
                    setMsg("");
                    notify("Đã gửi tin nhắn đến người dùng key");
                    loadMessages();
                  } catch (e) { notifyError(e); }
                }}
                className="px-3 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white shrink-0"
                title="Gửi"
              >
                <Send size={15} />
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-40 overflow-auto">
              {loadingMsgs ? (
                <p className="text-xs text-gray-400">Đang tải...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-gray-400">Chưa gửi tin nhắn nào đến key này.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="bg-pink-50 border border-pink-100 rounded-lg px-3 py-2">
                    <p className="text-sm text-pink-700">{m.text}</p>
                    <p className="text-[10px] text-pink-400 mt-0.5">{new Date(m.sent_at).toLocaleString("vi-VN")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Usage info ----------
function UsageInfo({ notifyError }) {
  const [packages, setPackages] = useState(null);

  useEffect(() => {
    api.listPackages().then(setPackages).catch(notifyError);
  }, []);

  if (packages === null) return <p className="text-sm text-gray-400">Đang tải...</p>;

  const activePackage = packages[0] || null;
  if (!activePackage) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Thông tin gói đang sử dụng</h1>
        <EmptyState text="Chưa có package nào được tạo." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Thông tin gói đang sử dụng</h1>
      <p className="text-sm text-gray-400 mb-6">Chi tiết package hiện đang hoạt động chính</p>

      <div className="bg-white border border-pink-100 rounded-2xl p-6 shadow-sm max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{activePackage.name}</h2>
          <Badge tone={activePackage.status === "active" ? "green" : "amber"}>
            {activePackage.status === "active" ? "Đang hoạt động" : "Bảo trì"}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mb-5">{activePackage.description || "Không có mô tả."}</p>

        <div className="grid grid-cols-2 gap-4 text-sm mb-5">
          <InfoRow label="Version" value={`v${activePackage.version}`} />
          <InfoRow label="Ngày tạo" value={fmtDate(activePackage.created_at)} />
          <InfoRow label="Tổng key" value={activePackage.key_count} />
          <InfoRow label="Free login" value={activePackage.allow_free_login ? "Bật" : "Tắt"} />
          <InfoRow label="UID thật từ iOS" value={activePackage.get_real_uid_ios ? "Bật" : "Tắt"} />
        </div>

        <div className="space-y-2">
          <div>
            <span className="text-xs text-gray-400">API ID</span>
            <div className="mt-1"><CopyField value={activePackage.api_id} /></div>
          </div>
          {activePackage.contact_link && (
            <div className="text-sm"><span className="text-gray-400">Liên hệ: </span><a className="text-pink-600 hover:underline" href={activePackage.contact_link}>{activePackage.contact_link}</a></div>
          )}
          {activePackage.update_link && (
            <div className="text-sm"><span className="text-gray-400">Cập nhật app: </span><a className="text-pink-600 hover:underline" href={activePackage.update_link}>{activePackage.update_link}</a></div>
          )}
          {activePackage.notify_message && (
            <div className="mt-3 text-sm bg-pink-50 border border-pink-100 rounded-lg px-3 py-2 text-pink-700">
              📢 {activePackage.notify_message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Docs ----------
function Docs() {
  const snippet = `POST ${API_BASE}/v1/verify
Content-Type: application/json

{
  "key": "<KEY_NGUOI_DUNG_NHAP>",
  "device_uid": "<UID_THIET_BI_THAT>"
}

Phan hoi:
  200 OK  -> key hop le, tra ve thong tin package + so luot con lai
  400     -> thieu key / thieu device_uid (khi package khong cho free login)
  403     -> key sai, het han, da bi revoke, thiet bi bi ban, hoac sai thiet bi da gan
  423     -> package dang bao tri
  429     -> goi qua nhieu lan trong 1 phut (rate limit)

Luu y: server kiem tra expiry, revoke, gan thiet bi (device binding) va gioi han
luot dung ngay trong request nay. Key va UID thiet bi khong bao gio duoc luu
o dang van ban thuong - chi luu ban bam HMAC-SHA256.`;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Tài liệu &amp; Tích hợp API</h1>
      <p className="text-sm text-gray-400 mb-6">Hai bước để gắn hệ thống key vào ứng dụng của bạn</p>

      <div className="space-y-5 max-w-3xl">
        <div className="bg-white border border-pink-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center font-semibold">1</span>
            <h3 className="font-semibold text-gray-700 text-sm">Download source API</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Toàn bộ mã nguồn server (Express + PostgreSQL) nằm trong thư mục <code className="bg-pink-50 px-1 rounded">server/</code> bạn đã tải cùng gói này.
          </p>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Download size={15} /> Xem README trong thư mục server/
          </a>
        </div>

        <div className="bg-white border border-pink-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center font-semibold">2</span>
            <h3 className="font-semibold text-gray-700 text-sm">Hướng dẫn gắn key vào app</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Gửi request xác thực mỗi khi người dùng nhập key trong app. Nếu package bật <span className="font-medium">"Lấy UID thật từ iOS"</span>,
            hãy đính kèm UID thiết bị thật lấy từ <code className="bg-pink-50 px-1 rounded">identifierForVendor</code> làm <code className="bg-pink-50 px-1 rounded">device_uid</code>.
          </p>
          <pre className="bg-gray-900 text-pink-100 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{snippet}</pre>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
            <Book size={13} /> Đây là endpoint công khai (không cần token admin) và có rate limit riêng.
          </div>
        </div>
      </div>
    </div>
  );
}
