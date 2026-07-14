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

// Public Yjs demo WebSocket server (verified working via test-sync.mjs)
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
  const [wsStatus, setWsStatus] = useState<string>('disconnected');
  const [syncStatus, setSyncStatus] = useState<boolean>(false);
  const [yElementCount, setYElementCount] = useState<number>(0);

  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);

  const yElementsRef = useRef<Y.Map<DrawingElement> | null>(null);
  const yChatRef = useRef<Y.Array<ChatMessage> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  const myColorRef = useRef<string>(`hsl(${Math.random() * 360}, 80%, 50%)`);
  const myNameRef = useRef<string>('');

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
      setYElementCount(newElements.length);
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

  // Connect/disconnect WebSocket provider based on URL hash.
  // This effect has NO dependencies on myName — it runs ONCE on mount
  // and listens for hashchange events. This prevents the provider from
  // being destroyed and recreated when the user enters their name.
  useEffect(() => {
    const connectToRoom = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', '?'));
      const room = params.get('room');
      const key = params.get('key');

      if (room && key) {
        setIsShared(true);
        setRoomUrl(window.location.href);

        if (!providerRef.current) {
          const fullRoom = `${room}-${key}`;
          console.log('[Inkflow] Connecting to room:', fullRoom);
          const provider = new WebsocketProvider(WS_SERVER_URL, fullRoom, ydocRef.current);
          providerRef.current = provider;

          provider.on('status', (event: { status: string }) => {
            console.log('[Inkflow] WebSocket status:', event.status);
            setWsStatus(event.status);
          });

          provider.on('sync', (isSynced: boolean) => {
            console.log('[Inkflow] Synced:', isSynced);
            setSyncStatus(isSynced);
          });

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

          // Broadcast name if already set
          const name = myNameRef.current;
          if (name) {
            awareness.setLocalStateField('cursor', {
              x: 0,
              y: 0,
              name,
              color: myColorRef.current,
            });
          }
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

    connectToRoom();
    window.addEventListener('hashchange', connectToRoom);
    return () => {
      window.removeEventListener('hashchange', connectToRoom);
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, []); // <-- NO dependency on myName! Provider is created once and never destroyed.

  // Update my cursor position
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (providerRef.current && myNameRef.current) {
        providerRef.current.awareness.setLocalStateField('cursor', {
          x,
          y,
          name: myNameRef.current,
          color: myColorRef.current,
        });
      }
    },
    []
  );

  /**
   * updateElement: Directly updates a SINGLE element in the Yjs map.
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
   * setElements: Replaces the ENTIRE canvas (clear, import, initial load).
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
   * deleteElements: Explicitly removes specific elements by ID.
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
      if (yChatRef.current && myNameRef.current) {
        yChatRef.current.push([
          {
            id: Math.random().toString(36).substring(2, 9),
            name: myNameRef.current,
            color: myColorRef.current,
            message,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    []
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

  // Set my name — uses a ref so provider effect doesn't need to re-run
  const updateMyName = useCallback((name: string) => {
    setMyName(name);
    myNameRef.current = name;
    localStorage.setItem('inkflow-username', name);
    // Update awareness immediately (provider is NOT recreated)
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
    wsStatus,
    syncStatus,
    yElementCount,
  };
}
