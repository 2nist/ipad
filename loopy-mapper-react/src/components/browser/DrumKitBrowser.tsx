// ═══════════════════════════════════════════════════════════════════
// DRUM KIT BROWSER — Browse 196 hardware drum machines,
// preview samples, and assign to module tracks via Tone.Sampler.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { Music, Play, Square, Loader2, ChevronRight, Drum, Search } from 'lucide-react';
import { useLooperStore } from '../../store/store';
import { synthEngine } from '../../lib/synthEngine';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8766';

interface KitEntry {
  name: string;
  sampleCount: number;
  path: string;
}

interface SampleEntry {
  filename: string;
  url: string;
  size: number;
}

export const DrumKitBrowser: React.FC = () => {
  const [kits, setKits] = useState<KitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleEntry[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [previewingSample, setPreviewingSample] = useState<string | null>(null);
  const [previewVoice, setPreviewVoice] = useState<any>(null);

  // Get the currently editing track from the midi editor state (or the OUT menu context)
  const editingModuleId = useLooperStore(s => s.ui.midiEditorModuleId);
  const editingTrackIdx = useLooperStore(s => s.ui.midiEditorTrackIndex);

  // Fetch kits on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/drums`)
      .then(r => r.json())
      .then(data => { setKits(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  // Fetch samples when a kit is selected
  const selectKit = useCallback(async (kitName: string) => {
    setSelectedKit(kitName);
    setSamplesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/drums/${encodeURIComponent(kitName)}`);
      const data = await res.json();
      setSamples(data);
    } catch {
      setSamples([]);
    }
    setSamplesLoading(false);
  }, []);

  // Play a preview of a sample through a temporary Synth voice
  const previewSample = useCallback(async (sample: SampleEntry) => {
    // Stop any existing preview
    if (previewVoice) {
      try { previewVoice.dispose(); } catch { /* ignore */ }
    }

    if (previewingSample === sample.filename) {
      setPreviewingSample(null);
      return;
    }

    setPreviewingSample(null);

    // Create a temporary sampler for preview
    try {
      const Tone = await import('tone');
      const sampler = new Tone.Sampler({
        urls: { C3: sample.url },
        baseUrl: '',
        onload: () => {
          setPreviewingSample(sample.filename);
          sampler.triggerAttack('C3', Tone.now(), 0.8);
          setPreviewVoice(sampler);
        },
      }).toDestination();
    } catch {
      // If Tone.js import fails, we're likely not initialized yet
    }
  }, [previewingSample, previewVoice]);

  // Assign sample to the track matching the given MIDI note
  const assignSample = useCallback((sample: SampleEntry, midiNote: number) => {
    const store = useLooperStore.getState();

    // Find any rhythm module that has a track with this MIDI note
    for (const mod of store.song.modules) {
      if (mod.type !== 'rhythm') continue;
      const track = mod.tracks.find(t => t.midiNote === midiNote);
      if (!track) continue;
      const trackIndex = track.index;

      // Prepend API base for absolute URL (Tone.Sampler needs absolute URLs)
      const absoluteUrl = sample.url.startsWith('http') ? sample.url : `${API_BASE}${sample.url}`;
      const engine = {
        type: 'sampler' as const,
        sampleMap: { [midiNote]: absoluteUrl },
        rootNote: midiNote,
      };

      // Set the sound source to sample type with the new engine
      store.setSoundSource(mod.id, trackIndex, {
        type: 'sample',
        sampleId: sample.filename,
        sampleName: sample.filename.replace(/\.\w+$/, ''),
        sampleUrl: absoluteUrl,
        soundEngine: engine,
        transpose: 0,
        velocityScale: 1.0,
        triggerMode: 'oneShot' as const,
      });

      // Create the synth voice
      const voiceId = `${mod.id}:${trackIndex}`;
      synthEngine.setVoice(voiceId, engine, track.volume);

      console.log(`[DrumKitBrowser] Assigned ${sample.filename} to ${mod.label} > ${track.label} (MIDI ${midiNote})`);
    }
  }, []);

  // Convert MIDI note to note name
  const midiToNote = (midi: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return `${notes[midi % 12]}${octave}`;
  };

  const filteredKits = search
    ? kits.filter(k => k.name.toLowerCase().includes(search.toLowerCase()))
    : kits;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Drum size={14} className="text-orange-400" />
          <h2 className="text-xs font-semibold text-white">Drum Kits</h2>
          <span className="text-[10px] text-zinc-500">({kits.length} kits)</span>
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

      <div className="flex-1 flex">
        {/* Kit List */}
        <div className="w-48 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
          {filteredKits.map(kit => (
            <button
              key={kit.name}
              onClick={() => selectKit(kit.name)}
              className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between transition-colors ${
                selectedKit === kit.name
                  ? 'bg-orange-900/30 text-orange-300 border-r-2 border-orange-500 font-semibold'
                  : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span className="truncate flex-1">{kit.name}</span>
              <span className="text-[9px] text-zinc-500 ml-1">{kit.sampleCount}</span>
            </button>
          ))}
        </div>

        {/* Sample List */}
        <div className="flex-1 overflow-y-auto">
          {!selectedKit && (
            <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
              Select a kit to browse samples
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
                const store = useLooperStore.getState();
                const allRhythmTracks = store.song.modules
                  .filter(m => m.type === 'rhythm')
                  .flatMap(m => m.tracks.map(t => ({ ...t, moduleId: m.id, moduleLabel: m.label })));
                const uniqueMidiNotes = [...new Set(allRhythmTracks.map(t => t.midiNote))].sort((a, b) => a - b);

                // Get assigned track info for this sample
                const assignedTrack = allRhythmTracks.find(t => {
                  const src = t.soundSource;
                  return src.type === 'sample' && src.sampleId === sample.filename;
                });

                return (
                  <div
                    key={sample.filename}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/50 transition-colors"
                  >
                    {/* Assign dropdown */}
                    <select
                      value={assignedTrack ? assignedTrack.midiNote : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val) assignSample(sample, Number(val));
                      }}
                      className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500 flex-shrink-0"
                      title="Assign to MIDI note"
                    >
                      <option value="">--</option>
                      {uniqueMidiNotes.map(midiNote => (
                        <option key={midiNote} value={midiNote}>
                          {midiNote}
                        </option>
                      ))}
                    </select>

                    {/* Preview button */}
                    <button
                      onClick={() => previewSample(sample)}
                      className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                        isPreviewing
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                      }`}
                      title={isPreviewing ? 'Stop' : 'Preview'}
                    >
                      {isPreviewing ? <Square size={10} /> : <Play size={10} className="ml-0.5" />}
                    </button>

                    {/* Sample filename */}
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