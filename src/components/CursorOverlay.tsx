import type { RemoteCursor } from '../hooks/useMultiplayer';
import type { Point } from '../types';

interface CursorOverlayProps {
  cursors: Record<number, RemoteCursor>;
  pan: Point;
  zoom: number;
}

export function CursorOverlay({ cursors, pan, zoom }: CursorOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {Object.entries(cursors).map(([id, cursor]) => {
        // Calculate screen coordinates based on pan and zoom
        const screenX = cursor.x * zoom + pan.x;
        const screenY = cursor.y * zoom + pan.y;

        return (
          <div
            key={id}
            className="absolute top-0 left-0 transition-transform duration-75 ease-linear will-change-transform flex items-start"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
            }}
          >
            {/* SVG Cursor Pointer */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md"
              style={{
                transform: 'rotate(-20deg)',
                marginLeft: '-6px',
                marginTop: '-6px',
              }}
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.8c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 00-.85.35z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            
            {/* Username label */}
            <div
              className="px-2 py-0.5 rounded-md text-xs font-medium text-white shadow-sm whitespace-nowrap ml-1 mt-3"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name || 'Anonymous'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
