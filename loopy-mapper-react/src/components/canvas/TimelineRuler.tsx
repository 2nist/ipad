// ═══════════════════════════════════════════════════════════════════
// TIMELINE RULER — Static beat/bar grid with playhead cursor
// Modules read transport.position independently from the store.
// The ruler is a read-only display, not a DAW-style seekable timeline.
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLooperStore } from '../../store/store';

const MIN_PX_PER_BEAT = 1;
const MAX_PX_PER_BEAT = 100;
const DEFAULT_PX_PER_BEAT = 24;
const RULER_HEIGHT = 48;

export const TimelineRuler: React.FC = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [pixelsPerBeat, setPixelsPerBeat] = useState(DEFAULT_PX_PER_BEAT);
    
    const position = useLooperStore(s => s.transport.position);
    const isPlaying = useLooperStore(s => s.transport.isPlaying);
    const timeSig = useLooperStore(s => s.song.metadata.timeSignature);
    const bpm = useLooperStore(s => s.song.metadata.bpm);

    const beatsPerBar = timeSig.numerator * (4 / timeSig.denominator);

    // Total song length in beats (from arrangement) — default to 64 beats if no sections
    const sections = useLooperStore(s => s.song.arrangement);
    const totalBeats = sections.length > 0
        ? sections.reduce((sum, s) => sum + s.bars * beatsPerBar, 0)
        : 64;

    const totalWidth = totalBeats * pixelsPerBeat;

    // Auto-scroll to keep playhead visible when playing
    useEffect(() => {
        if (!isPlaying || !scrollRef.current) return;
        const playheadX = position.absoluteBeat * pixelsPerBeat;
        const container = scrollRef.current;
        const viewWidth = container.clientWidth;
        const scrollLeft = container.scrollLeft;

        // Scroll if playhead is past 75% of visible area
        if (playheadX > scrollLeft + viewWidth * 0.75) {
            container.scrollLeft = playheadX - viewWidth * 0.25;
        } else if (playheadX < scrollLeft + viewWidth * 0.25) {
            container.scrollLeft = playheadX - viewWidth * 0.25;
        }
    }, [position.absoluteBeat, isPlaying, pixelsPerBeat]);

    // Wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setPixelsPerBeat(prev => {
            const delta = e.deltaY > 0 ? -2 : 2;
            return Math.max(MIN_PX_PER_BEAT, Math.min(MAX_PX_PER_BEAT, prev + delta));
        });
    }, []);

    // Generate bar and beat markers
    const bars: { barNum: number; x: number }[] = [];
    const beats: { beatNum: number; x: number; isBar: boolean }[] = [];

    for (let beat = 0; beat <= totalBeats; beat++) {
        const x = beat * pixelsPerBeat;
        const isBar = beat % beatsPerBar === 0;
        beats.push({ beatNum: beat, x, isBar });

        if (isBar) {
            bars.push({ barNum: Math.floor(beat / beatsPerBar) + 1, x });
        }
    }

    const playheadX = position.absoluteBeat * pixelsPerBeat;

    return (
        <div className="flex flex-col select-none bg-zinc-900 border-b border-zinc-700">
            {/* Zoom controls */}
            <div className="flex items-center gap-3 px-3 py-1 bg-zinc-800/50 border-b border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Timeline</span>
                
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setPixelsPerBeat(p => Math.max(MIN_PX_PER_BEAT, p - 4))}
                        className="px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 text-[10px]"
                        title="Zoom out"
                    >
                        −
                    </button>
                    <input
                        type="range"
                        min={MIN_PX_PER_BEAT}
                        max={MAX_PX_PER_BEAT}
                        value={pixelsPerBeat}
                        onChange={e => setPixelsPerBeat(Number(e.target.value))}
                        className="w-24 h-1 cursor-pointer accent-blue-500"
                        title={`${pixelsPerBeat} px/beat`}
                    />
                    <button
                        onClick={() => setPixelsPerBeat(p => Math.min(MAX_PX_PER_BEAT, p + 4))}
                        className="px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 text-[10px]"
                        title="Zoom in"
                    >
                        +
                    </button>
                </div>

                <span className="text-[10px] text-zinc-600 font-mono ml-1">{pixelsPerBeat}px/beat</span>

                <div className="flex items-center gap-2 ml-auto text-[10px] text-zinc-500">
                    <span>{totalBeats} beats</span>
                    <span className="text-zinc-700">·</span>
                    <span>{Math.ceil(totalBeats / beatsPerBar)} bars</span>
                    <span className="text-zinc-700">·</span>
                    <span>{bpm} BPM</span>
                    <span className="text-zinc-700">·</span>
                    <span>{timeSig.numerator}/{timeSig.denominator}</span>
                </div>
            </div>

            {/* Ruler body */}
            <div
                ref={scrollRef}
                className="overflow-x-auto overflow-y-hidden"
                style={{ height: RULER_HEIGHT }}
                onWheel={handleWheel}
            >
                <div className="relative" style={{ width: totalWidth + 100, height: RULER_HEIGHT }}>
                    {/* Bar markers */}
                    {bars.map(({ barNum, x }) => (
                        <div
                            key={`bar-${barNum}`}
                            className="absolute top-0 bottom-0 flex flex-col items-start"
                            style={{ left: x }}
                        >
                            {/* Bold bar line */}
                            <div className="absolute top-0 bottom-0 w-px bg-zinc-500" />
                            {/* Bar number */}
                            <span className="absolute top-1 left-1 text-[10px] text-zinc-400 font-mono">
                                {barNum}
                            </span>
                        </div>
                    ))}

                    {/* Beat markers */}
                    {beats.filter(b => !b.isBar).map(({ beatNum, x }) => (
                        <div
                            key={`beat-${beatNum}`}
                            className="absolute top-0 bottom-0"
                            style={{ left: x }}
                        >
                            {/* Thin beat line */}
                            <div className="absolute top-3 bottom-0 w-px bg-zinc-700/50" />
                            {/* Beat label */}
                            <span className="absolute bottom-1 left-0.5 text-[8px] text-zinc-600 font-mono">
                                {beatNum}
                            </span>
                        </div>
                    ))}

                    {/* Beat grid background lines (for visual reference in work area context) */}
                    {beats.map(({ beatNum, x }) => (
                        <div
                            key={`grid-${beatNum}`}
                            className="absolute top-0 h-full w-px"
                            style={{ left: x }}
                        />
                    ))}

                    {/* Playhead cursor */}
                    <div
                        className="absolute top-0 bottom-0 z-20 pointer-events-none transition-[left] duration-75"
                        style={{ left: playheadX }}
                    >
                        {/* Triangle/arrow */}
                        <svg
                            width="10"
                            height="8"
                            viewBox="0 0 10 8"
                            className="absolute -top-px -translate-x-1/2"
                        >
                            <polygon points="5,0 0,8 10,8" fill="#facc15" />
                        </svg>
                        {/* Vertical cursor line (only within ruler) */}
                        <div className="absolute top-2 bottom-0 w-px bg-yellow-400" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineRuler;