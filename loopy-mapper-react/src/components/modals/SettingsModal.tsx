// ═══════════════════════════════════════════════════════════════════
// SETTINGS MODAL — App-wide preferences.
// Currently: the backend drum-sample directory (DRUMS_ROOT). The backend
// persists this, so this modal just reads/writes GET|POST /api/drums/config.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useLooperStore } from '../../store/store';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8766';

type ConfigStatus = { root: string; exists: boolean; kitCount: number };

export const SettingsModal: React.FC = () => {
    const closeModal = useLooperStore(s => s.closeModal);

    const [path, setPath] = useState('');
    const [status, setStatus] = useState<ConfigStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backendDown, setBackendDown] = useState(false);

    // Load the current backend config on open.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`${API_BASE}/api/drums/config`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = (await r.json()) as ConfigStatus;
                if (cancelled) return;
                setStatus(data);
                setPath(data.root);
            } catch {
                if (!cancelled) setBackendDown(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const r = await fetch(`${API_BASE}/api/drums/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ root: path.trim() }),
            });
            const data = await r.json();
            if (!r.ok) {
                setError(data?.detail || `Failed (HTTP ${r.status})`);
            } else {
                setStatus(data as ConfigStatus);
            }
        } catch {
            setBackendDown(true);
            setError('Backend not reachable.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Settings</h2>
                <button onClick={closeModal} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Drum sample directory (backend) */}
            <section className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                    Drum Sample Directory
                </h3>
                <p className="text-[11px] text-zinc-500 mb-3">
                    Folder on the machine running the backend server. Each sub-folder with
                    audio files is treated as a kit. Served to the app over HTTP.
                </p>

                {loading ? (
                    <div className="text-sm text-zinc-500">Loading…</div>
                ) : backendDown ? (
                    <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded p-3">
                        Backend not reachable at <code className="text-red-300">{API_BASE}</code>.
                        Start it, then reopen Settings. (Bundled/uploaded kits still work without it.)
                    </div>
                ) : (
                    <>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={path}
                                onChange={e => setPath(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                                placeholder="/Users/you/Drums"
                                spellCheck={false}
                                className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                            />
                            <button
                                onClick={save}
                                disabled={saving || !path.trim()}
                                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>

                        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}

                        {status && !error && (
                            <div className="mt-2 text-xs">
                                {status.exists ? (
                                    <span className="text-green-400">
                                        ✓ {status.kitCount} kit{status.kitCount === 1 ? '' : 's'} found
                                    </span>
                                ) : (
                                    <span className="text-red-400">✗ Directory not found</span>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>

            <div className="flex justify-end">
                <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm"
                >
                    Done
                </button>
            </div>
        </div>
    );
};

export default SettingsModal;
