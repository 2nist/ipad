// ═══════════════════════════════════════════════════════════════════
// DRUM KIT BROWSER — Browse built-in kits (bundled, work with no backend)
// and the full server library, preview, and assign to module tracks.
// "Auto-map" places a whole kit onto pads by filename (see drumMapping).
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { Play, Square, Loader2, Drum, Search, Wand2 } from 'lucide-react';
import { useLooperStore } from '../../store/store';
import { synthEngine } from '../../lib/synthEngine';
import { detectDrumNote } from '../../lib/drumMapping';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8766';

type KitSource = 'builtin' | 'server';

interface SampleEntry {
  filename: string;
  url: string;
  size?: number;
}

interface KitEntry {
  name: string;
  sampleCount: number;
  source: KitSource;
  samples?: SampleEntry[]; // present for built-in kits (from the manifest)
}

interface Manifest {
  kits: Array<{ name: string; sampleCount: number; samples: SampleEntry[] }>;
}

/** Resolve a sample URL to something Tone.Sampler/fetch can load. */
function absUrl(url: string, source: KitSource): string {
  if (url.startsWith('http')) return url;
  // Built-in kits are static assets on the frontend origin; server kits live
  // behind the backend API base.
  return source === 'server' ? `${API_BASE}${url}` : url;
}

