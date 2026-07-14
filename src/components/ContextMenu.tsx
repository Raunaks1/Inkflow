import React from 'react';
import type { DrawingElement, ElementStyle } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  element: DrawingElement;
  onStyleChange: (style: Partial<ElementStyle>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, element, onStyleChange, onDelete, onClose }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'fontSize') {
      onStyleChange({ fontSize: Number(value) });
    } else if (name === 'fontFamily') {
      onStyleChange({ fontFamily: value as any });
    } else if (name === 'strokeColor') {
      onStyleChange({ strokeColor: value });
    } else if (name === 'fillColor') {
      onStyleChange({ fillColor: value });
    }
  };

  return (
    <div
      className="context-menu"
      style={{ top: y, left: x, position: 'absolute' }}
      onMouseLeave={onClose}
    >
      <label>
        Font Size
        <input
          type="number"
          name="fontSize"
          min={8}
          max={72}
          value={element.style.fontSize}
          onChange={handleChange}
        />
      </label>
      <label>
        Font Family
        <select name="fontFamily" value={element.style.fontFamily} onChange={handleChange}>
          <option value="handwritten">Handwritten</option>
          <option value="sans-serif">Sans Serif</option>
          <option value="monospace">Monospace</option>
        </select>
      </label>
      <label>
        Stroke Color
        <input type="color" name="strokeColor" value={element.style.strokeColor} onChange={handleChange} />
      </label>
      <label>
        Fill Color
        <input type="color" name="fillColor" value={element.style.fillColor} onChange={handleChange} />
      </label>
      <button className="delete" onClick={onDelete}>Delete</button>
    </div>
  );
};
