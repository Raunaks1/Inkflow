import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { desc: 'Selection Tool', keys: ['1'] },
    { desc: 'Pan Canvas Tool', keys: ['2'] },
    { desc: 'Pencil Freehand', keys: ['3'] },
    { desc: 'Rectangle Shape', keys: ['4'] },
    { desc: 'Circle Shape', keys: ['5'] },
    { desc: 'Triangle Shape', keys: ['T'] },
    { desc: 'Diamond Shape', keys: ['D'] },
    { desc: 'Star Shape', keys: ['S'] },
    { desc: 'Hexagon Shape', keys: ['H'] },
    { desc: 'Line Segment', keys: ['6'] },
    { desc: 'Arrow Shape', keys: ['7'] },
    { desc: 'Text Annotation', keys: ['8'] },
    { desc: 'Eraser Tool', keys: ['9'] },
    { desc: 'Undo Action', keys: ['Ctrl', 'Z'] },
    { desc: 'Redo Action', keys: ['Ctrl', 'Shift', 'Z'] },
    { desc: 'Delete Selected', keys: ['Del'] },
    { desc: 'Select All Shapes', keys: ['Ctrl', 'A'] },
    { desc: 'Pan Canvas (Holding)', keys: ['Space + Drag'] },
    { desc: 'Zoom In / Out', keys: ['Mouse Wheel'] },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        <div className="shortcut-list">
          {shortcuts.map((s, idx) => (
            <div className="shortcut-row" key={idx}>
              <span className="shortcut-desc">{s.desc}</span>
              <div className="shortcut-keys">
                {s.keys.map((k, kIdx) => (
                  <span className="key-badge" key={kIdx}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
