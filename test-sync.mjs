// Test script: verify y-websocket sync between two clients
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ROOM = 'inkflow-test-' + Math.random().toString(36).substring(2, 8);
const SERVER = 'wss://demos.yjs.dev';

console.log(`[Test] Room: ${ROOM}`);
console.log(`[Test] Server: ${SERVER}`);
console.log('');

// --- Client A ---
const docA = new Y.Doc();
const mapA = docA.getMap('elements');
const providerA = new WebsocketProvider(SERVER, ROOM, docA);

// --- Client B ---
const docB = new Y.Doc();
const mapB = docB.getMap('elements');
const providerB = new WebsocketProvider(SERVER, ROOM, docB);

// Track connection status
providerA.on('status', (e) => console.log(`[Client A] status: ${e.status}`));
providerB.on('status', (e) => console.log(`[Client B] status: ${e.status}`));

// Track sync status  
providerA.on('sync', (isSynced) => console.log(`[Client A] synced: ${isSynced}`));
providerB.on('sync', (isSynced) => console.log(`[Client B] synced: ${isSynced}`));

// Observe changes on Client B
mapB.observe(() => {
  const values = Array.from(mapB.entries());
  console.log(`[Client B] mapB changed! Keys: ${values.map(([k]) => k).join(', ')}`);
  values.forEach(([k, v]) => {
    console.log(`  ${k}: ${JSON.stringify(v)}`);
  });
});

// Wait for both to connect, then test
setTimeout(() => {
  console.log('');
  console.log('[Test] --- Writing element to Client A ---');
  docA.transact(() => {
    mapA.set('test-element-1', {
      id: 'test-element-1',
      type: 'rectangle',
      x1: 100, y1: 100, x2: 300, y2: 200
    });
  });
  console.log(`[Client A] mapA size after write: ${mapA.size}`);
}, 3000);

// Check result after giving time to sync
setTimeout(() => {
  console.log('');
  console.log('[Test] --- Final state ---');
  console.log(`[Client A] mapA size: ${mapA.size}`);
  console.log(`[Client B] mapB size: ${mapB.size}`);
  
  if (mapB.size > 0 && mapB.has('test-element-1')) {
    console.log('');
    console.log('✅ SYNC WORKS! Client B received Client A\'s element.');
    console.log(`  Element: ${JSON.stringify(mapB.get('test-element-1'))}`);
  } else {
    console.log('');
    console.log('❌ SYNC FAILED! Client B did NOT receive Client A\'s element.');
    console.log('  The WebSocket server may be down or not working.');
  }
  
  providerA.destroy();
  providerB.destroy();
  process.exit(0);
}, 6000);
