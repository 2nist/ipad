// ═══════════════════════════════════════════════════════════════════
// DUAL POLYGON SVG — Rhythm time signature visualization
// Numerator shape + denominator overlay for time sig display
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import type { TimeSignature, RhythmShapeConfig } from '../../types';

export function rhythmShapeFromTimeSig(ts: TimeSignature): RhythmShapeConfig {
    const num = ts.numerator;
    const denom = ts.denominator;

    // Numerator: special case for 2 → square with split line
    const numVertices = num === 2 ? 4 : num;
    const numPoints = getPolygonPoints(numVertices);
    const hasSplitLine = num === 2;
    const splitLineType = hasSplitLine ? (denom === 2 ? "horizontal" as const : "diagonal" as const) : "none" as const;

    // Denominator overlay
    const denomVertices = denom === 2 ? 2 : denom === 4 ? 4 : denom === 8 ? 8 : 16;
    const denomPoints = getPolygonPoints(denomVertices);

    return {
        numerator: {
            vertices: numVertices,
            svgPoints: numPoints,
            splitLine: hasSplitLine,
            splitLineType,
        },
        denominator: {
            vertices: denomVertices,
            svgPoints: denomPoints,
            scale: denom === 2 ? 0.7 : denom === 4 ? 1.08 : denom === 8 ? 1.05 : 1.03,
        },
    };
}

function getPolygonPoints(vertices: number): string {
    const cx = 50, cy = 50, r = 40;
    const points: string[] = [];
    for (let i = 0; i < vertices; i++) {
        const angle = (Math.PI * 2 * i) / vertices - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(' ');
}

export const DualPolygonSVG: React.FC<{
    timeSignature?: TimeSignature;
    config?: RhythmShapeConfig;
    beatCount?: number;
    totalBeats?: number;
    busColor?: string;
    size?: number;
}> = ({ timeSignature, config, beatCount = 0, totalBeats = 4, busColor = '#ef4444', size = 80 }) => {
    const shapeConfig = config || (timeSignature ? rhythmShapeFromTimeSig(timeSignature) : null);
    if (!shapeConfig) return null;

    const progress = totalBeats > 0 ? (beatCount % totalBeats) / totalBeats : 0;

    return (
        <svg width={size} height={size} viewBox="0 0 100 100" className="transition-all duration-300">
            {/* Denominator polygon (faint overlay) */}
            <polygon
                points={shapeConfig.denominator.svgPoints}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                strokeDasharray="4,4"
                transform={`scale(${shapeConfig.denominator.scale}) translate(${50 * (1 - shapeConfig.denominator.scale) / shapeConfig.denominator.scale}, ${50 * (1 - shapeConfig.denominator.scale) / shapeConfig.denominator.scale})`}
            />

            {/* Numerator polygon (bold, colored) */}
            <polygon
                points={shapeConfig.numerator.svgPoints}
                fill="none"
                stroke={busColor}
                strokeWidth="2.5"
                strokeLinejoin="round"
                className="transition-all duration-300"
            />

            {/* Split line for 2/X time sigs */}
            {shapeConfig.numerator.splitLine && (
                <line
                    x1={shapeConfig.numerator.splitLineType === 'horizontal' ? 25 : 25}
                    y1={shapeConfig.numerator.splitLineType === 'horizontal' ? 50 : 25}
                    x2={shapeConfig.numerator.splitLineType === 'horizontal' ? 75 : 75}
                    y2={shapeConfig.numerator.splitLineType === 'horizontal' ? 50 : 75}
                    stroke={busColor}
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                />
            )}

            {/* Vertex markers */}
            {Array.from({ length: shapeConfig.numerator.vertices }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / shapeConfig.numerator.vertices - Math.PI / 2;
                const cx = 50 + 40 * Math.cos(angle);
                const cy = 50 + 40 * Math.sin(angle);
                return (
                    <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={i === Math.floor(beatCount % shapeConfig.numerator.vertices) ? busColor : 'rgba(255,255,255,0.3)'}
                        className="transition-all duration-150"
                    />
                );
            })}

            {/* Progress ring */}
            <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="2"
            />
            <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={busColor}
                strokeWidth="2"
                strokeDasharray={`${progress * 289} 289`}
                strokeLinecap="round"
                transform="rotate(-90, 50, 50)"
                className="transition-all duration-200"
                style={{ opacity: 0.7 }}
            />
        </svg>
    );
};

export default DualPolygonSVG;