"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button, Slider, ToggleGroup } from "../../lib/shadcn";
import { Play, RotateCw, GitMerge, Layers, Sliders, ArrowRightLeft } from "lucide-react";

interface LinkedPart {
    id: string;
    name: string;
    type: "harmonic" | "rhythm" | "arrangement";
    shape: string;
    bus: "Blue" | "Red" | "Green";
    active: boolean;
}

export default function MasterArrangerConductor() {
    const [bpm, setBpm] = useState([120]);
    const [timeSig, setTimeSig] = useState({ num: 4, denom: 4 });
    const [transitionMode, setTransitionMode] = useState<"Instant" | "NextBar" | "Fade">("NextBar");
    const [activeSection, setActiveSection] = useState("Verse");

    const beatsPerBar = timeSig.num * (4 / timeSig.denom);

    const [linkedParts, setLinkedParts] = useState<LinkedPart[]>([
        { id: "P1", name: "Tegridy Pad", type: "harmonic", shape: "Hexagon", bus: "Blue", active: true },
        { id: "P2", name: "e-gmd Groove", type: "rhythm", shape: "Octagon", bus: "Red", active: true },
        { id: "P3", name: "Bus Director", type: "arrangement", shape: "Square", bus: "Green", active: false },
    ]);

    const togglePartLinkage = (id: string) => {
        setLinkedParts((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
    };

    const busColor = (bus: string) => {
        if (bus === "Blue") return "bg-blue-500";
        if (bus === "Red") return "bg-red-500";
        return "bg-green-500";
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 p-4">
            {/* CENTRALIZED ARRANGEMENT CONDUCTOR */}
            <Card className="border-green-500/20">
                <CardHeader className="border-b border-border/50 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-green-500" />
                                Master Arrangement Conductor
                            </CardTitle>
                            <CardDescription>
                                Coordinates transition queues and links timeline structures down to slave part cards.
                            </CardDescription>
                        </div>

                        <ToggleGroup
                            options={["Intro", "Verse", "Chorus", "Bridge"].map((s) => ({ value: s, label: s }))}
                            value={activeSection}
                            onChange={setActiveSection}
                        />
                    </div>
                </CardHeader>

                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                    {/* Column 1: Time & Transport Dynamics */}
                    <div className="space-y-4">
                        <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">Time & Metric Engine</div>
                        <div className="p-3 bg-muted/30 border rounded-xl space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Global Tempo:</span>
                                <span className="font-mono font-bold">{bpm[0]} BPM</span>
                            </div>
                            <Slider value={bpm} onValueChange={setBpm} min={60} max={200} step={1} />
                            <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                                <span className="text-muted-foreground">Metric Signature:</span>
                                <div className="flex gap-1">
                                    <Badge
                                        variant={timeSig.num === 4 && timeSig.denom === 4 ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => setTimeSig({ num: 4, denom: 4 })}
                                    >
                                        4/4
                                    </Badge>
                                    <Badge
                                        variant={timeSig.num === 6 && timeSig.denom === 8 ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => setTimeSig({ num: 6, denom: 8 })}
                                    >
                                        6/8
                                    </Badge>
                                </div>
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground text-center bg-background/50 py-1 rounded border border-border/30">
                                Calculated Beat Phrase: {beatsPerBar} Pulses / Bar
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Transition Linkage Controls */}
                    <div className="space-y-4">
                        <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">Transition Matrix</div>
                        <div className="p-3 bg-muted/30 border rounded-xl space-y-2">
                            {[
                                { mode: "Instant" as const, desc: "Hard break immediately on interaction" },
                                { mode: "NextBar" as const, desc: "Wait for calculated bar line crossover" },
                                { mode: "Fade" as const, desc: "Crossfade audio channels via multi-bus" },
                            ].map((item) => (
                                <div
                                    key={item.mode}
                                    onClick={() => setTransitionMode(item.mode)}
                                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${transitionMode === item.mode
                                            ? "border-green-500 bg-green-500/5"
                                            : "border-border bg-card/40 text-muted-foreground hover:border-ring"
                                        }`}
                                >
                                    <div className="text-xs font-bold flex items-center gap-1.5">
                                        <ArrowRightLeft className="w-3 h-3 text-green-400" />
                                        {item.mode}
                                    </div>
                                    <div className="text-[10px] opacity-80 mt-0.5 leading-tight">{item.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 3: Active Routing & Linkage Graph */}
                    <div className="space-y-4">
                        <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">Slave Card Linkages</div>
                        <div className="space-y-2">
                            {linkedParts.map((part) => (
                                <div
                                    key={part.id}
                                    onClick={() => togglePartLinkage(part.id)}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${part.active ? "border-foreground bg-ring/20" : "border-border bg-muted/10 opacity-50"
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${busColor(part.bus)}`} />
                                        <div>
                                            <div className="text-xs font-bold">{part.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">
                                                {part.shape} Engine ({part.type})
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant={part.active ? "default" : "outline"} className="text-[9px] px-1 py-0 font-mono">
                                        {part.active ? "LINKED" : "BYPASS"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* SLAVE PART CARD PREVIEW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {linkedParts
                    .filter((p) => p.active)
                    .map((part) => (
                        <Card key={part.id} className="border-border bg-card/60 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${busColor(part.bus)}`} />
                            <CardContent className="p-3.5 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold tracking-tight">{part.name}</span>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {part.shape}
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-normal">
                                    Synchronized to{" "}
                                    <span className="font-bold font-mono">{activeSection}</span> timeline. Awaiting transition via{" "}
                                    <span className="text-green-400 font-medium font-mono">{transitionMode}</span> processing hook.
                                </p>
                            </CardContent>
                        </Card>
                    ))}
            </div>
        </div>
    );
}