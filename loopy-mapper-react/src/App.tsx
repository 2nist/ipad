import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CanvasToolbar } from './components/canvas/CanvasToolbar';
import { TimelineRuler } from './components/canvas/TimelineRuler';
import { SongCompositionCanvas } from './components/canvas/SongCompositionCanvas';
import { ModalManager } from './components/modals/ModalManager';
import { LeftNav } from './components/layout/LeftNav';
import { InfoPanel } from './components/layout/InfoPanel';
import { BottomToolbar } from './components/layout/BottomToolbar';
import ClipBrowser from './components/browser/ClipBrowser';
import DrumKitBrowser from './components/browser/DrumKitBrowser';
import { SectionTimeline } from './components/canvas/SectionTimeline';
import { MidiSequencerPanel } from './components/editor/MidiSequencerPanel';
import { useLooperStore } from './store/store';

function App() {
  const clipBrowserOpen = useLooperStore(s => s.ui.clipBrowserOpen);
  const midiEditorOpen = useLooperStore(s => s.ui.midiEditorOpen);
  const drumBrowserOpen = useLooperStore(s => s.ui.drumBrowserOpen);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        {/* Top Bar */}
        <CanvasToolbar />

        {/* Timeline Ruler — full width */}
        <TimelineRuler />

        {/* Section Timeline — full width strip between ruler and canvas */}
        <div className="border-b border-zinc-700 py-1.5 px-1 bg-zinc-900/50 flex-shrink-0">
          <SectionTimeline />
        </div>

        {/* Canvas fills the full area. Sidebars float on top. */}
        <div className="flex-1 relative overflow-hidden">
          {/* Full-bleed canvas — always fills the entire area */}
          <div className="absolute inset-0">
            <SongCompositionCanvas />
          </div>

          {/* Left nav — floats over canvas, passes clicks through to canvas */}
          <div className="absolute left-0 top-0 bottom-0 z-20 pointer-events-none">
            <div className="pointer-events-auto h-full">
              <LeftNav />
            </div>
          </div>

          {/* Clip Browser Panel — slides in from left when opened */}
          {clipBrowserOpen && (
            <div className="absolute left-12 top-0 bottom-0 w-96 max-w-[80vw] z-30 bg-zinc-950 border-r border-zinc-800 shadow-2xl">
              <ClipBrowser />
            </div>
          )}

          {/* Drum Kit Browser — slides in from right */}
          {drumBrowserOpen && (
            <div className="absolute right-0 top-0 bottom-0 w-96 max-w-[50vw] z-30 bg-zinc-950 border-l border-zinc-800 shadow-2xl">
              <DrumKitBrowser />
            </div>
          )}

          {/* Right panel — floats over canvas */}
          {!drumBrowserOpen && (
            <div className="absolute right-0 top-0 bottom-0 z-20 pointer-events-none">
              <div className="pointer-events-auto h-full">
                <InfoPanel />
              </div>
            </div>
          )}
        </div>

        {/* MIDI Sequencer — slides up from bottom */}
        {midiEditorOpen && <MidiSequencerPanel />}

        {/* Bottom Toolbar */}
        <BottomToolbar />

        {/* Modals render on top */}
        <ModalManager />
      </div>
    </DndProvider>
  );
}

export default App;
