"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "../../lib/shadcn";

// Maps beat lengths to SVG polygon points within a 100x100 viewing box
const SHAPE_MAP: Record<number, string> = {
    4: "25,25 75,25 75,75 25,75",
    6: "50,15 85,35 85,75 50,95 15,75 15,35",
    8: "30,15 70,15 90,35 90,75 70,95 30,95 10,75 10,35",
};

// Relative coordinates for the 6 outer scale vertices surrounding a central root
const HEX_VERTICES = [
    { degree: 2, label: "ii", x: 50, y: 15 },
    { degree: 3, label: "iii", x: 80, y: 32 },
    { degree: 4, label: "IV", x: 80, y: 68 },
    { degree: 5, label: "V", x: 50, y: 85 },
    { degree: 6, label: "vi", x: 20, y: 68 },
    { degree: 7, label: "vii°", x: 20, y: 32 },
];

export default function GeometricMusicCard() {
    const [activeBeats, setActiveBeats] = useState<4 | 6 | 8>(8);
    const [relationMode, setRelationMode] = useState<"harmonic" | "rhythm" | "arrangement">("harmonic");
    const [selectedDegree, setSelectedDegree] = useState<string | number>("I");

    const getColorStyle = () => {
        if (relationMode === "harmonic") return "stroke-blue-500 text-blue-400 border-blue-500/30 bg-blue-500/5";
        if (relationMode === "rhythm") return "stroke-red-500 text-red-400 border-red-500/30 bg-red-500/5";
        return "stroke-green-500 text-green-400 border-green-500/30 bg-green-500/5";
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span>Spatial Object Visualizer</span>
                    <div className="flex gap-1.5">
                        {(["harmonic", "rhythm", "arrangement"] as const).map((mode) => (
                            <Badge
                                key={mode}
                                variant={relationMode === mode ? "default" : "outline"}
                                className={`cursor-pointer transition-colors ${relationMode === mode
                                        ? mode === "harmonic" ? "bg-blue-500" : mode === "rhythm" ? "bg-red-500" : "bg-green-500"
                                        : ""
                                    }`}
                                onClick={() => setRelationMode(mode)}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </Badge>
                        ))}
                    </div>
                </CardTitle>
                <CardDescription>Time-to-shape nodes compiled directly from your SETLE data schemas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* 1. Rhythmic Phrase Card Node */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/10 relative h-64">
                        <span className="text-xs font-mono text-muted-foreground absolute top-3 left-3">RHYTHMIC LOOP</span>

                        <svg className="w-40 h-40" viewBox="0 0 100 100">
                            <polygon
                                points={SHAPE_MAP[activeBeats]}
                                className={`fill-none stroke-2 transition-all duration-300 ${getColorStyle().split(" ")[0]}`}
                            />
                            {SHAPE_MAP[activeBeats].split(" ").map((pt, idx) => {
                                const [x, y] = pt.split(",");
                                return <circle key={idx} cx={x} cy={y} r="3" className="fill-foreground stroke-background stroke-1" />;
                            })}
                        </svg>

                        <div className="flex gap-2 mt-4 absolute bottom-3">
                            {[4, 6, 8].map((b) => (
                                <button
                                    key={b}
                                    onClick={() => setActiveBeats(b as 4 | 6 | 8)}
                                    className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${activeBeats === b ? "bg-foreground text-background" : "bg-card text-muted-foreground border-border"
                                        }`}
                                >
                                    {b} Beats ({b === 4 ? "Square" : b === 6 ? "Hex" : "Oct"})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Diatonic Space Hexagon Node */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/10 relative h-64">
                        <span className="text-xs font-mono text-muted-foreground absolute top-3 left-3">DIATONIC MATRIX</span>

                        <div className="w-44 h-44 relative mt-2">
                            {/* Core Root Node */}
                            <button
                                onClick={() => setSelectedDegree("I")}
                                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border flex flex-col items-center justify-center font-bold text-sm shadow-md transition-all z-10 ${selectedDegree === "I"
                                        ? "bg-foreground text-background border-foreground scale-105"
                                        : "bg-card border-border text-foreground hover:border-ring"
                                    }`}
                            >
                                <span className="text-[10px] opacity-60 font-normal">Root</span>
                                I
                            </button>

                            {/* Surrounding scale degree vertices */}
                            {HEX_VERTICES.map((node) => (
                                <button
                                    key={node.degree}
                                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                    onClick={() => setSelectedDegree(node.degree)}
                                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-md border text-xs font-mono font-bold flex items-center justify-center shadow-sm transition-all ${selectedDegree === node.degree
                                            ? "bg-ring border-ring text-ring-foreground scale-105"
                                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-ring"
                                        }`}
                                >
                                    {node.label}
                                </button>
                            ))}

                            {/* Background web lines */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                                <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" className="stroke-muted/30 stroke-1 fill-none" />
                                {HEX_VERTICES.map((v, i) => (
                                    <line key={i} x1="50" y1="50" x2={v.x} y2={v.y} className="stroke-muted/30 stroke-1" />
                                ))}
                            </svg>
                        </div>

                        <span className="text-[11px] font-mono text-muted-foreground absolute bottom-3">
                            Degree: <span className="text-foreground font-bold">{selectedDegree}</span>
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}