import React from 'react';
import {
  Trash2,
  Download,
  Upload,
  Sun,
  Moon,
  Undo2,
  Redo2,
  FileImage,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import type { ElementStyle, FillStyle, StrokeStyle, DrawingElement } from '../types';

interface SidebarProps {
  style: ElementStyle;
  updateStyle: (style: Partial<ElementStyle>) => void;
  onClearCanvas: () => void;
  onExportImage: (format: 'png' | 'svg') => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  activeElementSelected: boolean;
  isOpen: boolean;
  onToggleSidebar: () => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  elements: DrawingElement[];
  onRestoreElement: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyTrash: () => void;
}

const STROKE_COLORS = [
  '#000000', // Charcoal/Black
  '#3b82f6', // Bright Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Golden Amber
  '#ef4444', // Coral Red
  '#8b5cf6', // Violet Purple
  '#ec4899', // Pink
  '#f97316', // Orange
];

const FILL_COLORS = [
  'transparent',
  '#dbeafe', // Light Blue
  '#d1fae5', // Light Green
  '#fef3c7', // Light Amber
  '#fee2e2', // Light Red
  '#ede9fe', // Light Purple
  '#fce7f3', // Light Pink
  '#ffedd5', // Light Orange
];

export const Sidebar: React.FC<SidebarProps> = ({
  style,
  updateStyle,
  onClearCanvas,
  onExportImage,
  onExportJSON,
  onImportJSON,
  theme,
  toggleTheme,
  undo,
  redo,
  canUndo,
  canRedo,
  activeElementSelected,
  isOpen,
  onToggleSidebar,
  backgroundColor,
  setBackgroundColor,
  elements,
  onRestoreElement,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const fillStyles: { value: FillStyle; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'solid', label: 'Solid' },
    { value: 'hachure', label: 'Hachure' },
    { value: 'cross-hatch', label: 'Cross-hatch' },
    { value: 'dots', label: 'Dots' },
  ];

  const strokeStyles: { value: StrokeStyle; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ];

  return (
    <div className={`sidebar-container ${isOpen ? 'expanded' : 'collapsed'}`}>
      {/* Brand Header */}
      <div className="brand-header">
        <Sparkles size={22} className="brand-icon" />
        <span className="brand-name">Inkflow</span>
      </div>

      <div className="sidebar-scrollable">
        {/* Style Selection Header */}
        <div className="sidebar-section-title">
          {activeElementSelected ? 'Selection Styles' : 'Default Styles'}
        </div>

        {/* Stroke Color */}
        <div className="sidebar-group">
          <label className="sidebar-label">Stroke Color</label>
          <div className="color-palette">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${style.strokeColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => updateStyle({ strokeColor: c })}
                title={c}
              />
            ))}
            <input
              type="color"
              className="color-picker-input"
              value={style.strokeColor.startsWith('#') ? style.strokeColor : '#000000'}
              onChange={(e) => updateStyle({ strokeColor: e.target.value })}
              title="Custom Color"
            />
          </div>
        </div>

        {/* Fill Color */}
        <div className="sidebar-group">
          <label className="sidebar-label">Fill Color</label>
          <div className="color-palette">
            {FILL_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch fill-swatch ${style.fillColor === c ? 'selected' : ''} ${c === 'transparent' ? 'transparent-swatch' : ''}`}
                style={{ backgroundColor: c === 'transparent' ? undefined : c }}
                onClick={() => updateStyle({ fillColor: c })}
                title={c === 'transparent' ? 'Transparent' : c}
              />
            ))}
            <input
              type="color"
              className="color-picker-input"
              value={style.fillColor.startsWith('#') ? style.fillColor : '#ffffff'}
              onChange={(e) => updateStyle({ fillColor: e.target.value })}
              title="Custom Fill"
            />
          </div>
        </div>

        {/* Fill Style (only relevant if fill is not transparent) */}
        {style.fillColor !== 'transparent' && (
          <div className="sidebar-group">
            <label className="sidebar-label">Fill Style</label>
            <div className="select-btn-group">
              {fillStyles.map((fs) => (
                <button
                  key={fs.value}
                  className={`select-btn-item ${style.fillStyle === fs.value ? 'selected' : ''}`}
                  onClick={() => updateStyle({ fillStyle: fs.value })}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stroke Width */}
        <div className="sidebar-group">
          <label className="sidebar-label">Stroke Width ({style.strokeWidth}px)</label>
          <div className="select-btn-group">
            {[1, 3, 5].map((w) => (
              <button
                key={w}
                className={`select-btn-item ${style.strokeWidth === w ? 'selected' : ''}`}
                onClick={() => updateStyle({ strokeWidth: w })}
              >
                {w === 1 ? 'Thin' : w === 3 ? 'Medium' : 'Thick'}
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Style */}
        <div className="sidebar-group">
          <label className="sidebar-label">Stroke Style</label>
          <div className="select-btn-group">
            {strokeStyles.map((ss) => (
              <button
                key={ss.value}
                className={`select-btn-item ${style.strokeStyle === ss.value ? 'selected' : ''}`}
                onClick={() => updateStyle({ strokeStyle: ss.value })}
              >
                {ss.label}
              </button>
            ))}
          </div>
        </div>

        {/* Roughness */}
        <div className="sidebar-group">
          <label className="sidebar-label">Roughness</label>
          <div className="select-btn-group">
            {[0, 1, 2].map((r) => (
              <button
                key={r}
                className={`select-btn-item ${style.roughness === r ? 'selected' : ''}`}
                onClick={() => updateStyle({ roughness: r })}
              >
                {r === 0 ? 'Smooth' : r === 1 ? 'Sketchy' : 'Cartoon'}
              </button>
            ))}
          </div>
        </div>

        {/* Opacity */}
        <div className="sidebar-group">
          <div className="flex-space-between">
            <label className="sidebar-label">Opacity</label>
            <span className="slider-value">{style.opacity}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={style.opacity}
            onChange={(e) => updateStyle({ opacity: parseInt(e.target.value) })}
            className="sidebar-slider"
          />
        </div>

        {/* Text Settings */}
        <div className="sidebar-group">
          <label className="sidebar-label">Font Family</label>
          <div className="select-btn-group">
            {[
              { value: 'handwritten', label: 'Comic' },
              { value: 'sans-serif', label: 'Sans' },
              { value: 'monospace', label: 'Mono' },
            ].map((f) => (
              <button
                key={f.value}
                className={`select-btn-item ${style.fontFamily === f.value ? 'selected' : ''}`}
                onClick={() => updateStyle({ fontFamily: f.value as any })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-group">
          <label className="sidebar-label">Font Size</label>
          <div className="select-btn-group">
            {[16, 24, 32, 40].map((sz) => (
              <button
                key={sz}
                className={`select-btn-item ${style.fontSize === sz ? 'selected' : ''}`}
                onClick={() => updateStyle({ fontSize: sz })}
              >
                {sz === 16 ? 'S' : sz === 24 ? 'M' : sz === 32 ? 'L' : 'XL'}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* History controls */}
        <div className="sidebar-section-title">Canvas Action</div>
        <div className="action-row-buttons">
          <button
            className="action-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button
            className="action-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={16} />
            <span>Redo</span>
          </button>
        </div>

        {/* Clear Canvas */}
        <div className="sidebar-group">
          <button className="danger-action-btn" onClick={onClearCanvas}>
            <Trash2 size={16} />
            <span>Clear Canvas</span>
          </button>
        </div>

        {/* Trash Bin */}
        {elements.some(e => e.isDeleted) && (
          <>
            <div className="divider" />
            <div className="sidebar-section-title flex-space-between">
              Trash Bin
              <button 
                className="action-btn" 
                style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }}
                onClick={onEmptyTrash}
              >
                Empty
              </button>
            </div>
            <div className="sidebar-group">
              <div className="trash-list" style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {elements.filter(e => e.isDeleted).map(el => (
                  <div key={el.id} className="trash-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      {el.type} {el.id.split('-').pop()?.substring(0, 5)}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="select-btn-item" 
                        style={{ padding: '4px', border: 'none' }}
                        title="Restore" 
                        onClick={() => onRestoreElement(el.id)}
                      >
                        <Undo2 size={14} />
                      </button>
                      <button 
                        className="select-btn-item" 
                        style={{ padding: '4px', border: 'none', color: 'var(--danger-color)' }}
                        title="Delete Permanently" 
                        onClick={() => onPermanentDelete(el.id)}
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="divider" />

        {/* Canvas Settings */}
        <div className="sidebar-section-title">Canvas Settings</div>
        <div className="sidebar-group">
          <label className="sidebar-label">Background Color</label>
          <div className="color-palette">
            {FILL_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch fill-swatch ${backgroundColor === c ? 'selected' : ''} ${c === 'transparent' ? 'transparent-swatch' : ''}`}
                style={{ backgroundColor: c === 'transparent' ? undefined : c }}
                onClick={() => setBackgroundColor(c)}
                title={c === 'transparent' ? 'Transparent' : c}
              />
            ))}
            <input
              type="color"
              className="color-picker-input"
              value={backgroundColor.startsWith('#') ? backgroundColor : '#ffffff'}
              onChange={(e) => setBackgroundColor(e.target.value)}
              title="Custom Canvas Background"
            />
          </div>
        </div>

        <div className="divider" />

        {/* File and Theme operations */}
        <div className="sidebar-section-title">File & Settings</div>
        <div className="export-menu">
          <button className="action-btn" onClick={() => onExportImage('png')}>
            <FileImage size={16} />
            <span>Export PNG</span>
          </button>
          <button className="action-btn" onClick={() => onExportImage('svg')}>
            <Download size={16} />
            <span>Export SVG</span>
          </button>
          <button className="action-btn" onClick={onExportJSON}>
            <Download size={16} />
            <span>Save .inkflow</span>
          </button>

          {/* Import JSON */}
          <label className="action-btn cursor-pointer">
            <Upload size={16} />
            <span>Load File</span>
            <input
              type="file"
              accept=".inkflow"
              className="hidden"
              onChange={onImportJSON}
            />
          </label>

          {/* Theme Toggle */}
          <button className="action-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </div>

      {/* Collapse/Expand Toggle Button */}
      <button
        className="sidebar-toggle-btn"
        onClick={onToggleSidebar}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        aria-label={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
    </div>
  );
};