export const DrumKitBrowser: React.FC = () => {
  const [builtinKits, setBuiltinKits] = useState<KitEntry[]>([]);
  const [serverKits, setServerKits] = useState<KitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKit, setSelectedKit] = useState<KitEntry | null>(null);
  const [samples, setSamples] = useState<SampleEntry[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [previewingSample, setPreviewingSample] = useState<string | null>(null);
  const [previewVoice, setPreviewVoice] = useState<any>(null);
  const [serverDown, setServerDown] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Load bundled kits from the static manifest (always available, no backend).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/drums/manifest.json');
        if (r.ok) {
          const data = (await r.json()) as Manifest;
          setBuiltinKits(data.kits.map(k => ({
            name: k.name,
            sampleCount: k.sampleCount,
            source: 'builtin' as const,
            samples: k.samples,
          })));
        }
      } catch {
        // No bundled kits — that's fine, the server library may still load.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load the server library (the full configurable directory).
  const fetchServerKits = useCallback(async () => {
    setServerDown(false);
    try {
      const r = await fetch(`${API_BASE}/api/drums`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Array<{ name: string; sampleCount: number }>;
      setServerKits(data.map(k => ({ name: k.name, sampleCount: k.sampleCount, source: 'server' as const })));
    } catch {
      setServerDown(true);
      setServerKits([]);
    }
  }, []);

  useEffect(() => { fetchServerKits(); }, [fetchServerKits]);

  const retryConnect = useCallback(async () => {
    setRetrying(true);
    await fetchServerKits();
    setRetrying(false);
  }, [fetchServerKits]);

  // Select a kit → get its samples (inline for built-in, fetched for server).
  const selectKit = useCallback(async (kit: KitEntry) => {
    setSelectedKit(kit);
    if (kit.source === 'builtin') {
      setSamples(kit.samples ?? []);
      return;
    }
    setSamplesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/drums/${encodeURIComponent(kit.name)}`);
      setSamples(await res.json());
    } catch {
      setSamples([]);
    }
    setSamplesLoading(false);
  }, []);

  // Preview a sample through a temporary sampler.
  const previewSample = useCallback(async (sample: SampleEntry, source: KitSource) => {
    if (previewVoice) {
      try { previewVoice.dispose(); } catch { /* ignore */ }
    }
    if (previewingSample === sample.filename) {
      setPreviewingSample(null);
      return;
    }
    setPreviewingSample(null);
    try {
      const Tone = await import('tone');
      const sampler = new Tone.Sampler({
        urls: { C3: absUrl(sample.url, source) },
        baseUrl: '',
        onload: () => {
          setPreviewingSample(sample.filename);
          sampler.triggerAttack('C3', Tone.now(), 0.8);
          setPreviewVoice(sampler);
        },
      }).toDestination();
    } catch {
      // Tone not ready yet.
    }
  }, [previewingSample, previewVoice]);

  // Assign one sample to every rhythm track that uses `midiNote`.
  const assignSample = useCallback((sample: SampleEntry, midiNote: number, source: KitSource) => {
    const store = useLooperStore.getState();
    const absoluteUrl = absUrl(sample.url, source);

    for (const mod of store.song.modules) {
      if (mod.type !== 'rhythm') continue;
      const track = mod.tracks.find(t => t.midiNote === midiNote);
      if (!track) continue;

      const engine = { type: 'sampler' as const, sampleMap: { [midiNote]: absoluteUrl }, rootNote: midiNote };
      store.setSoundSource(mod.id, track.index, {
        type: 'sample',
        sampleId: sample.filename,
        sampleName: sample.filename.replace(/\.\w+$/, ''),
        sampleUrl: absoluteUrl,
        soundEngine: engine,
        transpose: 0,
        velocityScale: 1.0,
        triggerMode: 'oneShot' as const,
      });
      synthEngine.setVoice(`${mod.id}:${track.index}`, engine, track.volume);
    }
  }, []);

  // Auto-map a whole kit onto pads by filename. First sample per detected role
  // wins its note; duplicates/unknowns are skipped (use the dropdown to place).
  const autoAssignKit = useCallback(() => {
    if (!selectedKit) return;
    const used = new Set<number>();
    let placed = 0;
    for (const s of samples) {
      const note = detectDrumNote(s.filename);
      if (note === null || used.has(note)) continue;
      used.add(note);
      assignSample(s, note, selectedKit.source);
      placed++;
    }
    console.log(`[DrumKitBrowser] Auto-mapped ${placed} samples from ${selectedKit.name}`);
  }, [selectedKit, samples, assignSample]);

  const matches = (k: KitEntry) => !search || k.name.toLowerCase().includes(search.toLowerCase());
  const shownBuiltin = builtinKits.filter(matches);
  const shownServer = serverKits.filter(matches);
  const totalKits = builtinKits.length + serverKits.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  // Rhythm-track MIDI notes available to assign to (for the dropdown).
  const store = useLooperStore.getState();
  const uniqueMidiNotes = [...new Set(
    store.song.modules.filter(m => m.type === 'rhythm').flatMap(m => m.tracks.map(t => t.midiNote))
  )].sort((a, b) => a - b);

  const renderKitButton = (kit: KitEntry) => (
    <button
      key={`${kit.source}:${kit.name}`}
      onClick={() => selectKit(kit)}
      className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between transition-colors ${
        selectedKit?.name === kit.name && selectedKit?.source === kit.source
          ? 'bg-orange-900/30 text-orange-300 border-r-2 border-orange-500 font-semibold'
          : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      <span className="truncate flex-1">{kit.name}</span>
      <span className="text-[9px] text-zinc-500 ml-1">{kit.sampleCount}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Drum size={14} className="text-orange-400" />
          <h2 className="text-xs font-semibold text-white">Drum Kits</h2>
          <span className="text-[10px] text-zinc-500">({totalKits})</span>
        </div>
        <button
          onClick={() => useLooperStore.getState().toggleDrumBrowser()}
          className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          title="Close drum browser"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1">
          <Search size={12} className="text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search kits..."
            className="bg-transparent text-xs text-zinc-300 focus:outline-none w-full"
          />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Kit List */}
        <div className="w-48 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
          {shownBuiltin.length > 0 && (
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-orange-500/70 bg-zinc-900/60 sticky top-0">
              Built-in
            </div>
          )}
          {shownBuiltin.map(renderKitButton)}

          <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-zinc-500 bg-zinc-900/60 flex items-center justify-between">
            <span>Library {serverDown ? '(offline)' : `(${serverKits.length})`}</span>
            {serverDown && (
              <button
                onClick={retryConnect}
                disabled={retrying}
                className="text-[9px] text-amber-400 hover:text-amber-300 disabled:opacity-50"
                title="Retry connecting to the backend"
              >
                {retrying ? '…' : 'retry'}
              </button>
            )}
          </div>
          {serverDown ? (
            <div className="px-2 py-2 text-[10px] text-zinc-600 leading-snug">
              Backend not running. Built-in kits still work; start the server for your full library.
            </div>
          ) : (
            shownServer.map(renderKitButton)
          )}
        </div>

        {/* Sample List */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {!selectedKit && (
            <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
              Select a kit to browse samples
            </div>
          )}

          {selectedKit && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 sticky top-0 bg-zinc-950">
              <span className="text-[11px] text-zinc-400 truncate">{selectedKit.name}</span>
              <button
                onClick={autoAssignKit}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-medium flex-shrink-0"
                title="Auto-map this kit onto pads by filename"
              >
                <Wand2 size={11} /> Auto-map
              </button>
            </div>
          )}

          {samplesLoading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          )}

          {selectedKit && !samplesLoading && (
            <div className="py-1">
              {samples.map(sample => {
                const isPreviewing = previewingSample === sample.filename;
                const detected = detectDrumNote(sample.filename);
                return (
                  <div key={sample.filename} className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/50 transition-colors">
                    {/* Assign dropdown (manual override) */}
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) assignSample(sample, Number(e.target.value), selectedKit.source); }}
                      className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500 flex-shrink-0"
                      title={detected !== null ? `Detected note ${detected}` : 'Assign to a pad'}
                    >
                      <option value="">{detected !== null ? `→${detected}?` : '--'}</option>
                      {uniqueMidiNotes.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>

                    {/* Preview */}
                    <button
                      onClick={() => previewSample(sample, selectedKit.source)}
                      className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                        isPreviewing ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                      }`}
                      title={isPreviewing ? 'Stop' : 'Preview'}
                    >
                      {isPreviewing ? <Square size={10} /> : <Play size={10} className="ml-0.5" />}
                    </button>

                    <span className="text-[11px] text-white flex-1 truncate" title={sample.filename}>
                      {sample.filename}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrumKitBrowser;
