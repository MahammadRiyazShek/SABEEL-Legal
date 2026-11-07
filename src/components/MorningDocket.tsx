import React, { useState, useEffect } from 'react';
import {
  Sun,
  CheckCircle,
  Clock,
  Calendar,
  Plus,
  Scale,
  Users,
  MapPin,
  PhoneCall,
  FileCheck,
  Send,
  MessageSquare
} from 'lucide-react';

interface ReminderItem {
  id: string;
  type: 'hearing' | 'meeting' | 'call' | 'doc_request' | 'general';
  title: string;
  time: string;
  caseRef?: string;
  village?: string;
  lawyer: string;
  completed: boolean;
}

interface MorningDocketProps {
  onNavigateToTab?: (tab: string) => void;
}

export const MorningDocket: React.FC<MorningDocketProps> = ({ onNavigateToTab }) => {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newType, setNewType] = useState<ReminderItem['type']>('meeting');
  const [newLawyer, setNewLawyer] = useState('Adv. M.A. Riyaz');
  const [newVillage, setNewVillage] = useState('Shamshabad');

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      const data = await res.json();
      if (data.reminders) {
        setReminders(data.reminders);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch('/api/reminders/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.reminders) setReminders(data.reminders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          time: newTime || 'Morning Routine',
          type: newType,
          lawyer: newLawyer,
          village: newVillage,
        }),
      });
      const data = await res.json();
      if (data.reminders) setReminders(data.reminders);
      setNewTitle('');
      setNewTime('');
      setIsAddOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const pendingCount = reminders.filter((r) => !r.completed).length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sun className="w-4 h-4 text-amber-400" />
            Automated Morning Docket & Reminders
          </div>
          <h2 className="text-xl font-bold text-white">Daily Advocate & Staff Morning Briefing</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            "Daily morning after first message by client, ask for any new reminders to be added, and remind of any previous reminders (meetings, scheduled calls, court appearances)."
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow transition"
          >
            <Plus className="w-4 h-4" />
            Add Reminder / Hearing
          </button>
        </div>
      </div>

      {/* Grid: Reminders List & Staff/Lawyer Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reminders Checklist */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Today's Agenda ({pendingCount} pending)
            </h3>
            <span className="text-xs text-slate-500">Click circle to complete</span>
          </div>

          <div className="space-y-2.5">
            {reminders.map((r) => {
              return (
                <div
                  key={r.id}
                  onClick={() => handleToggle(r.id)}
                  className={`border rounded-xl p-3.5 flex items-start gap-3 cursor-pointer transition shadow-sm ${
                    r.completed
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : 'bg-slate-900 border-slate-800 hover:border-amber-500/50'
                  }`}
                >
                  <button
                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition shrink-0 ${
                      r.completed
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-slate-600 hover:border-amber-400'
                    }`}
                  >
                    {r.completed && <CheckCircle className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          r.completed ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {r.title}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-amber-300 font-medium px-2 py-0.5 rounded border border-slate-700 shrink-0">
                        {r.time}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Advocate: <strong className="text-slate-300">{r.lawyer}</strong></span>
                      {r.village && (
                        <span>Village: <strong className="text-cyan-400">{r.village}</strong></span>
                      )}
                      {r.caseRef && (
                        <span className="font-mono text-slate-400 text-[10px]">({r.caseRef})</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lawyer Workload & Access Control Card */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Lawyer Case Assignments
            </h4>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-slate-200">Adv. M.A. Riyaz</strong>
                  <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded">Lead Counsel</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Handling: High Court Injunctions (Shamshabad Sy 142/A), Chevella FIR & Criminal Trespass.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-slate-200">Adv. Fatima Begum</strong>
                  <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded">Senior Associate</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Handling: Tahsildar Moinabad Sy 88 Revenue Mutation, Senior Civil Judge Maheshwaram OS 412/2025.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-slate-200">Adv. K. Srinivas</strong>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded">Regulatory Specialist</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Handling: HMDA Planning Layout Clearance & GO 111 Compliance (Rajendranagar Sy 204).
                </p>
              </div>
            </div>
          </div>

          {/* Quick WhatsApp Reminder Prompt */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-xs space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              WhatsApp Morning Push
            </h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              SABEEL automatically sends this daily docket to the advocate's WhatsApp at 8:30 AM every morning.
            </p>
            <button
              onClick={() => onNavigateToTab?.('whatsapp')}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Send className="w-3 h-3" />
              Preview WhatsApp Morning Message
            </button>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-sm">Add New Agenda / Reminder</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddReminder} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Reminder Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Call Tahsildar for Passbook entry"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Time / Hour</label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e: any) => setNewType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  >
                    <option value="hearing">Court Hearing</option>
                    <option value="meeting">Client Meeting</option>
                    <option value="call">Scheduled Call</option>
                    <option value="doc_request">Document Request</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Assigned Lawyer</label>
                  <select
                    value={newLawyer}
                    onChange={(e) => setNewLawyer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  >
                    <option value="Adv. M.A. Riyaz">Adv. M.A. Riyaz</option>
                    <option value="Adv. Fatima Begum">Adv. Fatima Begum</option>
                    <option value="Adv. K. Srinivas">Adv. K. Srinivas</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Village (Optional)</label>
                  <input
                    type="text"
                    value={newVillage}
                    onChange={(e) => setNewVillage(e.target.value)}
                    placeholder="e.g. Shamshabad"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-1.5 rounded-lg"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
