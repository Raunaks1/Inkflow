import React from 'react';
import {
  MousePointer,
  Hand,
  Pencil,
  Square,
  Circle,
  Triangle,
  Diamond,
  Star,
  Hexagon,
  Minus,
  ArrowRight,
  Type,
  Eraser,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';
import type { ElementType } from '../types';

interface ToolbarProps {
  activeTool: ElementType;
  setTool: (tool: ElementType) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setTool, onImageUpload }) => {
  const tools = [
    { type: 'select' as ElementType, icon: MousePointer, label: 'Select', shortcut: '1' },
    { type: 'pan' as ElementType, icon: Hand, label: 'Pan', shortcut: '2' },
    { type: 'pencil' as ElementType, icon: Pencil, label: 'Pencil', shortcut: '3' },
    { type: 'rectangle' as ElementType, icon: Square, label: 'Rectangle', shortcut: '4' },
    { type: 'circle' as ElementType, icon: Circle, label: 'Circle', shortcut: '5' },
    { type: 'triangle' as ElementType, icon: Triangle, label: 'Triangle', shortcut: 'T' },
    { type: 'diamond' as ElementType, icon: Diamond, label: 'Diamond', shortcut: 'D' },
    { type: 'star' as ElementType, icon: Star, label: 'Star', shortcut: 'S' },
    { type: 'hexagon' as ElementType, icon: Hexagon, label: 'Hexagon', shortcut: 'H' },
    { type: 'laser' as ElementType, icon: Zap, label: 'Laser', shortcut: 'L' },
    { type: 'line' as ElementType, icon: Minus, label: 'Line', shortcut: '6' },
    { type: 'arrow' as ElementType, icon: ArrowRight, label: 'Arrow', shortcut: '7' },
    { type: 'text' as ElementType, icon: Type, label: 'Text', shortcut: '8' },
    { type: 'eraser' as ElementType, icon: Eraser, label: 'Eraser', shortcut: '9' },
    { type: 'image' as ElementType, icon: ImageIcon, label: 'Image', shortcut: 'I' },
  ];

  return (
    <div className="floating-toolbar">
      {tools.map((t) => {
        const IconComponent = t.icon;
        const isActive = activeTool === t.type;
        
        if (t.type === 'image') {
          return (
            <label
              key={t.type}
              className={`toolbar-btn`}
              title={`${t.label} (${t.shortcut})`}
              aria-label={t.label}
              style={{ cursor: 'pointer', margin: 0 }}
            >
              <IconComponent size={20} className="icon-svg" />
              <span className="shortcut-badge">{t.shortcut}</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={onImageUpload}
                style={{ display: 'none' }}
              />
            </label>
          );
        }

        return (
          <button
            key={t.type}
            className={`toolbar-btn ${isActive ? 'active' : ''}`}
            onClick={() => setTool(t.type)}
            title={`${t.label} (${t.shortcut})`}
            aria-label={t.label}
          >
            <IconComponent size={20} className="icon-svg" />
            <span className="shortcut-badge">{t.shortcut}</span>
          </button>
        );
      })}
    </div>
  );
};
