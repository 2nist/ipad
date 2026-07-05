// ═══════════════════════════════════════════════════════════════════
// CANVAS TOOLBAR — Top toolbar with song metadata, transport,
// view toggles, and AI buttons
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';

export const CanvasToolbar: React.FC = () => {
    const songMetadata = useLooperStore(s => s.song.metadata);
    const isPlaying = useLooperStore(s => s.transport.isPlaying);
    const canvasView = useLooperStore(s => s.ui.canvasView);
    const setBpm = useLooperStore(s => s.setBpm);
    const setSongMetadata = useLooperStore(s => s.setSongMetadata);
    const setCanvasView = useLooperStore(s => s.setCanvasView);
    const globalPlay = useLooperStore(s => s.globalPlay);
    const addSection = useLooperStore(s => s.addSection);
    const setModal = useLooperStore(s => s.setModal);
    const toggleClipBrowser = useLooperStore(s => s.toggleClipBrowser);

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 border-b border-zinc-700 text-white text-sm">
            {/* Song Title */}
            <input
                type="text"
                value={songMetadata.title}
                onChange={e => setSongMetadata({ title: e.target.value })}
                className="bg-transparent border-b border-zinc-600 px-2 py-1 text-lg font-semibold w-48 focus:outline-none focus:border-blue-500"
            />

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-600" />

            {/* BPM */}
            <div className="flex items-center gap-1">
                <span className="text-zinc-400 text-xs">BPM</span>
                <input
                    type="number"
                    value={songMetadata.bpm}
                    min={60}
                    max={200}
                    onChange={e => setBpm(Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 w-16 text-center text-sm"
                />
            </div>

            {/* Time Signature */}
            <div className="flex items-center gap-1 text-zinc-400 text-xs">
                <span>Time:</span>
                <span className="text-white font-mono">
                    {songMetadata.timeSignature.numerator}/{songMetadata.timeSignature.denominator}
                </span>
            </div>

            {/* Key */}
            <div className="flex items-center gap-1 text-zinc-400 text-xs">
                <span>Key:</span>
                <span className="text-white font-mono">{songMetadata.key} {songMetadata.scale}</span>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-600" />

            {/* Play/Stop Button */}
            <button
                onClick={globalPlay}
                className={`px-3 py-1 rounded text-sm font-bold ${isPlaying
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
            >
                {isPlaying ? '⏹ STOP' : '▶ PLAY'}
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-600" />

            {/* View Level Toggle */}
            <div className="flex items-center gap-1 bg-zinc-800 rounded p-0.5">
                {(['sectionsOnly', 'sectionsWithModules', 'fullComposition'] as const).map(level => (
                    <button
                        key={level}
                        onClick={() => setCanvasView({ viewLevel: level })}
                        className={`px-2 py-0.5 rounded text-xs ${canvasView.viewLevel === level
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        {level === 'sectionsOnly' ? 'Sections' : level === 'sectionsWithModules' ? '+ Modules' : 'Full'}
                    </button>
                ))}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-600" />

            {/* Action Buttons */}
            <button
                onClick={() => addSection()}
                className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs"
            >
                + Section
            </button>

            <button
                onClick={() => setModal({ type: 'addModule' })}
                className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs"
            >
                + Module
            </button>

            <button
                onClick={toggleClipBrowser}
                className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs"
            >
                Clips
            </button>

            {/* AI Buttons */}
            <button
                onClick={() => setModal({ type: 'aiStructure' })}
                className="px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-xs"
            >
                AI: Structure
            </button>

            <button
                onClick={() => setModal({ type: 'aiArrange' })}
                className="px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-xs"
            >
                AI: Arrange
            </button>
        </div>
    );
};

export default CanvasToolbar;