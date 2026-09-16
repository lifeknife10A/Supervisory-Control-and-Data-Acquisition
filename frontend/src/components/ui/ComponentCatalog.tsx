import React, { useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Check
} from 'lucide-react';
import { useWorkbenchStore, COMPONENT_CATALOG } from '../../store/workbenchStore';
import type { WorkbenchComponent } from '../../types/workbench';

const CATEGORIES = [
  { id: 'all', label: 'Basic' },
  { id: 'mcu', label: 'Microcontrollers & Boards', types: ['esp32', 'breadboard'] },
  { id: 'sensors', label: 'Sensors', types: ['hc_sr04', 'ds18b20', 'mq2', 'acs712'] },
  { id: 'actuators', label: 'Actuators', types: ['relay', 'pump', 'fan'] },
  { id: 'output', label: 'Displays & Passives', types: ['lcd_1602', 'led_green', 'led_red', 'resistor'] },
];

// Realistic Tinkercad-styled SVG component representations
const ComponentThumbnail: React.FC<{ type: WorkbenchComponent['type'] }> = ({ type }) => {
  switch (type) {
    case 'breadboard':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="2" y="4" width="60" height="40" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="8" y1="9" x2="56" y2="9" stroke="#ef4444" strokeWidth="1" />
          <line x1="8" y1="13" x2="56" y2="13" stroke="#2563eb" strokeWidth="1" />
          <rect x="6" y="22" width="52" height="4" fill="#cbd5e1" />
          <line x1="8" y1="35" x2="56" y2="35" stroke="#2563eb" strokeWidth="1" />
          <line x1="8" y1="39" x2="56" y2="39" stroke="#ef4444" strokeWidth="1" />
          <circle cx="16" cy="18" r="1" fill="#334155" />
          <circle cx="24" cy="18" r="1" fill="#334155" />
          <circle cx="32" cy="18" r="1" fill="#334155" />
          <circle cx="40" cy="18" r="1" fill="#334155" />
          <circle cx="48" cy="18" r="1" fill="#334155" />
          <circle cx="16" cy="30" r="1" fill="#334155" />
          <circle cx="24" cy="30" r="1" fill="#334155" />
          <circle cx="32" cy="30" r="1" fill="#334155" />
          <circle cx="40" cy="30" r="1" fill="#334155" />
          <circle cx="48" cy="30" r="1" fill="#334155" />
        </svg>
      );
    case 'esp32':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="14" y="2" width="36" height="44" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
          <rect x="19" y="5" width="26" height="20" rx="1.5" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="0.8" />
          <path d="M 23 29 L 41 29 L 41 37 L 23 37 Z" fill="#0f172a" />
          {/* Pins on side */}
          <line x1="11" y1="8" x2="14" y2="8" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="11" y1="16" x2="14" y2="16" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="11" y1="24" x2="14" y2="24" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="11" y1="32" x2="14" y2="32" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="11" y1="40" x2="14" y2="40" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="50" y1="8" x2="53" y2="8" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="50" y1="16" x2="53" y2="16" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="50" y1="24" x2="53" y2="24" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="50" y1="32" x2="53" y2="32" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="50" y1="40" x2="53" y2="40" stroke="#f59e0b" strokeWidth="1.5" />
        </svg>
      );
    case 'hc_sr04':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="6" y="10" width="52" height="28" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
          <circle cx="21" cy="24" r="9" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
          <circle cx="21" cy="24" r="5" fill="#334155" />
          <circle cx="43" cy="24" r="9" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
          <circle cx="43" cy="24" r="5" fill="#334155" />
          <line x1="26" y1="38" x2="26" y2="44" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="30" y1="38" x2="30" y2="44" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="34" y1="38" x2="34" y2="44" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="38" y1="38" x2="38" y2="44" stroke="#f59e0b" strokeWidth="1.5" />
        </svg>
      );
    case 'ds18b20':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="8" y="20" width="28" height="8" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
          <path d="M 36 24 C 44 24, 48 16, 56 16" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="10" cy="24" r="3" fill="#94a3b8" />
        </svg>
      );
    case 'mq2':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="12" y="10" width="40" height="30" rx="2" fill="#047857" stroke="#065f46" strokeWidth="1" />
          <circle cx="32" cy="25" r="11" fill="#94a3b8" stroke="#64748b" strokeWidth="2" />
          <circle cx="32" cy="25" r="7" fill="#cbd5e1" />
        </svg>
      );
    case 'acs712':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="14" y="8" width="36" height="32" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
          <rect x="22" y="16" width="20" height="16" rx="1" fill="#1e293b" />
          <rect x="36" y="20" width="14" height="8" fill="#15803d" stroke="#166534" />
        </svg>
      );
    case 'relay':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="8" y="8" width="48" height="32" rx="2" fill="#0369a1" stroke="#075985" strokeWidth="1" />
          <rect x="14" y="12" width="24" height="24" rx="1.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />
          <text x="26" y="27" fontSize="7" fontWeight="bold" fill="#ffffff" textAnchor="middle">5V</text>
          <rect x="42" y="14" width="10" height="20" fill="#15803d" />
        </svg>
      );
    case 'pump':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="14" y="14" width="32" height="22" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <rect x="46" y="20" width="8" height="10" fill="#0ea5e9" rx="1" />
          <circle cx="28" cy="25" r="5" fill="#38bdf8" />
        </svg>
      );
    case 'fan':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="12" y="6" width="40" height="36" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <circle cx="32" cy="24" r="14" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <circle cx="32" cy="24" r="4" fill="#94a3b8" />
          <path d="M 32 20 C 32 14, 38 12, 42 16 C 38 18, 34 18, 32 20 Z" fill="#64748b" />
          <path d="M 32 28 C 32 34, 26 36, 22 32 C 26 30, 30 30, 32 28 Z" fill="#64748b" />
        </svg>
      );
    case 'lcd_1602':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <rect x="6" y="10" width="52" height="28" rx="2" fill="#15803d" stroke="#166534" strokeWidth="1" />
          <rect x="11" y="14" width="42" height="20" rx="1" fill="#164e63" stroke="#0891b2" strokeWidth="1" />
          <line x1="14" y1="20" x2="48" y2="20" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="14" y1="27" x2="48" y2="27" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      );
    case 'led_green':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <path d="M 24 24 C 24 16, 32 10, 32 10 C 32 10, 40 16, 40 24 L 24 24 Z" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />
          <rect x="23" y="24" width="18" height="4" rx="1" fill="#15803d" />
          <line x1="28" y1="28" x2="28" y2="42" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="36" y1="28" x2="36" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
        </svg>
      );
    case 'led_red':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <path d="M 24 24 C 24 16, 32 10, 32 10 C 32 10, 40 16, 40 24 L 24 24 Z" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
          <rect x="23" y="24" width="18" height="4" rx="1" fill="#b91c1c" />
          <line x1="28" y1="28" x2="28" y2="42" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="36" y1="28" x2="36" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
        </svg>
      );
    case 'resistor':
      return (
        <svg viewBox="0 0 64 48" className="w-12 h-10 drop-shadow-xs">
          <line x1="4" y1="24" x2="20" y2="24" stroke="#94a3b8" strokeWidth="2" />
          <line x1="44" y1="24" x2="60" y2="24" stroke="#94a3b8" strokeWidth="2" />
          <rect x="20" y="18" width="24" height="12" rx="3" fill="#fed7aa" stroke="#fb923c" strokeWidth="1" />
          <line x1="24" y1="18" x2="24" y2="30" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="28" y1="18" x2="28" y2="30" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="32" y1="18" x2="32" y2="30" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="38" y1="18" x2="38" y2="30" stroke="#eab308" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
};

