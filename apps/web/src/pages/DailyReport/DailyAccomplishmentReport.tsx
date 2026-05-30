// apps/web/src/pages/DailyReport/DailyAccomplishmentReport.tsx
import { useState, useCallback, useEffect } from "react";

import {
  Clock, CheckCircle, AlertTriangle, Lock,
  Plus, Send, Eye, X, FileText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkArrangement = "On-site" | "Remote" | "Hybrid";
type StandupAttended = "Yes" | "No" | "N/A";
type Reachable = "Yes" | "Partial" | "No";
type TaskStatus = "" | "done" | "ip" | "blocked" | "todo";
type Priority = "" | "High" | "Medium" | "Low";
type TaskType = "" | "Development" | "Bug Fix" | "Testing" | "Review" | "Documentation" | "Meeting" | "Research";

interface TaskRow {
  id: number;
  carryOver: "" | "Yes" | "No";
  priority: Priority;
  taskType: TaskType;
  ticketRef: string;
  description: string;
  module: string;
  status: TaskStatus;
  percentDone: string;
  estHrs: string;
  actualHrs: string;
  output: string;
  commitLink: string;
  remarks: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createEmptyTask(id: number): TaskRow {
  return { id, carryOver: "", priority: "", taskType: "", ticketRef: "", description: "", module: "", status: "", percentDone: "", estHrs: "", actualHrs: "", output: "", commitLink: "", remarks: "" };
}

function calcHours(timeIn: string, timeOut: string, breakMins: number) {
  if (!timeIn || !timeOut) return { gross: "", net: "" };
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  const grossMins = oh * 60 + om - (ih * 60 + im);
  if (grossMins <= 0) return { gross: "", net: "" };
  const netMins = grossMins - breakMins;
  const fmt = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
  return { gross: fmt(grossMins), net: netMins > 0 ? fmt(netMins) : "0h 0m" };
}

function to24Hour(time: string): string {
  if (!time || time === "-") return "";
  const trimmed = time.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${mins}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RadioPills<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mt-1">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            value === opt
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-gray-200 text-gray-600 hover:border-emerald-400 hover:bg-emerald-50"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ num, title, amber, children, delay = 0, action }: { num: number; title: string; amber?: boolean; children: React.ReactNode; delay?: number; action?: React.ReactNode }) {
  return (
    <div className={`pro-card overflow-hidden animate-fade-in-up ${amber ? "border-l-4 border-l-amber-400" : ""}`} style={{ animationDelay: `${delay}s`, opacity: 0 }}>
      <div className={`flex items-center justify-between px-6 py-3 border-b border-gray-100 ${amber ? "bg-amber-50" : "bg-gray-50"}`}>
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ${amber ? "bg-amber-500" : "bg-emerald-600"}`}>
            {num}
          </span>
          <span className={`text-xs font-bold uppercase tracking-widest ${amber ? "text-amber-800" : "text-emerald-800"}`}>
            {title}
          </span>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children, col2 }: { label: string; hint?: string; children: React.ReactNode; col2?: boolean }) {
  return (
    <div className={col2 ? "col-span-2" : ""}>
      <label className="pro-label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyAccomplishmentReport() {
  const today = new Date().toISOString().split("T")[0];

  // ── State ──

  const [devName, setDevName] = useState("");
  const [date, setDate] = useState(today);
  const [workArr, setWorkArr] = useState<WorkArrangement>("On-site");
  const [project, setProject] = useState("");
  const [sprint, setSprint] = useState("");
  const [team, setTeam] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");

  const [timeIn, setTimeIn] = useState("08:00");
  const [timeOut, setTimeOut] = useState("17:00");
  const [breakMins, setBreakMins] = useState(60);
  const [subTime, setSubTime] = useState("");

  const [standup, setStandup] = useState<StandupAttended>("Yes");
  const [reachable, setReachable] = useState<Reachable>("Yes");
  const [avgResponse, setAvgResponse] = useState("");
  const [connIssues, setConnIssues] = useState("");
  const [collabLog, setCollabLog] = useState("");

  const [tasks, setTasks] = useState<TaskRow[]>(() => [createEmptyTask(1)]);
  const [devHrs, setDevHrs] = useState("");
  const [meetingHrs, setMeetingHrs] = useState("");
  const [idleHrs, setIdleHrs] = useState("");

  const [keyAccomp, setKeyAccomp] = useState("");
  const [blockers, setBlockers] = useState("");
  const [risks, setRisks] = useState("");
  const [planTmr, setPlanTmr] = useState("");
  const [escalation, setEscalation] = useState("");

  const [checklist, setChecklist] = useState<boolean[]>(Array(6).fill(false));
  const [tmrArr, setTmrArr] = useState<WorkArrangement>("On-site");
  const [tmrTimeIn, setTmrTimeIn] = useState("08:00");
  const [leaveNotice, setLeaveNotice] = useState("");

  const [preparedBy, setPreparedBy] = useState("");
  const [preparedSig, setPreparedSig] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState(today);

  const [showPreview, setShowPreview] = useState(false);

  // ─── Auto-fetch Time In / Time Out from Attendance Log ────────────────
  const fetchAttendanceTime = useCallback(() => {
    try {
      const saved = localStorage.getItem("attendance_logs");
      if (!saved) return;

      const logs: Array<{ timeIn?: string; timeOut?: string; status?: string; date?: string }> =
        JSON.parse(saved);
      if (!Array.isArray(logs) || logs.length === 0) return;

      const match =
        logs.find((l) => l.date === date) ?? logs[logs.length - 1];

      if (!match) return;

      if (match.timeIn && match.timeIn !== "-") {
        const converted = to24Hour(match.timeIn);
        if (converted) setTimeIn(converted);
      }

      if (match.timeOut && match.timeOut !== "-") {
        const converted = to24Hour(match.timeOut);
        if (converted) setTimeOut(converted);
      }
    } catch {
      // Silently ignore parse errors
    }
  }, [date]);

  useEffect(() => {
    fetchAttendanceTime();

    const handleStorage = () => fetchAttendanceTime();
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(fetchAttendanceTime, 3000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [fetchAttendanceTime]);

  // ── Computed ──

  const { gross, net } = calcHours(timeIn, timeOut, breakMins);

  const tasksDone    = tasks.filter(t => t.status === "done").length;
  const tasksIP      = tasks.filter(t => t.status === "ip").length;
  const tasksBlocked = tasks.filter(t => t.status === "blocked").length;
  const tasksCarry   = tasks.filter(t => t.carryOver === "Yes").length;
  const totalActual  = tasks.reduce((s, t) => s + (parseFloat(t.actualHrs) || 0), 0);
  const totalEst     = tasks.reduce((s, t) => s + (parseFloat(t.estHrs) || 0), 0);
  const variance     = totalActual - totalEst;
  const checkCount   = checklist.filter(Boolean).length;
  const checkPct     = Math.round((checkCount / 6) * 100);

  const updateTask = useCallback((id: number, field: keyof TaskRow, value: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }, []);

  const addRow = () => setTasks(prev => [...prev, createEmptyTask(prev.length + 1)]);
  const deleteRow = (id: number) => setTasks(prev => prev.filter(t => t.id !== id));

  const toggleCheck = (i: number) => setChecklist(prev => prev.map((v, idx) => idx === i ? !v : v));

  const handleSubmit = async () => {
    try {
      await fetch("http://localhost:5169/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devName, date, workArr, project, sprint, team, submittedTo, timeIn, timeOut, breakMins, tasks, checklist }),
      });
      alert("Report submitted successfully!");
    } catch {
      alert("Could not reach server. Check your connection.");
    }
  };

  const checklistItems = [
    "All code committed & pushed to repository",
    "Tickets / task board updated with current status",
    "Pull request(s) created or reviewed",
    "Documentation updated (if applicable)",
    "Tests passing / QA completed",
    "Daily report submitted on time",
  ];

  const statusBadge: Record<string, string> = {
    done: "badge-success", ip: "badge-warning", blocked: "badge-danger", todo: "badge-neutral",
  };

  const statusLabel: Record<string, string> = {
    done: "Done", ip: "In Progress", blocked: "Blocked", todo: "To Do",
  };

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="page-header animate-fade-in-up">
        <h1>Daily Accomplishment Report</h1>
        <p>Software Development — Individual Submission. Submit before end of work day.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tasks Done",    value: tasksDone,                  icon: CheckCircle, gradient: "linear-gradient(135deg, #059669, #10b981)" },
          { label: "Actual Hours",  value: totalActual.toFixed(1)+"h", icon: Clock,        gradient: "linear-gradient(135deg, #6366f1, #818cf8)" },
          { label: "Blocked",       value: tasksBlocked,               icon: AlertTriangle,gradient: "linear-gradient(135deg, #dc2626, #ef4444)" },
          { label: "Checklist",     value: `${checkCount}/6`,          icon: Lock,         gradient: "linear-gradient(135deg, #0891b2, #22d3ee)" },
        ].map((card, i) => (
          <div key={card.label} className="stat-card animate-fade-in-up" style={{ background: card.gradient, animationDelay: `${i * 0.1}s`, opacity: 0 }}>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="stat-label">{card.label}</p>
                <p className="stat-value">{card.value}</p>
              </div>
              <div className="stat-icon"><card.icon className="w-5 h-5" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 1: Developer Info */}
      <SectionCard num={1} title="Developer Information" delay={0.1}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Developer Name">
            <input className="pro-input" type="text" placeholder="Enter full name" value={devName} onChange={e => setDevName(e.target.value)} />
          </Field>
          <Field label="Date">
            <input className="pro-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Work Arrangement">
            <RadioPills options={["On-site","Remote","Hybrid"] as WorkArrangement[]} value={workArr} onChange={setWorkArr} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <Field label="Project / System">
            <input className="pro-input" type="text" placeholder="e.g. SIMPLEVIA HRIS" value={project} onChange={e => setProject(e.target.value)} />
          </Field>
          <Field label="Sprint / Iteration">
            <input className="pro-input" type="text" placeholder="e.g. Sprint 14" value={sprint} onChange={e => setSprint(e.target.value)} />
          </Field>
          <Field label="Team / Unit">
            <input className="pro-input" type="text" placeholder="e.g. Backend Team" value={team} onChange={e => setTeam(e.target.value)} />
          </Field>
          <Field label="Submitted To">
            <input className="pro-input" type="text" placeholder="Supervisor name" value={submittedTo} onChange={e => setSubmittedTo(e.target.value)} />
          </Field>
        </div>

        {/* Time In / Time Out */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <Field label="Time In">
            <input
              className="pro-input"
              type="text"
              placeholder="e.g. 08:00 AM"
              value={timeIn}
              onChange={e => setTimeIn(e.target.value)}
            />
          </Field>

          <Field label="Time Out">
            <input
              className="pro-input"
              type="text"
              placeholder="e.g. 05:00 PM"
              value={timeOut}
              onChange={e => setTimeOut(e.target.value)}
            />
          </Field>

          <Field label="Break Duration (mins)">
            <input className="pro-input" type="number" min={0} value={breakMins} onChange={e => setBreakMins(parseInt(e.target.value) || 0)} />
          </Field>

          <Field label="Submission Time" hint="Record exact time of submission">
            <input className="pro-input" type="text" placeholder="e.g. 5:15 PM" value={subTime} onChange={e => setSubTime(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Gross Duration">
            <input className="pro-input bg-gray-50" type="text" readOnly value={gross} placeholder="Auto-calculated" />
          </Field>
          <Field label="Net Productive Hours">
            <input className="pro-input bg-emerald-50 text-emerald-700 font-semibold" type="text" readOnly value={net} placeholder="Auto-calculated" />
          </Field>
        </div>
      </SectionCard>

      {/* Section 2: Availability */}
      <SectionCard num={2} title="Availability & Connectivity" delay={0.2}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Attended Standup?">
            <RadioPills options={["Yes","No","N/A"] as StandupAttended[]} value={standup} onChange={setStandup} />
          </Field>
          <Field label="Reachable via Comms?">
            <RadioPills options={["Yes","Partial","No"] as Reachable[]} value={reachable} onChange={setReachable} />
          </Field>
          <Field label="Avg Response Time">
            <input className="pro-input" type="text" placeholder="e.g. <5 minutes" value={avgResponse} onChange={e => setAvgResponse(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Connectivity / Environment Issues">
            <textarea className="pro-input resize-none" rows={3} placeholder="Describe any technical or connectivity issues…" value={connIssues} onChange={e => setConnIssues(e.target.value)} />
          </Field>
          <Field label="Collaboration Log">
            <textarea className="pro-input resize-none" rows={3} placeholder="Who you worked with today and on what…" value={collabLog} onChange={e => setCollabLog(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* Section 3: Tasks */}
      <SectionCard num={3} title="Tasks & Activities" delay={0.3} action={
        <button type="button" onClick={addRow} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Add Task Row
        </button>
      }>
        {/* TABLE 1: Main info — #, C/O, Priority, Task Type, Ticket, Description, Module, Status */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="pro-table" style={{ width: "100%", tableLayout: "fixed", minWidth: "860px" }}>
            <colgroup>
              <col style={{ width: "40px" }} />
              <col style={{ width: "70px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "120px" }} />
              <col />
              <col style={{ width: "130px" }} />
              <col style={{ width: "150px" }} />
            </colgroup>
            <thead>
              <tr>
                {["#","C/O","Priority","Task Type","Ticket / Ref","Task Description","Module","Status"].map(h => (
                  <th key={h} style={{ whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td className="text-center text-gray-400 font-semibold text-xs">{task.id}</td>
                  <td>
                    <div className="flex flex-col gap-1 items-start">
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" className="accent-emerald-600 w-3.5 h-3.5" checked={task.carryOver === "Yes"} onChange={() => updateTask(task.id, "carryOver", task.carryOver === "Yes" ? "" : "Yes")} />
                        <span className="text-gray-600">Yes</span>
                      </label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" className="accent-rose-500 w-3.5 h-3.5" checked={task.carryOver === "No"} onChange={() => updateTask(task.id, "carryOver", task.carryOver === "No" ? "" : "No")} />
                        <span className="text-gray-600">No</span>
                      </label>
                    </div>
                  </td>
                  <td>
                    <select className="pro-select text-xs py-1 w-full" value={task.priority} onChange={e => updateTask(task.id, "priority", e.target.value)}>
                      <option value="">—</option><option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </td>
                  <td>
                    <select className="pro-select text-xs py-1 w-full" value={task.taskType} onChange={e => updateTask(task.id, "taskType", e.target.value)}>
                      <option value="">—</option><option>Development</option><option>Bug Fix</option><option>Testing</option><option>Review</option><option>Documentation</option><option>Meeting</option><option>Research</option>
                    </select>
                  </td>
                  <td><input className="pro-input py-1 text-xs w-full" type="text" placeholder="PROJ-101" value={task.ticketRef} onChange={e => updateTask(task.id, "ticketRef", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs w-full" type="text" placeholder="Describe task…" value={task.description} onChange={e => updateTask(task.id, "description", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs w-full" type="text" placeholder="Module" value={task.module} onChange={e => updateTask(task.id, "module", e.target.value)} /></td>
                  <td>
                    <select className="pro-select text-xs py-1 w-full" value={task.status} onChange={e => updateTask(task.id, "status", e.target.value)}>
                      <option value="">—</option><option value="done">Done</option><option value="ip">In Progress</option><option value="blocked">Blocked</option><option value="todo">To Do</option>
                    </select>
                    {task.status && (
                      <span className={`badge mt-1 ${statusBadge[task.status]}`}>
                        <span className="badge-dot" />{statusLabel[task.status]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TABLE 2: Details — % Done, Est. Hrs, Actual Hrs, Output, Commit, Remarks, Delete */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 mt-3">
          <table className="pro-table" style={{ width: "100%", tableLayout: "fixed", minWidth: "800px" }}>
            <colgroup>
              <col style={{ width: "40px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col />
              <col style={{ width: "180px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "50px" }} />
            </colgroup>
            <thead>
              <tr>
                {["#","% Done","Est. Hrs","Actual Hrs","Output / Deliverable","Commit / PR","Remarks",""].map(h => (
                  <th key={h} style={{ whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td className="text-center text-gray-400 font-semibold text-xs">{task.id}</td>
                  <td><input className="pro-input py-1 text-xs text-center w-full" type="number" min={0} max={100} step={5} placeholder="0" value={task.percentDone} onChange={e => updateTask(task.id, "percentDone", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs text-center w-full" type="number" min={0} step={0.5} placeholder="0" value={task.estHrs} onChange={e => updateTask(task.id, "estHrs", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs text-center w-full" type="number" min={0} step={0.5} placeholder="0" value={task.actualHrs} onChange={e => updateTask(task.id, "actualHrs", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs w-full" type="text" placeholder="Output description" value={task.output} onChange={e => updateTask(task.id, "output", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs w-full" type="text" placeholder="Commit/PR URL" value={task.commitLink} onChange={e => updateTask(task.id, "commitLink", e.target.value)} /></td>
                  <td><input className="pro-input py-1 text-xs w-full" type="text" placeholder="Remarks" value={task.remarks} onChange={e => updateTask(task.id, "remarks", e.target.value)} /></td>
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(task.id)}
                      className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1 transition-all"
                      title="Delete row"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Time Breakdown</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([["Dev Hours (coding / testing / review)", devHrs, setDevHrs], ["Meeting / Admin Hours", meetingHrs, setMeetingHrs], ["Waiting / Idle Hours", idleHrs, setIdleHrs]] as [string, string, (v: string) => void][]).map(([lbl, val, setter]) => (
              <div key={lbl} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <label className="pro-label">{lbl}</label>
                <input className="pro-input mt-1" type="number" min={0} step={0.5} placeholder="0.0" value={val} onChange={e => setter(e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Section 4: End-of-Day Summary */}
      <SectionCard num={4} title="End-of-Day Summary" delay={0.4}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { val: totalActual.toFixed(1), lbl: "Total Actual Hours", hi: true },
            { val: totalEst.toFixed(1),    lbl: "Total Estimated Hours" },
            { val: (variance >= 0 ? "+" : "") + variance.toFixed(1), lbl: "Variance" },
            { val: tasksDone,   lbl: "Tasks Completed" },
            { val: tasksIP,     lbl: "In Progress" },
            { val: tasksBlocked,lbl: "Blocked" },
            { val: tasksCarry,  lbl: "Carry-Over" },
          ].map(({ val, lbl, hi }) => (
            <div key={lbl} className={`rounded-xl p-4 text-center border ${hi ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"}`}>
              <p className={`text-2xl font-bold ${hi ? "text-emerald-700" : "text-gray-800"}`}>{val}</p>
              <p className="text-xs text-gray-500 mt-1">{lbl}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Key Accomplishments">
            <textarea className="pro-input resize-none" rows={3} placeholder="Summarize what was accomplished today…" value={keyAccomp} onChange={e => setKeyAccomp(e.target.value)} />
          </Field>
          <Field label="Blockers / Issues Encountered">
            <textarea className="pro-input resize-none" rows={3} placeholder="Describe blockers, errors, or issues…" value={blockers} onChange={e => setBlockers(e.target.value)} />
          </Field>
          <Field label="Risks / Early Warnings">
            <textarea className="pro-input resize-none" rows={2} placeholder="Upcoming issues, client delays, scope creep…" value={risks} onChange={e => setRisks(e.target.value)} />
          </Field>
          <Field label="Plan for Tomorrow">
            <textarea className="pro-input resize-none" rows={2} placeholder="What will you focus on next working day…" value={planTmr} onChange={e => setPlanTmr(e.target.value)} />
          </Field>
          <Field label="Support / Escalation Needed" col2>
            <textarea className="pro-input resize-none" rows={2} placeholder="Any escalations or support required…" value={escalation} onChange={e => setEscalation(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* Section 5: Checklist */}
      <SectionCard num={5} title="End-of-Day Checklist" delay={0.5}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checklistItems.map((item, i) => (
            <label key={item} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checklist[i] ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100 hover:border-emerald-200"}`}>
              <input type="checkbox" checked={checklist[i]} onChange={() => toggleCheck(i)} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
              <span className={`text-sm ${checklist[i] ? "text-emerald-700 font-medium" : "text-gray-600"}`}>{item}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{checkCount} / 6 items checked</span>
            <span>{checkPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${checkPct}%` }} />
          </div>
        </div>
      </SectionCard>

      {/* Section 6: Tomorrow's Plan */}
      <SectionCard num={6} title="Tomorrow's Plan" delay={0.6}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Work Arrangement Tomorrow">
            <RadioPills options={["On-site","Remote","Hybrid"] as WorkArrangement[]} value={tmrArr} onChange={setTmrArr} />
          </Field>
          <Field label="Expected Time In">
            <input className="pro-input" type="time" value={tmrTimeIn} onChange={e => setTmrTimeIn(e.target.value)} />
          </Field>
          <Field label="Leave / Absence Notice">
            <input className="pro-input" type="text" placeholder="e.g. Half-day leave in afternoon" value={leaveNotice} onChange={e => setLeaveNotice(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* Section 7: Acknowledgment */}
      <SectionCard num={7} title="Acknowledgment" delay={0.7}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Prepared by">
            <input className="pro-input" type="text" placeholder="Developer's full name" value={preparedBy} onChange={e => setPreparedBy(e.target.value)} />
          </Field>
          <Field label="Signature (type full name)">
            <input className="pro-input" type="text" placeholder="Type name as signature" value={preparedSig} onChange={e => setPreparedSig(e.target.value)} />
          </Field>
          <Field label="Date Submitted">
            <input className="pro-input" type="date" value={dateSubmitted} onChange={e => setDateSubmitted(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-500 leading-relaxed">
          <strong className="text-gray-700">Note:</strong> Submit this report to your immediate supervisor before end of work day. Late submissions must be justified. Submission timestamp is mandatory.
        </div>
      </SectionCard>

      {/* Submit Bar */}
      <div className="pro-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in-up" style={{ animationDelay: "0.8s", opacity: 0 }}>
        <p className="text-sm text-gray-500">
          <strong className="text-gray-700">Reminder:</strong> Submit before end of work day. Late submissions must include justification.
        </p>
        <div className="flex gap-3 flex-shrink-0">
          <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(true)}><Eye className="w-4 h-4" /> Preview</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}><Send className="w-4 h-4" /> Submit Report</button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="pro-modal-overlay" onClick={() => setShowPreview(false)}>
          <div
            className="pro-modal"
            style={{ maxWidth: "860px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="pro-modal-header">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3>Daily Accomplishment Report — Preview</h3>
              </div>
              <button onClick={() => setShowPreview(false)} className="btn-ghost btn-icon">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="pro-modal-body overflow-y-auto" style={{ flex: 1 }}>
              <div className="rounded-xl p-5 mb-5 text-white" style={{ background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-1">SIMPLEVIA HRIS</p>
                <h2 className="text-lg font-bold">Daily Accomplishment Report</h2>
                <p className="text-xs text-emerald-200 mt-0.5">Software Development — Individual Submission</p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-emerald-100">
                  <span>{date || "—"}</span>
                  <span>{devName || "—"}</span>
                  <span>{workArr}</span>
                  <span>{project || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { lbl: "Tasks Done",   val: tasksDone,                  color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                  { lbl: "Actual Hours", val: totalActual.toFixed(1)+"h", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                  { lbl: "Blocked",      val: tasksBlocked,               color: "text-rose-700 bg-rose-50 border-rose-200" },
                  { lbl: "Checklist",    val: `${checkCount}/6`,          color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
                ].map(({ lbl, val, color }) => (
                  <div key={lbl} className={`rounded-xl p-3 text-center border ${color}`}>
                    <p className="text-xl font-bold">{val}</p>
                    <p className="text-[10px] font-medium mt-0.5">{lbl}</p>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] flex items-center justify-center">1</span>
                  Developer Information
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Project", project], ["Sprint", sprint], ["Team", team], ["Submitted To", submittedTo],
                    ["Time In", timeIn],
                    ["Time Out", timeOut],
                    ["Gross", gross], ["Net Hours", net],
                    ["Standup", standup], ["Reachable", reachable], ["Avg Response", avgResponse], ["Work Arrangement", workArr],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-medium">{lbl}</p>
                      <p className="text-gray-800 font-semibold text-xs mt-0.5">{val || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] flex items-center justify-center">3</span>
                  Tasks & Activities
                </p>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="pro-table text-xs">
                    <thead>
                      <tr>
                        {["#","Type","Ticket","Description","Module","Status","% Done","Est.","Actual","Output"].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.filter(t => t.description || t.ticketRef || t.status).map(t => (
                        <tr key={t.id}>
                          <td className="text-center text-gray-400">{t.id}</td>
                          <td>{t.taskType || "—"}</td>
                          <td className="font-mono">{t.ticketRef || "—"}</td>
                          <td>{t.description || "—"}</td>
                          <td>{t.module || "—"}</td>
                          <td>{t.status ? <span className={`badge ${statusBadge[t.status]}`}><span className="badge-dot" />{statusLabel[t.status]}</span> : "—"}</td>
                          <td className="text-center">{t.percentDone ? t.percentDone+"%" : "—"}</td>
                          <td className="text-center">{t.estHrs || "—"}</td>
                          <td className="text-center">{t.actualHrs || "—"}</td>
                          <td>{t.output || "—"}</td>
                        </tr>
                      ))}
                      {tasks.filter(t => t.description || t.ticketRef || t.status).length === 0 && (
                        <tr><td colSpan={10} className="text-center text-gray-400 py-4 text-xs">No tasks entered</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[["Dev Hours", devHrs], ["Meeting Hours", meetingHrs], ["Idle Hours", idleHrs]].map(([lbl, val]) => (
                    <div key={lbl} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-center">
                      <p className="text-[10px] text-gray-400 font-medium">{lbl}</p>
                      <p className="text-gray-800 font-bold text-sm mt-0.5">{val || "0"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] flex items-center justify-center">4</span>
                  End-of-Day Summary
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[["Key Accomplishments", keyAccomp], ["Blockers / Issues", blockers], ["Risks / Early Warnings", risks], ["Plan for Tomorrow", planTmr]].map(([lbl, val]) => (
                    <div key={lbl} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">{lbl}</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{val || <span className="text-gray-300 italic">Not provided</span>}</p>
                    </div>
                  ))}
                  {escalation && (
                    <div className="md:col-span-2 bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-1">Support / Escalation Needed</p>
                      <p className="text-xs text-gray-700">{escalation}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] flex items-center justify-center">5</span>
                  End-of-Day Checklist — {checkCount}/6 ({checkPct}%)
                </p>
                <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${checkPct}%` }} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {checklistItems.map((item, i) => (
                    <div key={item} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${checklist[i] ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-100 text-gray-400"}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${checklist[i] ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                        {checklist[i] ? "✓" : "○"}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Tomorrow's Plan</p>
                  <div className="space-y-1 text-xs text-gray-700">
                    <p><span className="text-gray-400">Arrangement:</span> {tmrArr}</p>
                    <p><span className="text-gray-400">Expected In:</span> {tmrTimeIn || "—"}</p>
                    <p><span className="text-gray-400">Leave Notice:</span> {leaveNotice || "—"}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Acknowledgment</p>
                  <div className="space-y-1 text-xs text-gray-700">
                    <p><span className="text-gray-400">Prepared by:</span> {preparedBy || "—"}</p>
                    <p><span className="text-gray-400">Signature:</span> {preparedSig || "—"}</p>
                    <p><span className="text-gray-400">Date Submitted:</span> {dateSubmitted || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pro-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}><Send className="w-4 h-4" /> Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}