export type ElementType =
  | 'select'
  | 'pan'
  | 'pencil'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'hexagon'
  | 'laser'
  | 'image'
  | 'line'
  | 'arrow'
  | 'text'
  | 'eraser';

export type FillStyle = 'none' | 'hachure' | 'solid' | 'dots' | 'cross-hatch';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface Point {
  x: number;
  y: number;
}

export interface ElementStyle {
  strokeColor: string;
  fillColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  fontSize: number; // For text elements
  fontFamily: 'handwritten' | 'sans-serif' | 'monospace'; // For text elements
}

export interface DrawingElement {
  id: string;
  type: ElementType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: Point[]; // Only for 'pencil' (freehand)
  text?: string;    // Only for 'text'
  imageData?: string; // base64 URI for images
  boundToStart?: string; // ID of element this arrow starts at
  boundToEnd?: string;   // ID of element this arrow ends at
  isDeleted?: boolean;   // Soft-delete flag for Trash System
  style: ElementStyle;
  seed: number;     // Rough.js random seed so sketch patterns are stable
}

export interface CanvasState {
  elements: DrawingElement[];
  selectedIds: string[];
  tool: ElementType;
  style: ElementStyle;
  zoom: number;
  pan: Point;
  history: DrawingElement[][];
  historyIndex: number;
}
