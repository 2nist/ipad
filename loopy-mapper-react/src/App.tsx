import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CanvasToolbar } from './components/canvas/CanvasToolbar';
import { SongCompositionCanvas } from './components/canvas/SongCompositionCanvas';

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <CanvasToolbar />
        <SongCompositionCanvas />
      </div>
    </DndProvider>
  );
}

export default App;