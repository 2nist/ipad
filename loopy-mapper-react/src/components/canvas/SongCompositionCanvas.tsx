// ═══════════════════════════════════════════════════════════════════
// SONG COMPOSITION CANVAS — Infinite 2D pan/zoom work area
// Modules are placed absolutely on the canvas and can be dragged.
// Mouse drag on empty space pans the canvas. Wheel zooms.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLooperStore } from '../../store/store';
import { useEngineInitialization } from '../../hooks/useEngineInitialization';
import { ModuleCardRenderer } from '../modules/ModuleCardRenderer';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const DEFAULT_ZOOM = 1;

// Mouse position at drag-start, plus (for module drags only) the module's
// own canvasPosition at that moment — needed to compute the new position
// as an offset from where the module started, not from the canvas origin.
type DragStart = { x: number; y: number; moduleStartX?: number; moduleStartY?: number };

export const SongCompositionCanvas: React.FC = () => {
    const modules = useLooperStore(s => s.song.modules);
    const { initialized: engineReady, initialize } = useEngineInitialization();
    const lockSize = useLooperStore(s => s.ui.canvasLockSize);
    const lockPosition = useLooperStore(s => s.ui.canvasLockPosition);
    const bothLocked = lockSize && lockPosition;

    // Canvas state
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [draggingModule, setDraggingModule] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<DragStart>({ x: 0, y: 0 });
    const [panning, setPanning] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Initialize audio on the FIRST user gesture, not on mount. Browsers block
    // AudioContext.start() until a gesture, so mount-time init left the context
    // suspended — which made the AudioWorklet loop tracks fail to construct
    // ("no usable AudioContext") and spammed autoplay warnings. Arm one-time
    // pointer/key listeners so init runs inside a real gesture. The "Enable
    // Sound" banner button below is the explicit fallback.
    useEffect(() => {
        if (engineReady) return;

        let done = false;
        const kick = () => {
            if (done) return;
            done = true;
            initialize().catch(() => {
                console.log('[Canvas] Audio init failed');
            });
        };

        window.addEventListener('pointerdown', kick, { once: true });
        window.addEventListener('keydown', kick, { once: true });
        return () => {
            window.removeEventListener('pointerdown', kick);
            window.removeEventListener('keydown', kick);
        };
    }, [engineReady, initialize]);

    // Wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setZoom(prev => {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));

            // Zoom toward mouse position
            setOffset(off => ({
                x: mouseX - (mouseX - off.x) * (newZoom / prev),
                y: mouseY - (mouseY - off.y) * (newZoom / prev),
            }));

            return newZoom;
        });
    }, []);

    // Canvas pan (middle-mouse or empty-space drag)
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only pan on empty canvas (not on module cards)
        if ((e.target as HTMLElement).closest('[data-module-card]')) return;
        setPanning(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        (e.target as HTMLElement).style.cursor = 'grabbing';
    }, [offset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        // Module dragging
        if (draggingModule) {
            const dx = (e.clientX - dragStart.x) / zoom;
            const dy = (e.clientY - dragStart.y) / zoom;
            useLooperStore.getState().updateModule(draggingModule, {
                canvasPosition: {
                    x: (dragStart.moduleStartX ?? 0) + dx,
                    y: (dragStart.moduleStartY ?? 0) + dy,
                },
            });
            return;
        }

        // Canvas panning
        if (panning) {
            setOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [draggingModule, panning, dragStart, zoom]);

    const handleMouseUp = useCallback(() => {
        setPanning(false);
        setDraggingModule(null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }, []);

    // Module drag handlers (respect lock state)
    const startDragModule = useCallback((moduleId: string, e: React.MouseEvent) => {
        if (lockPosition || bothLocked) return;
        e.stopPropagation();
        const mod = modules.find(m => m.id === moduleId);
        const pos = mod?.canvasPosition || { x: 0, y: 0 };
        setDraggingModule(moduleId);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            moduleStartX: pos.x,
            moduleStartY: pos.y,
        });
    }, [modules, lockPosition, bothLocked]);

    // Filter out arrangement modules (shown in sidebar)
    const soundModules = modules.filter(m => m.type !== 'arrangement');

    return (
        <div className="absolute inset-0 flex flex-col bg-zinc-950 text-white">
            {/* Audio init banner */}
            {!engineReady && (
                <div className="flex items-center justify-center py-1.5 bg-amber-900/40 border-b border-amber-700/30 text-[11px] text-amber-300 flex-shrink-0">
                    <span>Audio is not initialized.</span>
                    <button
                        onClick={() => initialize()}
                        className="ml-2 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-medium"
                    >
                        Enable Sound
                    </button>
                </div>
            )}

            {/* Lock indicator */}
            {bothLocked && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 text-[10px] text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded pointer-events-none border border-amber-700/30">
                    🔒 Canvas Locked
                </div>
            )}
            {lockPosition && !bothLocked && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 text-[10px] text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded pointer-events-none border border-amber-700/20">
                    ↕ Position Locked
                </div>
            )}
            {lockSize && !bothLocked && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 text-[10px] text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded pointer-events-none border border-amber-700/20">
                    ⊡ Size Locked
                </div>
            )}

            {/* Zoom indicator */}
            <div className="absolute bottom-12 right-4 z-30 text-[10px] text-zinc-600 bg-zinc-900/80 px-1.5 py-0.5 rounded pointer-events-none">
                {Math.round(zoom * 100)}%
            </div>

            {/* Infinite canvas */}
            <div
                ref={canvasRef}
                className="flex-1 overflow-hidden relative"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ cursor: panning ? 'grabbing' : draggingModule ? 'grabbing' : 'grab' }}
            >
                {/* Infinite grid — faint lines that scroll with pan */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        inset: 0,
                        backgroundImage: `
                            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
                        `,
                        backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
                        backgroundPosition: `${offset.x % (30 * zoom)}px ${offset.y % (30 * zoom)}px`,
                    }}
                />
                {/* Major grid lines every 5 squares */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        inset: 0,
                        backgroundImage: `
                            linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)
                        `,
                        backgroundSize: `${150 * zoom}px ${150 * zoom}px`,
                        backgroundPosition: `${offset.x % (150 * zoom)}px ${offset.y % (150 * zoom)}px`,
                    }}
                />

                {/* Module cards — absolutely positioned */}
                {soundModules.map(module => {
                    const pos = module.canvasPosition || { x: 0, y: 0 };
                    return (
                        <div
                            key={module.id}
                            data-module-card
                            className="absolute"
                            style={{
                                left: pos.x * zoom + offset.x,
                                top: pos.y * zoom + offset.y,
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                            }}
                        >
                            {/* Drag handle — shows different cursor when locked */}
                            <div
                                className={lockPosition || bothLocked
                                    ? 'cursor-default'
                                    : 'cursor-grab active:cursor-grabbing'}
                                onMouseDown={(e) => startDragModule(module.id, e)}
                            >
                                <ModuleCardRenderer module={module} />
                            </div>
                        </div>
                    );
                })}

                {/* Empty state */}
                {soundModules.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 pointer-events-none">
                        <div className="text-4xl mb-4">🎵</div>
                        <h2 className="text-lg font-semibold mb-2">Empty Canvas</h2>
                        <p className="text-sm text-zinc-500 text-center max-w-xs">
                            Add modules from the left sidebar to start building.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SongCompositionCanvas;