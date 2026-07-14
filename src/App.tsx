import React, { useState, useEffect, useRef } from 'react';
import { ContextMenu } from './components/ContextMenu';
import rough from 'roughjs';
import confetti from 'canvas-confetti';
import { HelpCircle } from 'lucide-react';

import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { HelpModal } from './components/HelpModal';
import type { ElementType, DrawingElement, Point, ElementStyle } from './types';
import { drawElement, drawSelectionBox } from './utils/draw';
import {
  getPositionAtResizeHandle,
  getElementAtPosition,
  adjustElementCoordinates,
  getPolygonVertices,
} from './utils/geometry';

// Local storage key
const STORAGE_KEY = 'inkflow-whiteboard-elements';

function getDefaultElements(): DrawingElement[] {
  return [
    {
      id: 'welcome-text',
      type: 'text',
      x1: 200,
      y1: 150,
      x2: 600,
      y2: 190,
      text: 'Welcome to Inkflow! 🚀\nYour sketchy whiteboard app.',
      style: {
        strokeColor: '#3b82f6',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 3,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        fontSize: 24,
        fontFamily: 'handwritten',
      },
      seed: 42,
    },
    {
      id: 'welcome-rect',
      type: 'rectangle',
      x1: 180,
      y1: 130,
      x2: 580,
      y2: 245,
      style: {
        strokeColor: '#8b5cf6',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 3,
        strokeStyle: 'dashed',
        roughness: 1.5,
        opacity: 80,
        fontSize: 16,
        fontFamily: 'handwritten',
      },
      seed: 88,
    },
    {
      id: 'welcome-arrow',
      type: 'arrow',
      x1: 580,
      y1: 185,
      x2: 700,
      y2: 185,
      style: {
        strokeColor: '#10b981',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 3,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        fontSize: 16,
        fontFamily: 'handwritten',
      },
      seed: 99,
    },
    {
      id: 'welcome-circle',
      type: 'circle',
      x1: 720,
      y1: 135,
      x2: 820,
      y2: 235,
      style: {
        strokeColor: '#f59e0b',
        fillColor: '#fef3c7',
        fillStyle: 'hachure',
        strokeWidth: 3,
        strokeStyle: 'solid',
        roughness: 1.2,
        opacity: 90,
        fontSize: 16,
        fontFamily: 'handwritten',
      },
      seed: 111,
    },
    {
      id: 'welcome-circle-text',
      type: 'text',
      x1: 742,
      y1: 175,
      x2: 800,
      y2: 200,
      text: 'Draw!',
      style: {
        strokeColor: '#f97316',
        fillColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        fontSize: 16,
        fontFamily: 'handwritten',
      },
      seed: 123,
    },
  ];
}

