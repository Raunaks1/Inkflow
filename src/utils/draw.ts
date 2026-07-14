import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { DrawingElement } from '../types';
import { getPolygonVertices } from './geometry';

// Global cache for loaded image elements
const imageCache: Record<string, HTMLImageElement> = {};

// Get style options for Rough.js
function getRoughOptions(element: DrawingElement) {
  const { style } = element;
  const options: any = {
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    roughness: style.roughness,
    seed: element.seed,
  };

  // Border styles
  if (style.strokeStyle === 'dashed') {
    options.strokeLineDash = [8, 8];
  } else if (style.strokeStyle === 'dotted') {
    options.strokeLineDash = [2, 4];
  }

  // Fills
  if (style.fillColor !== 'transparent' && style.fillStyle !== 'none') {
    options.fill = style.fillColor;
    options.fillStyle = style.fillStyle === 'solid' ? 'solid' : style.fillStyle;
    
    // Hachure gaps and configuration based on stroke width
    if (style.fillStyle === 'hachure' || style.fillStyle === 'cross-hatch') {
      options.hachureGap = Math.max(6, style.strokeWidth * 4);
    }
  }

  return options;
}

// Generate the rough element or draw it
export function drawElement(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  element: DrawingElement
) {
  const options = getRoughOptions(element);
  const { type, x1, y1, x2, y2, points, text, style } = element;

  ctx.save();
  ctx.globalAlpha = style.opacity / 100;

  switch (type) {
    case 'rectangle': {
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      rc.rectangle(x, y, w, h, options);
      break;
    }
    case 'circle': {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1);
      const ry = Math.abs(y2 - y1);
      rc.ellipse(cx, cy, rx, ry, options);
      break;
    }
    case 'line': {
      rc.line(x1, y1, x2, y2, options);
      break;
    }
    case 'arrow': {
      // Main arrow shaft
      rc.line(x1, y1, x2, y2, options);

      // Arrowhead calculations
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headSize = Math.max(12, 10 + style.strokeWidth * 1.5);
      
      const xLeft = x2 - headSize * Math.cos(angle - Math.PI / 6);
      const yLeft = y2 - headSize * Math.sin(angle - Math.PI / 6);
      const xRight = x2 - headSize * Math.cos(angle + Math.PI / 6);
      const yRight = y2 - headSize * Math.sin(angle + Math.PI / 6);

      // Draw arrowhead using Rough.js
      if (style.fillColor !== 'transparent' && style.fillStyle !== 'none') {
        // Draw filled triangle arrowhead
        rc.polygon([[x2, y2], [xLeft, yLeft], [xRight, yRight]], {
          ...options,
          fill: style.strokeColor, // Arrowhead fill matches its stroke
          fillStyle: 'solid'
        });
      } else {
        // Simple sketchy arrowhead lines
        rc.line(x2, y2, xLeft, yLeft, options);
        rc.line(x2, y2, xRight, yRight, options);
      }
      break;
    }
    case 'triangle':
    case 'diamond':
    case 'star':
    case 'hexagon': {
      const vertices = getPolygonVertices(type, x1, y1, x2, y2);
      const rawPoints = vertices.map((v) => [v.x, v.y] as [number, number]);
      rc.polygon(rawPoints, options);
      break;
    }
    case 'pencil': {
      if (points && points.length > 0) {
        const rawPoints = points.map((p) => [p.x, p.y] as [number, number]);
        rc.linearPath(rawPoints, options);
      }
      break;
    }
    case 'text': {
      if (text) {
        ctx.fillStyle = style.strokeColor;
        ctx.textBaseline = 'top';

        // Select Font Family
        let fontStr = '';
        if (style.fontFamily === 'handwritten') {
          fontStr = `${style.fontSize}px "Architects Daughter", cursive`;
        } else if (style.fontFamily === 'monospace') {
          fontStr = `${style.fontSize}px "Fira Code", monospace`;
        } else {
          fontStr = `${style.fontSize}px "Inter", sans-serif`;
        }
        ctx.font = fontStr;

        // Custom multiline support
        const lines = text.split('\n');
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const lineHeight = style.fontSize * 1.25;

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], minX, minY + i * lineHeight);
        }
      }
      break;
    }
    case 'image': {
      if (element.imageData) {
        if (imageCache[element.imageData]) {
          const img = imageCache[element.imageData];
          const minX = Math.min(x1, x2);
          const minY = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);
          ctx.drawImage(img, minX, minY, w, h);
        } else {
          // Asynchronously load the image and trigger a global redraw when ready
          const img = new Image();
          img.onload = () => {
            window.dispatchEvent(new Event('inkflow-image-loaded'));
          };
          img.src = element.imageData;
          imageCache[element.imageData] = img;
        }
      }
      break;
    }
  }

  ctx.restore();
}

// Draw the selection outline and resize handles for elements
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  zoom: number,
  theme: 'light' | 'dark'
) {
  const { type, x1, y1, x2, y2 } = element;
  
  ctx.save();
  ctx.strokeStyle = theme === 'dark' ? '#5b85ff' : '#0055ff';
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);

  if (type === 'line' || type === 'arrow') {
    // Draw straight line bounding box or just handles
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw circular handles at endpoints
    ctx.setLineDash([]);
    ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#ffffff';
    const handleSize = 6 / zoom;
    
    ctx.beginPath();
    ctx.arc(x1, y1, handleSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x2, y2, handleSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'pencil') {
    // Pencil just gets a bounding box without resize handles
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const pad = 4 / zoom;

    ctx.strokeRect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);
  } else {
    // Box-like elements (rect, circle, text)
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const width = maxX - minX;
    const height = maxY - minY;
    const pad = 4 / zoom;

    // Outer Selection Rect
    ctx.strokeRect(minX - pad, minY - pad, width + pad * 2, height + pad * 2);

    // Draw handles (8 control points)
    ctx.setLineDash([]);
    ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#ffffff';
    const handleSize = 6 / zoom;
    
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const handles = [
      { x: minX - pad, y: minY - pad }, // tl
      { x: maxX + pad, y: minY - pad }, // tr
      { x: minX - pad, y: maxY + pad }, // bl
      { x: maxX + pad, y: maxY + pad }, // br
      { x: midX, y: minY - pad },       // t
      { x: midX, y: maxY + pad },       // b
      { x: minX - pad, y: midY },       // l
      { x: maxX + pad, y: midY },       // r
    ];

    handles.forEach((h) => {
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    });
  }

  ctx.restore();
}
