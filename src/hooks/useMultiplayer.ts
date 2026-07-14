import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { DrawingElement } from '../types';

export type RemoteCursor = {
  x: number;
  y: number;
  name: string;
  color: string;
};

export type ChatMessage = {
  id: string;
  name: string;
  color: string;
  message: string;
  timestamp: number;
};

// Public Yjs demo WebSocket server — reliable, works through all firewalls
const WS_SERVER_URL = 'wss://demos.yjs.dev';

export function useMultiplayer(initialElements: DrawingElement[]) {
  const [elements, setLocalElements] = useState<DrawingElement[]>(initialElements);
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [myName, setMyName] = useState<string>('');
  const [isShared, setIsShared] = useState<boolean>(false);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);

  const yElementsRef = useRef<Y.Map<DrawingElement> | null>(null);
  const yChatRef = useRef<Y.Array<ChatMessage> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  const myColorRef = useRef<string>(`hsl(${Math.random() * 360}, 80%, 50%)`);

  // Initialize Ydoc structures once
  useEffect(() => {
    const ydoc = ydocRef.current;

    const yElements = ydoc.getMap<DrawingElement>('elements');
    yElementsRef.current = yElements;

    const yChat = ydoc.getArray<ChatMessage>('chat');
    yChatRef.current = yChat;

    const undoManager = new Y.UndoManager(yElements);
    undoManagerRef.current = undoManager;

    // Sync Yjs map → React state on ANY change (local or remote)
    const updateLocalElements = () => {
      const newElements = Array.from(yElements.values());
      newElements.sort((a, b) => a.id.localeCompare(b.id));
      setLocalElements(newElements);
    };

    yElements.observe(updateLocalElements);

    yChat.observe(() => {
      setChatMessages(yChat.toArray());
    });

    undoManager.on('stack-item-added', () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    });
    undoManager.on('stack-item-popped', () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    });

    return () => {
      yElements.unobserve(updateLocalElements);
    };
  }, []);

  // Handle URL hash changes to connect/disconnect WebSocket provider
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', '?'));
      const room = params.get('room');
      const key = params.get('key');

      if (room && key) {
        setIsShared(true);
        setRoomUrl(window.location.href);

        if (!providerRef.current) {
          // Use key as part of room name for privacy (no one can guess the full room name)
          const fullRoom = `${room}-${key}`;
          const provider = new WebsocketProvider(WS_SERVER_URL, fullRoom, ydocRef.current);
          providerRef.current = provider;

          // Handle awareness (cursors)
          const awareness = provider.awareness;
          awareness.on('change', () => {
            const states = awareness.getStates();
            const cursors: Record<number, RemoteCursor> = {};
            states.forEach((state, clientID) => {
              if (clientID !== ydocRef.current.clientID && state.cursor) {
                cursors[clientID] = state.cursor;
              }
            });
            setRemoteCursors(cursors);
          });

          if (myName) {
            awareness.setLocalStateField('cursor', {
              x: 0,
              y: 0,
              name: myName,
              color: myColorRef.current,
            });
          }

          // Log connection status for debugging
          provider.on('status', (event: { status: string }) => {
            console.log('[Inkflow Sync]', event.status);
          });
        }
      } else {
        setIsShared(false);
        setRoomUrl('');
        if (providerRef.current) {
          providerRef.current.destroy();
          providerRef.current = null;
        }
        setRemoteCursors({});
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      if (providerRef.current) providerRef.current.destroy();
    };
  }, [myName]);

  // Update my cursor position
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (providerRef.current && myName) {
        providerRef.current.awareness.setLocalStateField('cursor', {
          x,
          y,
          name: myName,
          color: myColorRef.current,
        });
      }
    },
    [myName]
  );

  /**
   * updateElement: Directly updates a SINGLE element in the Yjs map.
   * This is the primary write path for drawing/moving/resizing.
   * It does NOT touch any other elements, so remote changes are never overwritten.
   */
  const updateElement = useCallback((el: DrawingElement) => {
    const ydoc = ydocRef.current;
    const yElements = yElementsRef.current;
    if (ydoc && yElements) {
      ydoc.transact(() => {
        yElements.set(el.id, el);
      }, 'local-user');
    }
  }, []);

  /**
   * setElements: Replaces the ENTIRE canvas (used for clear, import, initial load).
   * Correctly replaces everything in the Yjs map.
   */
  const setElements = useCallback(
    (newElements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])) => {
      const ydoc = ydocRef.current;
      const yElements = yElementsRef.current;

      if (ydoc && yElements) {
        const currentFromYjs = Array.from(yElements.values());
        const next = typeof newElements === 'function' ? newElements(currentFromYjs) : newElements;

        ydoc.transact(() => {
          const nextIds = new Set<string>();
          next.forEach((el) => {
            nextIds.add(el.id);
            const existing = yElements.get(el.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(el)) {
              yElements.set(el.id, el);
            }
          });

          // Delete elements not in new array (only safe for full-canvas replacements)
          Array.from(yElements.keys()).forEach((id) => {
            if (!nextIds.has(id)) {
              yElements.delete(id);
            }
          });
        }, 'local-user');
      }
    },
    []
  );

  /**
   * deleteElements: Explicitly removes specific elements by ID from the Yjs map.
   */
  const deleteElements = useCallback((ids: string[]) => {
    if (ydocRef.current && yElementsRef.current) {
      ydocRef.current.transact(() => {
        ids.forEach((id) => {
          yElementsRef.current?.delete(id);
        });
      }, 'local-user');
    }
  }, []);

  const undo = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.undo();
    }
  }, []);

  const redo = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.redo();
    }
  }, []);

  const sendChatMessage = useCallback(
    (message: string) => {
      if (yChatRef.current && myName) {
        yChatRef.current.push([
          {
            id: Math.random().toString(36).substring(2, 9),
            name: myName,
            color: myColorRef.current,
            message,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [myName]
  );

  // Action to start sharing
  const shareSession = useCallback(() => {
    const room = 'inkflow-' + Math.random().toString(36).substring(2, 10);
    const key = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const url = new URL(window.location.href);
    url.hash = `room=${room}&key=${key}`;
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url.toString())
        .then(() => {
          alert('Link copied to clipboard! Share it to collaborate.');
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
          alert(`Your share link is:\n\n${url.toString()}\n\nPlease copy this link to share.`);
        });
    } else {
      alert(`Your share link is:\n\n${url.toString()}\n\nPlease copy this link to share.`);
    }
  }, []);

  // Set my name
  const updateMyName = useCallback((name: string) => {
    setMyName(name);
    localStorage.setItem('inkflow-username', name);
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('cursor', {
        x: 0,
        y: 0,
        name,
        color: myColorRef.current,
      });
    }
  }, []);

  return {
    elements,
    setElements,
    updateElement,
    deleteElements,
    remoteCursors,
    updateCursor,
    isShared,
    shareSession,
    roomUrl,
    myName,
    updateMyName,
    undo,
    redo,
    canUndo,
    canRedo,
    chatMessages,
    sendChatMessage,
  };
}
