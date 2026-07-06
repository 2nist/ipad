// ═══════════════════════════════════════════════════════════════════
// PLAYHEAD OVERLAY — Current position indicator on the timeline
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';

export const PlayheadOverlay: React.FC = () => {
    const isPlaying = useLooperStore(s => s.transport.isPlaying);
    const position = useLooperStore(s => s.transport.position);
    const sections = useLooperStore(s => s.song.arrangement);
    const activeSectionIndex = useLooperStore(s => s.transport.activeSectionIndex);
    const timeSig = useLooperStore(s => s.song.metadata.timeSignature);

    // Must match SectionTimeline's block sizing (`section.bars * 20 + 20`), or the
    // playhead visibly drifts away from the section blocks it's supposed to sit on.
    const PX_PER_BAR = 20;
    const SECTION_GAP = 20;

    // Calculate playhead horizontal position based on section + bar
    const playheadPercent = React.useMemo(() => {
        if (sections.length === 0) return 0;

        // Sum up the width of all sections before the active one
        let offset = 0;
        for (let i = 0; i < activeSectionIndex; i++) {
            offset += sections[i].bars * PX_PER_BAR + SECTION_GAP;
        }

        // Add position within current section
        if (sections[activeSectionIndex]) {
            const beatsPerBar = timeSig.numerator * (4 / timeSig.denominator);
            const barProgress = position.beatInBar / beatsPerBar;
            offset += barProgress * PX_PER_BAR;
        }

        return offset;
    }, [sections, activeSectionIndex, position, timeSig]);

    if (!isPlaying && sections.length === 0) return null;

    return (
        <>
            {/* Playhead line */}
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20 pointer-events-none transition-all duration-75"
                style={{ left: `${playheadPercent}px` }}
            >
                {/* Playhead head */}
                <div className="w-3 h-3 bg-yellow-400 rounded-full -ml-[5px] -mt-1" />
            </div>

            {/* Position info badge */}
            {isPlaying && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-6 bg-yellow-400/20 text-yellow-300 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                    Bar {position.barInSection + 1} · Beat {Math.floor(position.beatInBar) + 1}
                    {position.sectionId && ` · ${sections.find(s => s.id === position.sectionId)?.name || ''}`}
                </div>
            )}
        </>
    );
};

export default PlayheadOverlay;