## Refined Rhythm Shape System — Dual Polygon Overlay

### The Denominator Polygon Rule

Every rhythm card gets TWO polygons overlaid on the same SVG viewBox:

```
┌──────────────────────────────────────────────┐
│  NUMERATOR SHAPE (bold, colored, active)     │
│  ──────────────────────────────────────────  │
│  Number of vertices = numerator              │
│  (with the 2→4 exception below)              │
│  Stroke: 2px, bus color, solid               │
│                                              │
│  +                                           │
│                                              │
│  DENOMINATOR SHAPE (faint, overlaid)         │
│  ──────────────────────────────────────────  │
│  Number of vertices = denominator            │
│  Stroke: 1px, 15% opacity white/gray, dashed │
│  Slightly scaled up (105-110%) to contain    │
│  the numerator shape                         │
└──────────────────────────────────────────────┘
```

### The 2→4 Exception

Time signatures with numerator=2 render as a **square with a dividing line** — visually communicating "cut in half." The line bisects the square either vertically or diagonally.

```
  2/4                     2/2
┌──────────┐          ┌──────────┐
│    ╲     │          │    ──    │
│     ╲    │          │    ──    │
│      ╲   │          │    ──    │
│       ╲  │          │    ──    │
└──────────┘          └──────────┘
  4 vertices +         4 vertices +
  diagonal cut         horizontal split line
```

This way 2/4 is visually distinct from 4/4 (which has no dividing line), and the denominator overlay further differentiates 2/4 from 2/2.

### Complete Visual Mapping Table

| Time Sig | Numerator Shape | Vertices | Denominator Overlay | Vertices | Visual |
|---|---|---|---|---|---|
| 2/2 | Square + split line | 4 | Faint digon (2 dots) | 2 | Square with horizontal cut, 2 faint dots at poles |
| 2/4 | Square + split line | 4 | Faint square | 4 | Square with diagonal cut, faint square overlaid |
| 3/4 | Triangle | 3 | Faint square | 4 | Triangle inside faint square — waltz visible |
| 3/8 | Triangle | 3 | Faint octagon | 8 | Triangle inside faint octagon |
| 4/4 | Square | 4 | Faint square | 4 | Clean nested squares — most common |
| 5/4 | Pentagon | 5 | Faint square | 4 | Odd pentagon over common square grid |
| 5/8 | Pentagon | 5 | Faint octagon | 8 | Pentagon inside complex octagon |
| 6/8 | Hexagon | 6 | Faint octagon | 8 | Compound duple — hexagon in octagon |
| 7/4 | Heptagon | 7 | Faint square | 4 | Odd heptagon over square grid |
| 7/8 | Heptagon | 7 | Faint octagon | 8 | Prog rock classic |
| 9/8 | Nonagon | 9 | Faint octagon | 8 | Compound triple — 9 over 8 |
| 12/8 | Dodecagon | 12 | Faint octagon | 8 | Blues shuffle — dodecagon in octagon |

**Observation:** The denominator overlay makes odd numerators pop. 5/4 (pentagon over square) looks fundamentally different from 4/4 (square over square) in a way that's recognizable at a glance.

### Denominator Shape Map

```typescript
function denominatorShape(denom: TimeSignatureDenominator): {
    vertices: number;
    points: string;  // SVG points string for a 100×100 viewBox
    scale: number;   // Scale factor relative to numerator shape
} {
    switch (denom) {
        case 2:
            return {
                vertices: 2,
                points: "50,5 50,95",  // Vertical line segment (2 endpoints)
                scale: 0.7             // Smaller, just two dots
            };
        case 4:
            return {
                vertices: 4,
                points: "25,25 75,25 75,75 25,75",  // Square
                scale: 1.08
            };
        case 8:
            return {
                vertices: 8,
                points: "30,10 70,10 90,30 90,70 70,90 30,90 10,70 10,30",  // Octagon
                scale: 1.05
            };
        case 16:
            return {
                vertices: 16,
                points: "50,6 65,9 78,16 88,27 94,41 96,57 94,72 88,84 78,93 65,98 50,100 35,98 22,93 12,84 6,72 4,57 6,41 12,27 22,16 35,9",
                scale: 1.03  // Nearly circular
            };
    }
}
```

For the 2→4 numerator exception:

```typescript
function numeratorShape(num: TimeSignatureNumerator): {
    vertices: number;
    points: string;
    hasSplitLine: boolean;
    splitLineType: "none" | "diagonal" | "horizontal";
} {
    if (num === 2) {
        return {
            vertices: 4,
            points: "25,25 75,25 75,75 25,75",  // Square (same as 4)
            hasSplitLine: true,
            splitLineType: "diagonal"  // for 2/4; switch to "horizontal" for 2/2
        };
    }
    // ... rest of the mapping from earlier
}
```

### Updated Shape Types

```typescript
type TimeSignatureNumerator = 2 | 3 | 4 | 5 | 6 | 7 | 9 | 12;
type TimeSignatureDenominator = 2 | 4 | 8 | 16;

interface RhythmShapeConfig {
    /** Numerator polygon — bold, colored */
    numerator: {
        vertices: number;
        points: string;          // SVG polygon points
        hasSplitLine: boolean;   // true only when numerator === 2
        splitLineType: "none" | "diagonal" | "horizontal";
    };
    /** Denominator polygon — faint overlay */
    denominator: {
        vertices: number;
        points: string;
        scale: number;           // 1.05-1.08, slightly larger to contain numerator
    };
}

/** Derives the dual-polygon config from a time signature */
function rhythmShapeFromTimeSig(ts: TimeSignature): RhythmShapeConfig {
    // ... implementation using the maps above
}
```

### What This Adds to the Domain Types

One new type and one updated type:

```typescript
// ADD to types:
interface RhythmShapeConfig {
    numerator: {
        vertices: number;
        svgPoints: string;
        splitLine: boolean;
        splitLineType: "none" | "diagonal" | "horizontal";
    };
    denominator: {
        vertices: number;
        svgPoints: string;
        scale: number;
    };
}

// UPDATE TimeSignatureDenominator — was 2|4|8|16, but /1 and /32 are edge cases.
// Correct musical range is /2 through /16.
type TimeSignatureDenominator = 2 | 4 | 8 | 16;  // unchanged, already correct
```

The `ModuleCard` already has a `readonly shape: RhythmShape` derived property. This evolves to:

```typescript
interface ModuleCard {
    // ... existing fields ...
    readonly shapeConfig: RhythmShapeConfig;  // Derived from sync.timeSignature
}
```

The `shapeConfig` is derived, not stored. When the user changes time signature in the editor, the config recalculates and the SVG re-renders with the dual-polygon overlay.

### Visual Rendering Order (SVG)

```
1. Denominator polygon   — faint, dashed, 15% opacity, slightly larger
2. Numerator polygon     — solid, 2px, bus-colored, normal size
3. Split line (if 2/x)  — same style as numerator, bisects the square
4. Vertex markers        — small circles at numerator vertices
5. Progress ring/arc     — fills as beats advance through the loop
6. Beat indicator        — pulsing vertex at current beat position
```

This layered approach makes even unusual time signatures (5/8, 7/8, 9/8) immediately legible — the odd numerator polygon stands out against the regular denominator grid. And 2/4 vs 4/4 is unmistakable because of the dividing line.

---

Does this refined shape system capture what you were envisioning? If so, I can fold this into the complete type definitions and we can proceed to creating the final `src/types/index.ts` file.