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

export function useMultiplayer(initialElements: DrawingElement[]) {
  const [elements, setLocalElements] = useState<DrawingElement[]>(initialElements);
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});
  const [myName, setMyName] = useState<string>('');
  const [isShared, setIsShared] = useState<boolean>(false);
  const [roomUrl, setRoomUrl] = useState<string>('');
  
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const yElementsRef = useRef<Y.Map<DrawingElement> | null>(null);

  // We assign a random color for our own cursor
  const myColorRef = useRef<string>(`hsl(${Math.random() * 360}, 80%, 50%)`);

  // Handle URL hash changes to initialize or destroy WebRTC
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', '?'));
      const room = params.get('room');
      const key = params.get('key');

      if (room && key) {
        setIsShared(true);
        setRoomUrl(window.location.href);

        if (!ydocRef.current) {
          const ydoc = new Y.Doc();
          ydocRef.current = ydoc;

          const provider = new WebrtcProvider(room, ydoc, {
            password: key,
            signaling: [
              'wss://signaling.yjs.dev',
              'wss://y-webrtc-signaling-eu.herokuapp.com',
              'wss://y-webrtc-signaling-us.herokuapp.com'
            ]
          });
          providerRef.current = provider;

          const yElements = ydoc.getMap<DrawingElement>('elements');
          yElementsRef.current = yElements;

          // Sync from remote to local
          yElements.observe(() => {
            const newElements = Array.from(yElements.values());
            // Sort elements by timestamp fallback to ID to ensure stable render order
            newElements.sort((a, b) => a.id.localeCompare(b.id));
            setLocalElements(newElements);
          });

          // Handle awareness (cursors)
          const awareness = provider.awareness;
          awareness.on('change', () => {
            const states = awareness.getStates();
            const cursors: Record<number, RemoteCursor> = {};
            states.forEach((state, clientID) => {
              if (clientID !== ydoc.clientID && state.cursor) {
                cursors[clientID] = state.cursor;
              }
            });
            setRemoteCursors(cursors);
          });
        }
      } else {
        setIsShared(false);
        setRoomUrl('');
        if (providerRef.current) {
          providerRef.current.destroy();
          providerRef.current = null;
        }
        if (ydocRef.current) {
          ydocRef.current.destroy();
          ydocRef.current = null;
          yElementsRef.current = null;
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      if (providerRef.current) providerRef.current.destroy();
      if (ydocRef.current) ydocRef.current.destroy();
    };
  }, []);

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
          const currentIds = new Set(yElements.keys());
          const nextIds = new Set<string>();

          next.forEach(el => {
            nextIds.add(el.id);
            const existing = yElements.get(el.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(el)) {
              yElements.set(el.id, el);
            }
          });

          currentIds.forEach(id => {
            if (!nextIds.has(id)) {
              yElements.delete(id);
            }
          });
        });
      }
      return next;
    });
  }, []);

  // Action to start sharing
  const shareSession = useCallback(() => {
    const room = 'inkflow-' + Math.random().toString(36).substring(2, 10);
    const key = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const url = new URL(window.location.href);
    url.hash = `room=${room}&key=${key}`;
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      alert('Link copied to clipboard! Share it to collaborate.');
    });
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
    updateMyName
  };
}