export const ComponentCatalog: React.FC = () => {
  const isCatalogOpen = useWorkbenchStore((s) => s.isCatalogOpen);
  const toggleCatalog = useWorkbenchStore((s) => s.toggleCatalog);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const addComponent = useWorkbenchStore((s) => s.addComponent);
  const activeComponents = useWorkbenchStore((s) => s.components);

  // Filter items
  const filteredItems = COMPONENT_CATALOG.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    const cat = CATEGORIES.find((c) => c.id === selectedCategory);
    return cat?.types?.includes(item.type);
  });

  const currentCategoryLabel =
    CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Basic';

  return (
    <div className="absolute right-0 top-[48px] md:top-[88px] bottom-14 md:bottom-0 z-20 flex pointer-events-none">
      {/* Collapse / Expand Tab Handle (Chevron on left border) */}
      <button
        onClick={toggleCatalog}
        title={isCatalogOpen ? 'Collapse Components' : 'Expand Components'}
        className="pointer-events-auto self-start mt-6 w-6 h-12 bg-white hover:bg-gray-50 text-gray-600 border-l border-t border-b border-gray-300 rounded-l-md shadow-md flex items-center justify-center transition -ml-6"
      >
        {isCatalogOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Drawer Panel */}
      {isCatalogOpen && (
        <aside className="pointer-events-auto w-84 bg-white border-l border-gray-200 shadow-xl flex flex-col overflow-hidden text-slate-800">
          {/* 1. Header: Tinkercad Components Dropdown & Search */}
          <div className="p-3 border-b border-gray-200 bg-gray-50/70 space-y-2.5">
            {/* Category Dropdown */}
            <div className="relative">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1 font-semibold">
                <span>Components</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {activeComponents.length} placed
                </span>
              </div>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-slate-800 hover:border-gray-400 transition shadow-xs"
              >
                <span>{currentCategoryLabel}</span>
                <Filter className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {showCategoryDropdown && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-sky-50 transition ${
                        selectedCategory === cat.id ? 'font-bold text-sky-600' : 'text-slate-700'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {selectedCategory === cat.id && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input (Tinkercad Minimalist Search Bar) */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-slate-800 placeholder-gray-400 focus:outline-none focus:border-sky-500 shadow-xs"
              />
            </div>
          </div>

          {/* 2. Components 3-Column Grid (Authentic Tinkercad Palette) */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2.5 auto-rows-max bg-white scrollbar-thin scrollbar-thumb-gray-200">
            {filteredItems.map((item) => {
              const placedCount = activeComponents.filter((c) => c.type === item.type).length;

              return (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => addComponent(item.type as WorkbenchComponent['type'])}
                  title={`${item.name} (${item.pins.length} pins) - Click or drag to add`}
                  className="group relative flex flex-col items-center justify-between p-2 rounded-xl bg-gray-50/70 hover:bg-sky-50/30 border border-gray-200 hover:border-sky-400 cursor-grab active:cursor-grabbing transition shadow-2xs hover:shadow-xs select-none"
                >
                  {/* Placed Counter Badge */}
                  {placedCount > 0 && (
                    <span className="absolute top-1 right-1 text-[9px] font-bold font-mono bg-sky-100 text-sky-700 px-1.5 py-0.2 rounded-full border border-sky-200">
                      {placedCount}
                    </span>
                  )}

                  {/* Thumbnail */}
                  <div className="w-full h-12 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ComponentThumbnail type={item.type} />
                  </div>

                  {/* Clean Label Below */}
                  <span className="text-[11px] font-medium text-slate-700 text-center leading-tight mt-1 line-clamp-2">
                    {item.name}
                  </span>

                  {/* Subtle Add Hover Plus */}
                  <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition p-0.5 bg-sky-500 text-white rounded-full">
                    <Plus className="w-2.5 h-2.5" />
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="col-span-3 text-center py-10 text-xs text-gray-400">
                No matching components found
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