const resizeElement = (
  element: DrawingElement,
  handle: string,
  clientX: number,
  clientY: number
): Partial<DrawingElement> => {
  const { type, x1, y1, x2, y2 } = element;

  if (type === 'line' || type === 'arrow') {
    if (handle === 'start') {
      return { x1: clientX, y1: clientY };
    } else {
      return { x2: clientX, y2: clientY };
    }
  }

  // Image is a box-like element; reuse generic box resizing logic.
  if (type === 'image') {
    // No special handling needed; continue to generic box resize.
  }

  let newX1 = x1;
  let newY1 = y1;
  let newX2 = x2;
  let newY2 = y2;

  switch (handle) {
    case 'tl':
      newX1 = clientX;
      newY1 = clientY;
      break;
    case 'tr':
      newX2 = clientX;
      newY1 = clientY;
      break;
    case 'bl':
      newX1 = clientX;
      newY2 = clientY;
      break;
    case 'br':
      newX2 = clientX;
      newY2 = clientY;
      break;
    case 't':
      newY1 = clientY;
      break;
    case 'b':
      newY2 = clientY;
      break;
    case 'l':
      newX1 = clientX;
      break;
    case 'r':
      newX2 = clientX;
      break;
  }

  return { x1: newX1, y1: newY1, x2: newX2, y2: newY2 };
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Layout Theme State (Dark mode by default for premium aesthetics)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('inkflow-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  // Elements and Selections
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<ElementType>('select');
  const [laserTick, setLaserTick] = useState(0);
  const laserPointsRef = useRef<{ x: number; y: number; time: number }[]>([]);

  // Drawing Styles
  const [style, setStyle] = useState<ElementStyle>({
    strokeColor: '#3b82f6',
    fillColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 3,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    fontSize: 24,
    fontFamily: 'handwritten',
  });

  // Pan, Zoom and Action state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [action, setAction] = useState<
    'none' | 'drawing' | 'moving' | 'resizing' | 'panning' | 'selection' | 'typing' | 'laser-drawing'
  >('none');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);

  // Multi-step interactions helper
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  
  // Coordinates helper
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });
  const [lastCanvasPos, setLastCanvasPos] = useState<Point>({ x: 0, y: 0 });
  const [cursorStyle, setCursorStyle] = useState<string>('default');

  // Text inputs editing
  const [editingElement, setEditingElement] = useState<DrawingElement | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Undo / Redo stacks
  const [history, setHistory] = useState<DrawingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Help Modal State
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('inkflow-sidebar-open');
    return saved === 'false' ? false : true;
  });

  // Canvas background color
  const [backgroundColor, setBackgroundColor] = useState<string>(() => {
    return localStorage.getItem('inkflow-bg-color') || 'transparent';
  });

  useEffect(() => {
    localStorage.setItem('inkflow-bg-color', backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    localStorage.setItem('inkflow-sidebar-open', isSidebarOpen.toString());
  }, [isSidebarOpen]);

  // --- Initial Mount Load ---
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setElements(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
      } catch (e) {
        const initial = getDefaultElements();
        setElements(initial);
        setHistory([initial]);
        setHistoryIndex(0);
      }
    } else {
      const initial = getDefaultElements();
      setElements(initial);
      setHistory([initial]);
      setHistoryIndex(0);
    }
  }, []);

  // --- Save to Local Storage when elements change ---
  useEffect(() => {
    if (historyIndex >= 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
    }
  }, [elements, historyIndex]);

  // --- Theme Syncer ---
  useEffect(() => {
    localStorage.setItem('inkflow-theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  // --- Text Area Focus Controller ---
  useEffect(() => {
    if (editingElement && textareaRef.current) {
      const textarea = textareaRef.current;
      const timer = setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editingElement]);

  // --- Trigger Canvas Redraw Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport scaling for High-DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Draw grid points
    drawGrid(ctx, pan, zoom, theme);

    // Drawing calculations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const rc = rough.canvas(canvas);
    
    // Draw all components
    elements.filter((el) => !el.isDeleted).forEach((element) => {
      drawElement(rc, ctx, element);

      // Selection bounding box
      if (selectedIds.includes(element.id) && tool === 'select') {
        drawSelectionBox(ctx, element, zoom, theme);
      }
    });

    // Multi-select marquee drag
    if (action === 'selection' && selectionStart && selectionEnd) {
      drawDragSelectionBox(ctx, selectionStart, selectionEnd, zoom, theme);
    }

    // Laser pointer trailing
    const now = Date.now();
    const lpts = laserPointsRef.current;
    if (lpts.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < lpts.length; i++) {
        const p1 = lpts[i - 1];
        const p2 = lpts[i];
        const age = now - p2.time;
        if (age < 1500) {
          const opacity = 1 - (age / 1500);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`; // Red laser
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [elements, zoom, pan, selectedIds, theme, action, selectionStart, selectionEnd, tool, laserTick]);

  // --- Window Resize Listener ---
  useEffect(() => {
    const handleResize = () => {
      // Force trigger redraw
      setElements((el) => [...el]);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Hotkey Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        action === 'typing'
      ) {
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        deleteSelectedElements();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        setSelectedIds([]);
        setSelectionStart(null);
        setSelectionEnd(null);
        setAction('none');
      } else {
        const toolShortcuts: Record<string, ElementType> = {
          '1': 'select',
          '2': 'pan',
          '3': 'pencil',
          '4': 'rectangle',
          '5': 'circle',
          '6': 'line',
          '7': 'arrow',
          '8': 'text',
          '9': 'eraser',
          t: 'triangle',
          T: 'triangle',
          d: 'diamond',
          D: 'diamond',
          s: 'star',
          S: 'star',
          h: 'hexagon',
          H: 'hexagon',
        };
        if (toolShortcuts[e.key]) {
          setTool(toolShortcuts[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, elements, historyIndex, history, action]);

  // --- Spacebar Panning (Holding space overrides cursor tool) ---
  useEffect(() => {
    let spacePressed = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (!spacePressed) {
          spacePressed = true;
          setTool('pan');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed = false;
        setTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Force re-render on async image load ---
  useEffect(() => {
    const handleImageLoad = () => {
      setElements((el) => [...el]);
    };
    window.addEventListener('inkflow-image-loaded', handleImageLoad);
    return () => window.removeEventListener('inkflow-image-loaded', handleImageLoad);
  }, []);

  // --- Image Embed Handlers ---
  const handleImageFile = (file: File, clientX: number, clientY: number) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvasX = (clientX - pan.x) / zoom;
        const canvasY = (clientY - pan.y) / zoom;
        let w = img.width;
        let h = img.height;
        if (w > 800) {
          h = (800 / w) * h;
          w = 800;
        }
        
        const newEl: DrawingElement = {
          id: `image-${Date.now()}`,
          type: 'image',
          x1: canvasX - w/2,
          y1: canvasY - h/2,
          x2: canvasX + w/2,
          y2: canvasY + h/2,
          imageData: dataUrl,
          style: { ...style },
          seed: Math.floor(Math.random() * 100000),
        };
        const next = [...elements, newEl];
        setElements(next);
        pushHistory(next);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (document.activeElement?.tagName === 'TEXTAREA') return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) handleImageFile(file, window.innerWidth / 2, window.innerHeight / 2);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file, e.clientX, e.clientY);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // --- Render Dynamic Background Grid ---
  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    pan: Point,
    zoom: number,
    theme: 'light' | 'dark'
  ) => {
    ctx.save();
    ctx.fillStyle = theme === 'dark' ? 'rgba(51, 65, 85, 0.45)' : 'rgba(203, 213, 225, 0.6)';
    const gridSize = 40;

    // Viewport bounds
    const left = -pan.x / zoom;
    const top = -pan.y / zoom;
    const right = (window.innerWidth - pan.x) / zoom;
    const bottom = (window.innerHeight - pan.y) / zoom;

    const startX = Math.floor(left / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
    }
    ctx.fill();
    ctx.restore();
  };

  const drawDragSelectionBox = (
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    zoom: number,
    theme: 'light' | 'dark'
  ) => {
    ctx.save();
    ctx.strokeStyle = theme === 'dark' ? 'rgba(91, 133, 255, 0.7)' : 'rgba(0, 85, 255, 0.7)';
    ctx.fillStyle = theme === 'dark' ? 'rgba(91, 133, 255, 0.1)' : 'rgba(0, 85, 255, 0.05)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  };

  // --- Dynamic Style Updater ---
  const updateStyle = (newFields: Partial<ElementStyle>) => {
    setStyle((prev) => ({ ...prev, ...newFields }));
    
    // If elements are selected, propagate change to selection
    if (selectedIds.length > 0) {
      const updated = elements.map((el) => {
        if (selectedIds.includes(el.id)) {
          return {
            ...el,
            style: { ...el.style, ...newFields },
          };
        }
        return el;
      });
      setElements(updated);
      pushHistory(updated);
    }
  };

  // --- Cursor Hover Style Updater ---
  const updateCursorStyle = (clientX: number, clientY: number) => {
    if (action === 'panning') {
      setCursorStyle('cursor-grabbing');
      return;
    }
    if (tool === 'pan') {
      setCursorStyle('cursor-grab');
      return;
    }
    if (
      tool === 'pencil' ||
      tool === 'rectangle' ||
      tool === 'circle' ||
      tool === 'triangle' ||
      tool === 'diamond' ||
      tool === 'star' ||
      tool === 'hexagon' ||
      tool === 'line' ||
      tool === 'arrow'
    ) {
      setCursorStyle('cursor-crosshair');
      return;
    }
    if (tool === 'text') {
      setCursorStyle('cursor-text-tool');
      return;
    }
    if (tool === 'eraser') {
      setCursorStyle('cursor-eraser-tool');
      return;
    }

    if (tool === 'select') {
      const canvasX = (clientX - pan.x) / zoom;
      const canvasY = (clientY - pan.y) / zoom;

      // Handle hover resizing pointers
      if (selectedIds.length === 1) {
        const selElement = elements.find((el) => el.id === selectedIds[0]);
        if (selElement) {
          const handle = getPositionAtResizeHandle(canvasX, canvasY, selElement, zoom);
          if (handle) {
            if (handle === 'tl' || handle === 'br') {
              setCursorStyle('nwse-resize');
              return;
            }
            if (handle === 'tr' || handle === 'bl') {
              setCursorStyle('nesw-resize');
              return;
            }
            if (handle === 't' || handle === 'b') {
              setCursorStyle('ns-resize');
              return;
            }
            if (handle === 'l' || handle === 'r') {
              setCursorStyle('ew-resize');
              return;
            }
            if (handle === 'start' || handle === 'end') {
              setCursorStyle('move');
              return;
            }
          }
        }
      }

      // Hover element checks
      const hovered = getElementAtPosition(canvasX, canvasY, elements);
      if (hovered) {
        setCursorStyle('move');
      } else {
        setCursorStyle('default');
      }
    }
  };

  // --- Multi-select elements checker ---
  const getElementsInSelectionMarquee = (
    start: Point,
    end: Point,
    elementsList: DrawingElement[]
  ): string[] => {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    return elementsList
      .filter((el) => {
        const elMinX = Math.min(el.x1, el.x2);
        const elMaxX = Math.max(el.x1, el.x2);
        const elMinY = Math.min(el.y1, el.y2);
        const elMaxY = Math.max(el.y1, el.y2);

        // Simple box overlapping
        return elMinX < maxX && elMaxX > minX && elMinY < maxY && elMaxY > minY;
      })
      .map((el) => el.id);
  };

  // --- Mouse / Pointer Actions ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (action === 'typing') return;

    // Handle middle click or holding spacebar for pan initialization
    if (e.button === 1 || tool === 'pan') {
      setAction('panning');
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;

    if (tool === 'eraser') {
      const clicked = getElementAtPosition(canvasX, canvasY, elements);
      if (clicked) {
        const remaining = elements.filter((el) => el.id !== clicked.id);
        setElements(remaining);
        pushHistory(remaining);
      }
      return;
    }

    if (tool === 'select') {
      // 1. Check if clicking single selection resize handle
      if (selectedIds.length === 1) {
        const activeEl = elements.find((el) => el.id === selectedIds[0]);
        if (activeEl) {
          const handle = getPositionAtResizeHandle(canvasX, canvasY, activeEl, zoom);
          if (handle) {
            setAction('resizing');
            setSelectedHandle(handle);
            return;
          }
        }
      }

      // 2. Check if clicking any element
      const clicked = getElementAtPosition(canvasX, canvasY, elements);
      if (clicked) {
        if (e.shiftKey) {
          // Toggle selection
          setSelectedIds((prev) =>
            prev.includes(clicked.id)
              ? prev.filter((id) => id !== clicked.id)
              : [...prev, clicked.id]
          );
        } else {
          // Normal selection
          if (!selectedIds.includes(clicked.id)) {
            setSelectedIds([clicked.id]);
          }
        }
        setAction('moving');
        setLastCanvasPos({ x: canvasX, y: canvasY });
      } else {
        // Clicked empty space: clear and start selection marquee
        if (!e.shiftKey) {
          setSelectedIds([]);
        }
        setAction('selection');
        setSelectionStart({ x: canvasX, y: canvasY });
        setSelectionEnd({ x: canvasX, y: canvasY });
      }
      return;
    }

    if (tool === 'text') {
      // Check if clicked text element already exists to edit it
      const clicked = getElementAtPosition(canvasX, canvasY, elements);
      if (clicked && clicked.type === 'text') {
        startEditingText(clicked);
      } else {
        // Create new text element
        const id = `text-${Date.now()}`;
        const newEl: DrawingElement = {
          id,
          type: 'text',
          x1: canvasX,
          y1: canvasY,
          x2: canvasX + 200,
          y2: canvasY + 40,
          text: '',
          style: { ...style },
          seed: Math.floor(Math.random() * 100000),
        };
        setElements((prev) => [...prev, newEl]);
        startEditingText(newEl);
      }
      return;
    }

    if (tool === 'laser') {
      setAction('laser-drawing');
      laserPointsRef.current = [{ x: canvasX, y: canvasY, time: Date.now() }];
      return;
    }

    let boundStart: string | undefined;
    if (tool === 'arrow') {
      const target = getElementAtPosition(canvasX, canvasY, elements);
      if (target) boundStart = target.id;
    }

    // Drawing shapes: pencil, rect, circle, line, arrow
    const id = `draw-${Date.now()}`;
    const newElement: DrawingElement = {
      id,
      type: tool,
      x1: canvasX,
      y1: canvasY,
      x2: canvasX,
      y2: canvasY,
      points: tool === 'pencil' ? [{ x: canvasX, y: canvasY }] : undefined,
      boundToStart: boundStart,
      style: { ...style },
      seed: Math.floor(Math.random() * 100000),
    };

    setElements((prev) => [...prev, newElement]);
    setSelectedIds([id]);
    setAction('drawing');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;

    updateCursorStyle(e.clientX, e.clientY);

    if (action === 'laser-drawing') {
      laserPointsRef.current.push({ x: canvasX, y: canvasY, time: Date.now() });
      setLaserTick(t => t + 1);
      return;
    }

    if (action === 'panning') {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (action === 'drawing') {
      const index = elements.length - 1;
      const current = elements[index];
      let updated = { ...current };

      if (tool === 'pencil') {
        const points = [...(current.points || []), { x: canvasX, y: canvasY }];
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        updated = {
          ...current,
          x1: Math.min(...xs),
          y1: Math.min(...ys),
          x2: Math.max(...xs),
          y2: Math.max(...ys),
          points,
        };
      } else {
        let boundEnd: string | undefined;
        if (tool === 'arrow') {
          const target = getElementAtPosition(canvasX, canvasY, elements.slice(0, index));
          if (target) boundEnd = target.id;
        }
        updated = {
          ...current,
          x2: canvasX,
          y2: canvasY,
          boundToEnd: boundEnd,
        };
      }

      const copy = [...elements];
      copy[index] = updated;
      setElements(copy);
    } else if (action === 'moving') {
      const dx = canvasX - lastCanvasPos.x;
      const dy = canvasY - lastCanvasPos.y;

      const updated = elements.map((el) => {
        if (selectedIds.includes(el.id)) {
          if (el.type === 'pencil' && el.points) {
            return {
              ...el,
              x1: el.x1 + dx,
              y1: el.y1 + dy,
              x2: el.x2 + dx,
              y2: el.y2 + dy,
              points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          } else {
            return {
              ...el,
              x1: el.x1 + dx,
              y1: el.y1 + dy,
              x2: el.x2 + dx,
              y2: el.y2 + dy,
            };
          }
        }

        // --- Smart Arrow Binding: Move arrow endpoints if bound shape moves ---
        if (el.type === 'arrow' && !selectedIds.includes(el.id)) {
          let newArrow = { ...el };
          let changed = false;
          if (el.boundToStart && selectedIds.includes(el.boundToStart)) {
            newArrow.x1 += dx;
            newArrow.y1 += dy;
            changed = true;
          }
          if (el.boundToEnd && selectedIds.includes(el.boundToEnd)) {
            newArrow.x2 += dx;
            newArrow.y2 += dy;
            changed = true;
          }
          if (changed) return newArrow;
        }

        return el;
      });
      setElements(updated);
      setLastCanvasPos({ x: canvasX, y: canvasY });
    } else if (action === 'resizing' && selectedIds.length === 1 && selectedHandle) {
      const id = selectedIds[0];
      const target = elements.find((el) => el.id === id);
      if (target) {
        const resized = resizeElement(target, selectedHandle, canvasX, canvasY);
        
        // Smart arrow binding when resizing an arrow
        if (target.type === 'arrow') {
          const underCursor = getElementAtPosition(canvasX, canvasY, elements.filter(e => e.id !== id));
          if (selectedHandle === 'start') {
            (resized as any).boundToStart = underCursor ? underCursor.id : undefined;
          } else if (selectedHandle === 'end') {
            (resized as any).boundToEnd = underCursor ? underCursor.id : undefined;
          }
        }
        
        setElements(
          elements.map((el) => {
            if (el.id === id) {
              return { ...el, ...resized };
            }
            return el;
          })
        );
      }
    } else if (action === 'selection') {
      setSelectionEnd({ x: canvasX, y: canvasY });
    }
  };

  const handleMouseUp = () => {
    if (action === 'laser-drawing' || action === 'panning') {
      setAction('none');
      return;
    }

    if (action === 'drawing') {
      // Normalize bounds of rectangle/circle for future selections
      const index = elements.length - 1;
      const finished = elements[index];
      const normalized = adjustElementCoordinates(finished);
      const copy = [...elements];
      copy[index] = { ...finished, ...normalized };
      setElements(copy);
      pushHistory(copy);
      setAction('none');
    } else if (action === 'moving' || action === 'resizing') {
      // Normalize shapes bounds
      const updated = elements.map((el) => {
        if (selectedIds.includes(el.id)) {
          const normalized = adjustElementCoordinates(el);
          return { ...el, ...normalized };
        }
        return el;
      });
      setElements(updated);
      pushHistory(updated);
      setAction('none');
      setSelectedHandle(null);
    } else if (action === 'selection' && selectionStart && selectionEnd) {
      const selected = getElementsInSelectionMarquee(selectionStart, selectionEnd, elements);
      setSelectedIds(selected);
      setAction('none');
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return;
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;

    const clicked = getElementAtPosition(canvasX, canvasY, elements);
    if (clicked && clicked.type === 'text') {
      startEditingText(clicked);
    }
  };

  // --- Mouse Wheel Zoom Control ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const isZoomIn = e.deltaY < 0;

    let newZoom = isZoomIn ? zoom * zoomFactor : zoom / zoomFactor;
    newZoom = Math.max(0.1, Math.min(20, newZoom)); // cap zoom limits

    // Zoom centering logic
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;

    setZoom(newZoom);
    setPan({
      x: e.clientX - canvasX * newZoom,
      y: e.clientY - canvasY * newZoom,
    });
  };

  // --- Inline Text Annotation Editor ---
  const startEditingText = (el: DrawingElement) => {
    setAction('typing');
    setEditingElement(el);
    setEditingText(el.text || '');
  };

  const finishEditingText = () => {
    if (!editingElement) return;

    let updatedList = [...elements];
    const trimmed = editingText.trim();

    if (trimmed === '') {
      updatedList = elements.filter((el) => el.id !== editingElement.id);
      setSelectedIds([]);
    } else {
      updatedList = elements.map((el) => {
        if (el.id === editingElement.id) {
          const fontSize = el.style.fontSize;
          const maxLineLen = Math.max(...trimmed.split('\n').map((l) => l.length));
          const w = maxLineLen * fontSize * 0.6;
          const h = trimmed.split('\n').length * fontSize * 1.25;
          return {
            ...el,
            text: trimmed,
            x2: el.x1 + w,
            y2: el.y1 + h,
          };
        }
        return el;
      });
    }

    setElements(updatedList);
    pushHistory(updatedList);
    setEditingElement(null);
    setEditingText('');
    setAction('none');
  };

  // --- Undo / Redo Operations ---
  const pushHistory = (newElementsState: DrawingElement[]) => {
    const copy = history.slice(0, historyIndex + 1);
    setHistory([...copy, newElementsState]);
    setHistoryIndex(copy.length);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
      setSelectedIds([]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
      setSelectedIds([]);
    }
  };

  const selectAll = () => {
    setSelectedIds(elements.map((el) => el.id));
  };

  const deleteSelectedElements = () => {
    if (selectedIds.length === 0) return;
    const filtered = elements.filter(el =>
      !selectedIds.includes(el.id) &&
      !(el.type === 'arrow' && (selectedIds.includes(el.boundToStart ?? '') || selectedIds.includes(el.boundToEnd ?? '')))
    );
    setElements(filtered);
    pushHistory(filtered);
    // Clear editing state if any selected element was being edited
    setEditingElement(prev => (prev && selectedIds.includes(prev.id) ? null : prev));
    setEditingText('');
    setSelectedIds([]);
  };

  const handleClearCanvas = () => {
    setTimeout(() => {
      if (window.confirm('Are you sure you want to clear the canvas?')) {
        const remaining = elements.map(el => ({ ...el, isDeleted: true }));
        setElements(remaining);
        setSelectedIds([]);
        pushHistory(remaining);
      }
    }, 50);
  };

  const handleRestoreElement = (id: string) => {
    const updated = elements.map(el => el.id === id ? { ...el, isDeleted: false } : el);
    setElements(updated);
    pushHistory(updated);
  };

  const handlePermanentDelete = (id: string) => {
    const updated = elements.filter(el => el.id !== id);
    setElements(updated);
    pushHistory(updated);
  };

  const handleEmptyTrash = () => {
    if (window.confirm('Are you sure you want to permanently delete all items in the trash?')) {
      const updated = elements.filter(el => !el.isDeleted);
      setElements(updated);
      pushHistory(updated);
    }
  };

  // Right-click context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;
    const clicked = getElementAtPosition(canvasX, canvasY, elements);
    if (clicked) {
      setSelectedIds([clicked.id]);
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: clicked.id });
    } else {
      setContextMenu(null);
    }
  };

  // Update element style (partial)
  const updateElementStyle = (id: string, partial: Partial<ElementStyle>) => {
    setElements(elements.map(el =>
      el.id === id ? { ...el, style: { ...el.style, ...partial } } : el
    ));
  };

  const deleteElement = (id: string) => {
    // Permanently remove the element and any arrows bound to it
    const filtered = elements.filter(el => el.id !== id && !(el.type === 'arrow' && (el.boundToStart === id || el.boundToEnd === id)));
    setElements(filtered);
    pushHistory(filtered);
    // Clear editing state if the deleted element was being edited
    setEditingElement(prev => (prev && prev.id === id ? null : prev));
    setEditingText('');
    setContextMenu(null);
    setSelectedIds([]);
  };

  // --- Zoom controls UI ---
  const zoomIn = () => {
    const centerCanvasX = (window.innerWidth / 2 - pan.x) / zoom;
    const centerCanvasY = (window.innerHeight / 2 - pan.y) / zoom;
    const newZoom = Math.min(20, zoom * 1.25);
    setZoom(newZoom);
    setPan({
      x: window.innerWidth / 2 - centerCanvasX * newZoom,
      y: window.innerHeight / 2 - centerCanvasY * newZoom,
    });
  };

  const zoomOut = () => {
    const centerCanvasX = (window.innerWidth / 2 - pan.x) / zoom;
    const centerCanvasY = (window.innerHeight / 2 - pan.y) / zoom;
    const newZoom = Math.max(0.1, zoom / 1.25);
    setZoom(newZoom);
    setPan({
      x: window.innerWidth / 2 - centerCanvasX * newZoom,
      y: window.innerHeight / 2 - centerCanvasY * newZoom,
    });
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // --- Export PNG / Vector SVG ---
  const handleExportImage = (format: 'png' | 'svg') => {
    if (elements.length === 0) {
      alert('Drawings list is empty.');
      return;
    }

    // Compute drawing bounding box margins
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((el) => {
      if (el.isDeleted) return;
      const sx = Math.min(el.x1, el.x2);
      const ex = Math.max(el.x1, el.x2);
      const sy = Math.min(el.y1, el.y2);
      const ey = Math.max(el.y1, el.y2);

      if (sx < minX) minX = sx;
      if (ex > maxX) maxX = ex;
      if (sy < minY) minY = sy;
      if (ey > maxY) maxY = ey;
    });

    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    if (format === 'png') {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.fillStyle = theme === 'dark' ? '#0b0f19' : '#ffffff';
      offCtx.fillRect(0, 0, width, height);

      offCtx.save();
      offCtx.translate(-minX, -minY);

      const offRc = rough.canvas(offCanvas);
      elements.forEach((el) => {
        if (el.isDeleted) return;
        drawElement(offRc, offCtx, el);
      });
      offCtx.restore();

      const url = offCanvas.toDataURL('image/png');
      const dl = document.createElement('a');
      dl.href = url;
      dl.download = 'inkflow-drawing.png';
      document.body.appendChild(dl);
      dl.click();
      dl.remove();

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981'],
      });
    } else {
      // Export SVG
      const svgBg = backgroundColor !== 'transparent' ? backgroundColor : (theme === 'dark' ? '#0b0f19' : '#ffffff');
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${svgBg};">`;
      svg += `<g transform="translate(${-minX}, ${-minY})">`;

      elements.forEach((el) => {
        if (el.isDeleted) return;
        const { type, x1, y1, x2, y2, style: elStyle, text } = el;
        const stroke = elStyle.strokeColor;
        const strokeW = elStyle.strokeWidth;
        const fill = elStyle.fillColor === 'transparent' ? 'none' : elStyle.fillColor;
        const dash =
          elStyle.strokeStyle === 'dashed'
            ? '8,8'
            : elStyle.strokeStyle === 'dotted'
            ? '2,4'
            : 'none';
        const opacity = elStyle.opacity / 100;

        if (type === 'rectangle') {
          const x = Math.min(x1, x2);
          const y = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);
          svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="${opacity}" rx="2" ry="2"/>`;
        } else if (type === 'circle') {
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          const rx = Math.abs(x2 - x1) / 2;
          const ry = Math.abs(y2 - y1) / 2;
          svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="${opacity}"/>`;
        } else if (['triangle', 'diamond', 'star', 'hexagon'].includes(type)) {
          const vertices = getPolygonVertices(type, x1, y1, x2, y2);
          const ptsAttr = vertices.map((v) => `${v.x},${v.y}`).join(' ');
          svg += `<polygon points="${ptsAttr}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="${opacity}" />`;
        } else if (type === 'line') {
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="${opacity}"/>`;
        } else if (type === 'arrow') {
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="${opacity}"/>`;
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headSize = Math.max(12, 10 + strokeW * 1.5);
          const xl = x2 - headSize * Math.cos(angle - Math.PI / 6);
          const yl = y2 - headSize * Math.sin(angle - Math.PI / 6);
          const xr = x2 - headSize * Math.cos(angle + Math.PI / 6);
          const yr = y2 - headSize * Math.sin(angle + Math.PI / 6);
          svg += `<line x1="${x2}" y1="${y2}" x2="${xl}" y2="${yl}" stroke="${stroke}" stroke-width="${strokeW}" opacity="${opacity}"/>`;
          svg += `<line x1="${x2}" y1="${y2}" x2="${xr}" y2="${yr}" stroke="${stroke}" stroke-width="${strokeW}" opacity="${opacity}"/>`;
        } else if (type === 'pencil' && el.points) {
          const pathData = el.points.reduce((acc, p, idx) => {
            return acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
          }, '');
          svg += `<path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
        } else if (type === 'text' && text) {
          let fontF = 'sans-serif';
          if (elStyle.fontFamily === 'handwritten') fontF = '"Architects Daughter", cursive';
          if (elStyle.fontFamily === 'monospace') fontF = '"Fira Code", monospace';

          const lines = text.split('\n');
          const mx = Math.min(x1, x2);
          const my = Math.min(y1, y2);
          const lineHeight = elStyle.fontSize * 1.25;

          lines.forEach((line, lineIdx) => {
            svg += `<text x="${mx}" y="${my + lineIdx * lineHeight}" fill="${stroke}" font-family="${fontF}" font-size="${elStyle.fontSize}" alignment-baseline="hanging" opacity="${opacity}">${line}</text>`;
          });
        } else if (type === 'image' && imageData) {
          const mx = Math.min(x1, x2);
          const my = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);
          svg += `<image x="${mx}" y="${my}" width="${w}" height="${h}" href="${imageData}" opacity="${opacity}" />`;
        }
      });

      svg += `</g></svg>`;

      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const dl = document.createElement('a');
      dl.href = url;
      dl.download = 'inkflow-drawing.svg';
      document.body.appendChild(dl);
      dl.click();
      dl.remove();

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981'],
      });
    }
  };

  // --- Export JSON File ---
  const handleExportJSON = () => {
    const data = JSON.stringify(elements, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a');
    dl.href = url;
    dl.download = 'board-backup.inkflow';
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    URL.revokeObjectURL(url);

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#3b82f6', '#8b5cf6', '#10b981'],
    });
  };

  // --- Load JSON File ---
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setElements(parsed);
          setSelectedIds([]);
          pushHistory(parsed);
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.5 },
          });
        } else {
          alert('Invalid Inkflow whiteboard file structure.');
        }
      } catch (err) {
        alert('Failed to parse file. Ensure it is a valid .inkflow JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  const handleToolbarImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const centerClientX = window.innerWidth / 2;
      const centerClientY = window.innerHeight / 2;
      handleImageFile(file, centerClientX, centerClientY);
      e.target.value = ''; // Reset input to allow uploading the same file again
    }
  };

  return (
    <div 
      className={`app-container ${theme}`}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Background whiteboard canvas */}
      <canvas
        ref={canvasRef}
        className={`whiteboard-canvas ${cursorStyle}`}
        style={{ backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />

      {/* Inline textarea when typing */}
      {editingElement && (
        <textarea
          ref={textareaRef}
          className="canvas-textarea"
          style={{
            left: `${editingElement.x1 * zoom + pan.x}px`,
            top: `${editingElement.y1 * zoom + pan.y}px`,
            fontSize: `${editingElement.style.fontSize * zoom}px`,
            fontFamily:
              editingElement.style.fontFamily === 'handwritten'
                ? '"Architects Daughter", cursive'
                : editingElement.style.fontFamily === 'monospace'
                ? '"Fira Code", monospace'
                : '"Inter", sans-serif',
            color: editingElement.style.strokeColor,
            width: `${Math.max(
              200,
              (editingText.length * editingElement.style.fontSize * 0.6 + 20) * zoom
            )}px`,
            height: `${Math.max(
              40,
              editingText.split('\n').length * editingElement.style.fontSize * 1.25 * zoom
            )}px`,
          }}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={finishEditingText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              finishEditingText();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              finishEditingText();
            }
          }}
        />
      )}

      {/* Floating Toolbar (Top Center) */}
      <Toolbar activeTool={tool} setTool={setTool} onImageUpload={handleToolbarImageUpload} />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          element={elements.find(el => el.id === contextMenu.elementId)!}
          onStyleChange={style => updateElementStyle(contextMenu.elementId, style)}
          onDelete={() => deleteElement(contextMenu.elementId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Floating Styling and Control Sidebar (Left side) */}
      <Sidebar
        style={style}
        updateStyle={updateStyle}
        onClearCanvas={handleClearCanvas}
        onExportImage={handleExportImage}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        theme={theme}
        toggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        undo={undo}
        redo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        activeElementSelected={selectedIds.length > 0}
        isOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        elements={elements}
        onRestoreElement={handleRestoreElement}
        onPermanentDelete={handlePermanentDelete}
        onEmptyTrash={handleEmptyTrash}
      />

      {/* Zoom and Help Panels (Bottom Right) */}
      <div className="bottom-right-controls">
        <div className="zoom-panel">
          <button className="zoom-btn" onClick={zoomOut}>
            −
          </button>
          <span className="zoom-value" onClick={resetZoom} title="Reset zoom (100%)">
            {Math.round(zoom * 100)}%
          </span>
          <button className="zoom-btn" onClick={zoomIn}>
            +
          </button>
        </div>
        <button
          className="help-btn"
          onClick={() => setIsHelpOpen(true)}
          title="Keyboard Shortcuts"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {/* Keyboard shortcuts modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
