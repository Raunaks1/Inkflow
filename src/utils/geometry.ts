import type { Point, DrawingElement } from '../types';

export function distance(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

// Distance from point p to line segment v-w
export function distanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
  });
}

export function getPolygonVertices(
  type: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Point[] {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;

  switch (type) {
    case 'triangle':
      return [
        { x: cx, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    case 'diamond':
      return [
        { x: cx, y: minY },
        { x: maxX, y: cy },
        { x: cx, y: maxY },
        { x: minX, y: cy },
      ];
    case 'star': {
      const vertices: Point[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const rFactor = i % 2 === 0 ? 1 : 0.4;
        vertices.push({
          x: cx + rx * rFactor * Math.cos(angle),
          y: cy + ry * rFactor * Math.sin(angle),
        });
      }
      return vertices;
    }
    case 'hexagon': {
      const vertices: Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        vertices.push({
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        });
      }
      return vertices;
    }
    default:
      return [];
  }
}

export function isPointInPolygon(x: number, y: number, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Normalize elements so that x1, y1 is top-left, and x2, y2 is bottom-right (for rect/circle/polygons)
export function adjustElementCoordinates(element: DrawingElement) {
  const { type, x1, y1, x2, y2 } = element;
  if (['rectangle', 'circle', 'triangle', 'diamond', 'star', 'hexagon'].includes(type)) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  }
  return { x1, y1, x2, y2 };
}

// Check if point is inside a rectangle
function isPointInRect(x: number, y: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

// Check if point is near the border of a rectangle (when hollow)
function isPointNearRectBorder(x: number, y: number, x1: number, y1: number, x2: number, y2: number, threshold = 6): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  const nearTop = Math.abs(y - minY) <= threshold && x >= minX - threshold && x <= maxX + threshold;
  const nearBottom = Math.abs(y - maxY) <= threshold && x >= minX - threshold && x <= maxX + threshold;
  const nearLeft = Math.abs(x - minX) <= threshold && y >= minY - threshold && y <= maxY + threshold;
  const nearRight = Math.abs(x - maxX) <= threshold && y >= minY - threshold && y <= maxY + threshold;

  return nearTop || nearBottom || nearLeft || nearRight;
}

// Check if point is near the perimeter of a circle
function isPointNearCirclePerimeter(x: number, y: number, cx: number, cy: number, rx: number, ry: number, threshold = 6): boolean {
  // Translate point to circle-centered coordinates
  const dx = x - cx;
  const dy = y - cy;
  if (rx === 0 || ry === 0) return false;
  
  // Calculate outer and inner ellipse boundaries
  const outerVal = Math.pow(dx / (rx + threshold), 2) + Math.pow(dy / (ry + threshold), 2);
  const innerVal = Math.pow(dx / Math.max(1, rx - threshold), 2) + Math.pow(dy / Math.max(1, ry - threshold), 2);
  
  return outerVal <= 1 && innerVal >= 1;
}

// Check if point is inside a circle
function isPointInCircle(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  if (rx === 0 || ry === 0) return false;
  return Math.pow(dx / rx, 2) + Math.pow(dy / ry, 2) <= 1;
}

export function isPointOnElement(x: number, y: number, element: DrawingElement): boolean {
  const { type, x1, y1, x2, y2, points, style, text } = element;
  const isFilled = style.fillColor !== 'transparent' && style.fillStyle !== 'none';
  const threshold = 6;

  switch (type) {
    case 'line':
    case 'arrow':
      return distanceToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 }) <= threshold;

    case 'rectangle':
      if (isFilled) {
        return isPointInRect(x, y, x1, y1, x2, y2);
      }
      return isPointNearRectBorder(x, y, x1, y1, x2, y2, threshold);

    case 'circle': {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      if (isFilled) {
        return isPointInCircle(x, y, cx, cy, rx, ry);
      }
      return isPointNearCirclePerimeter(x, y, cx, cy, rx, ry, threshold);
    }

    case 'pencil':
      if (!points || points.length === 0) return false;
      // Check distance to each segment in freehand drawing
      for (let i = 0; i < points.length - 1; i++) {
        if (distanceToSegment({ x, y }, points[i], points[i + 1]) <= threshold + (style.strokeWidth / 2)) {
          return true;
        }
      }
      return false;

    case 'text': {
      if (!text) return false;
      // Estimate text box
      const fontSize = style.fontSize;
      const width = text.length * fontSize * 0.6; // approximation
      const height = fontSize * 1.25;
      
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      return x >= minX && x <= minX + width && y >= minY && y <= minY + height;
    }

    case 'triangle':
    case 'diamond':
    case 'star':
    case 'hexagon': {
      const vertices = getPolygonVertices(type, x1, y1, x2, y2);
      if (isFilled) {
        return isPointInPolygon(x, y, vertices);
      }
      for (let i = 0; i < vertices.length; i++) {
        const nextIdx = (i + 1) % vertices.length;
        if (distanceToSegment({ x, y }, vertices[i], vertices[nextIdx]) <= threshold) {
          return true;
        }
      }
      return false;
    }

    default:
      return false;
  }
}

// Find top element under cursor
export function getElementAtPosition(
  x: number,
  y: number,
  elements: DrawingElement[]
): DrawingElement | null {
  // Go backwards because elements drawn later are on top
  for (let i = elements.length - 1; i >= 0; i--) {
    if (!elements[i].isDeleted && isPointOnElement(x, y, elements[i])) {
      return elements[i];
    }
  }
  return null;
}

// Check if mouse is on a selection/resize handle
export function getPositionAtResizeHandle(
  x: number,
  y: number,
  element: DrawingElement,
  zoom: number
): string | null {
  const { type, x1, y1, x2, y2 } = element;
  const handleSize = 8 / zoom; // size scale with zoom

  if (type === 'line' || type === 'arrow') {
    if (distance({ x, y }, { x: x1, y: y1 }) <= handleSize + 2) return 'start';
    if (distance({ x, y }, { x: x2, y: y2 }) <= handleSize + 2) return 'end';
    return null;
  }

  if (type === 'pencil' || type === 'text') {
    return null; // pencil and text cannot be resized easily via handles, only moved
  }

  // Box-like elements (rect, circle, text)
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Corner handles
  if (distance({ x, y }, { x: minX, y: minY }) <= handleSize + 2) return 'tl'; // top-left
  if (distance({ x, y }, { x: maxX, y: minY }) <= handleSize + 2) return 'tr'; // top-right
  if (distance({ x, y }, { x: minX, y: maxY }) <= handleSize + 2) return 'bl'; // bottom-left
  if (distance({ x, y }, { x: maxX, y: maxY }) <= handleSize + 2) return 'br'; // bottom-right

  // Side handles
  if (distance({ x, y }, { x: midX, y: minY }) <= handleSize + 2) return 't'; // top
  if (distance({ x, y }, { x: midX, y: maxY }) <= handleSize + 2) return 'b'; // bottom
  if (distance({ x, y }, { x: minX, y: midY }) <= handleSize + 2) return 'l'; // left
  if (distance({ x, y }, { x: maxX, y: midY }) <= handleSize + 2) return 'r'; // right

  return null;
}
