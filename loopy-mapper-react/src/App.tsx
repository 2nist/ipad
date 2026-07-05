import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CanvasToolbar } from './components/canvas/CanvasToolbar';
import { SongCompositionCanvas } from './components/canvas/SongCompositionCanvas';
import { ModalManager } from './components/modals/ModalManager';
import { LeftNav } from './components/layout/LeftNav';
import { InfoPanel } from './components/layout/InfoPanel';
import { BottomToolbar } from './components/layout/BottomToolbar';

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        {/* Top Bar */}
        <CanvasToolbar />

        {/* Middle: Left Nav + Canvas + Right Panel */}
        <div className="flex flex-1 overflow-hidden">
          <LeftNav />
          <div className="flex-1 overflow-auto">
            <SongCompositionCanvas />
          </div>
          <InfoPanel />
        </div>

        {/* Bottom Toolbar */}
        <BottomToolbar />

        {/* Modals render on top */}
        <ModalManager />
      </div>
    </DndProvider>
  );
}

export default App;