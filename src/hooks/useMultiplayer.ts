import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
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

export function useMultiplayer(initialElements: DrawingElement[]) {
  const [elements, setLocalElements] = useState<DrawingElement[]>(initialElements);
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [myName, setMyName] = useState<string>('');
  const [isShared, setIsShared] = useState<boolean>(false);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // We want the Ydoc to exist ALWAYS (even offline) so we get UndoManager for free!
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebrtcProvider | null>(null);
  
  // Lazy initialize Y.Map and UndoManager to avoid re-creation
  const yElementsRef = useRef<Y.Map<DrawingElement> | null>(null);
  const yChatRef = useRef<Y.Array<ChatMessage> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  // We assign a random color for our own cursor
  const myColorRef = useRef<string>(`hsl(${Math.random() * 360}, 80%, 50%)`);

  // Initialize Ydoc structures once
  useEffect(() => {
    const ydoc = ydocRef.current;
    
    // Set up elements map
    const yElements = ydoc.getMap<DrawingElement>('elements');
    yElementsRef.current = yElements;
    
    // Set up chat array
    const yChat = ydoc.getArray<ChatMessage>('chat');
    yChatRef.current = yChat;
    
    // Set up UndoManager tracking ONLY the elements map
    const undoManager = new Y.UndoManager(yElements);
    undoManagerRef.current = undoManager;
    
    // Sync Yjs map to local React state
    const updateLocalElements = () => {
      const newElements = Array.from(yElements.values());
      // Sort elements by ID to ensure stable render order
      newElements.sort((a, b) => a.id.localeCompare(b.id));
      setLocalElements(newElements);
    };
    
    yElements.observe(updateLocalElements);
    
    // Sync Chat array to local React state
    yChat.observe(() => {
      setChatMessages(yChat.toArray());
    });
    
    // Listen for undo/redo stack changes to update UI buttons
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

  // Handle URL hash changes to connect/disconnect WebRTC
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
          const provider = new WebrtcProvider(room, ydocRef.current, {
            password: key,
            signaling: [
              'wss://signaling.yjs.dev',
              'wss://y-webrtc-signaling-eu.herokuapp.com',
              'wss://y-webrtc-signaling-us.herokuapp.com'
            ]
          });
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
          
          // Re-broadcast our own name/cursor if we just connected
          if (myName) {
             awareness.setLocalStateField('cursor', {
               x: 0,
               y: 0,
               name: myName,
               color: myColorRef.current
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

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      if (providerRef.current) providerRef.current.destroy();
    };
  }, [myName]);

  // Update my cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    if (providerRef.current && myName) {
      providerRef.current.awareness.setLocalStateField('cursor', {
        x,
        y,
        name: myName,
        color: myColorRef.current
      });
    }
  }, [myName]);

  // When Local state changes, update Yjs Map
  const setElements = useCallback((newElements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])) => {
    setLocalElements((prev) => {
      const next = typeof newElements === 'function' ? newElements(prev) : newElements;
      
      const ydoc = ydocRef.current;
      const yElements = yElementsRef.current;
      
      if (ydoc && yElements) {
        ydoc.transact(() => {
          const prevIds = new Set(prev.map(el => el.id));
          const nextIds = new Set<string>();

          next.forEach(el => {
            nextIds.add(el.id);
            const existing = yElements.get(el.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(el)) {
              yElements.set(el.id, el);
            }
          });

          // Only delete elements that were in our local state but were explicitly removed
          // This prevents deleting remote elements that just haven't synced to React yet
          prevIds.forEach(id => {
            if (!nextIds.has(id)) {
              yElements.delete(id);
            }
          });
        }, 'local-user'); // tagging the transaction is important for UndoManager!
      }
      return next;
    });
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
  
  const sendChatMessage = useCallback((message: string) => {
    if (yChatRef.current && myName) {
       yChatRef.current.push([{
         id: Math.random().toString(36).substring(2, 9),
         name: myName,
         color: myColorRef.current,
         message,
         timestamp: Date.now()
       }]);
    }
  }, [myName]);

  // Action to start sharing
  const shareSession = useCallback(() => {
    const room = 'inkflow-' + Math.random().toString(36).substring(2, 10);
    const key = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const url = new URL(window.location.href);
    url.hash = `room=${room}&key=${key}`;
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url.toString()).then(() => {
        alert('Link copied to clipboard! Share it to collaborate.');
      }).catch(err => {
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
    // Push awareness immediately
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('cursor', {
        x: 0,
        y: 0,
        name,
        color: myColorRef.current
      });
    }
  }, []);

  return {
    elements,
    setElements,
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
    sendChatMessage
  };
}
