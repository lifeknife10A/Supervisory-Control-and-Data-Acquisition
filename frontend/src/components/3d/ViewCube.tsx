import React from 'react';
import { Compass, Eye, Grid } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface ViewCubeProps {
  onSetCamera: (preset: 'top' | 'front' | 'iso') => void;
  showTelemetry?: boolean;
}

export const ViewCube: React.FC<ViewCubeProps> = ({ onSetCamera, showTelemetry }) => {
  const cameraView = useWorkbenchStore((s) => s.cameraView);

  return (
    <div
      className={`hidden md:flex absolute top-24 z-10 pointer-events-auto bg-white/95 backdrop-blur-md border border-gray-200 p-2 rounded-xl shadow-md flex-col space-y-1.5 text-xs text-slate-700 select-none transition-all duration-300 ${
        showTelemetry ? 'left-88' : 'left-4'
      }`}
    >
      <div className="flex items-center space-x-1.5 px-1 pb-1 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        <Compass className="w-3 h-3 text-sky-600" />
        <span>View</span>
      </div>

      <div className="grid grid-cols-2 gap-1 w-28">
        <button
          onClick={() => onSetCamera('top')}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 ${
            cameraView === 'top'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
          }`}
          title="Top-Down 2D Wiring View (Tinkercad Schematic)"
        >
          <Grid className="w-3 h-3" />
          <span>TOP</span>
        </button>

        <button
          onClick={() => onSetCamera('front')}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 ${
            cameraView === 'front'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
          }`}
          title="Front Level View"
        >
          <Eye className="w-3 h-3" />
          <span>FRONT</span>
        </button>

        <button
          onClick={() => onSetCamera('iso')}
          className={`col-span-2 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 ${
            cameraView === 'iso'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
          }`}
          title="3D Isometric Perspective"
        >
          <span>3D PERSPECTIVE</span>
        </button>
      </div>
    </div>
  );
};
