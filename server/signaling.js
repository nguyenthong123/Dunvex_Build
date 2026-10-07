import { Server } from 'socket.io';

export let ioInstance = null;

// Map of socket.id -> { socketId, ownerId, deviceId, deviceType, deviceName, connectedAt }
const connectedDevices = new Map();

/**
 * Initialize Socket.io Signaling Server
 * @param {import('http').Server} httpServer
 */
export function initSignaling(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: 5e7 // 50MB buffer for fallback relay streaming
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    // ─── 1. Device Registration ─────────────────────────────
    socket.on('device:register', (data) => {
      try {
        const { ownerId, deviceId, deviceType = 'web', deviceName = 'Device' } = data || {};
        if (!ownerId || !deviceId) {
          socket.emit('error', { message: 'Missing ownerId or deviceId' });
          return;
        }

        const devInfo = {
          socketId: socket.id,
          ownerId,
          deviceId,
          deviceType, // 'mobile' | 'desktop' | 'web'
          deviceName,
          connectedAt: Date.now()
        };

        connectedDevices.set(socket.id, devInfo);
        socket.join(`owner:${ownerId}`);
        socket.join(`device:${deviceId}`);

        console.log(`[Signaling] Device registered: ${deviceName} (${deviceType}) [ID: ${deviceId}] for Owner: ${ownerId}`);

        // Broadcast to other devices of same owner
        socket.to(`owner:${ownerId}`).emit('device:online', {
          deviceId,
          deviceType,
          deviceName,
          connectedAt: devInfo.connectedAt
        });

        // Send current online devices to the registered device
        const peers = [];
        for (const [sId, peer] of connectedDevices.entries()) {
          if (peer.ownerId === ownerId && peer.deviceId !== deviceId) {
            peers.push({
              deviceId: peer.deviceId,
              deviceType: peer.deviceType,
              deviceName: peer.deviceName,
              connectedAt: peer.connectedAt
            });
          }
        }
        socket.emit('device:registered', { success: true, peers });
      } catch (err) {
        console.error('[Signaling] Register error:', err);
      }
    });

    // ─── 2. Request P2P Sync (PC -> Mobile) ─────────────────
    socket.on('p2p:request_sync', (data) => {
      try {
        const sender = connectedDevices.get(socket.id);
        const { targetDeviceId, orderIds = [] } = data || {};
        if (!sender || !targetDeviceId) return;

        console.log(`[Signaling] P2P Sync Request from ${sender.deviceId} to ${targetDeviceId} for ${orderIds.length} orders`);

        io.to(`device:${targetDeviceId}`).emit('p2p:incoming_request', {
          fromDeviceId: sender.deviceId,
          fromDeviceType: sender.deviceType,
          orderIds
        });
      } catch (err) {
        console.error('[Signaling] Request sync error:', err);
      }
    });

    // ─── 3. WebRTC Signaling (Offer, Answer, ICE Candidates) ──
    socket.on('p2p:signal', (data) => {
      try {
        const sender = connectedDevices.get(socket.id);
        const { targetDeviceId, signalData } = data || {};
        if (!sender || !targetDeviceId || !signalData) return;

        io.to(`device:${targetDeviceId}`).emit('p2p:signal', {
          fromDeviceId: sender.deviceId,
          signalData
        });
      } catch (err) {
        console.error('[Signaling] WebRTC Signal error:', err);
      }
    });

    // ─── 4. Fallback Relay Chunk Streaming (Zalo-style Direct Stream via Socket) ──
    // Zero disk storage on VPS - piped directly between sockets in memory
    socket.on('p2p:relay_chunk', (data) => {
      try {
        const sender = connectedDevices.get(socket.id);
        const { targetDeviceId, fileId, orderId, chunkIndex, totalChunks, chunkData, mimeType } = data || {};
        if (!sender || !targetDeviceId || !chunkData) return;

        io.to(`device:${targetDeviceId}`).emit('p2p:relay_chunk', {
          fromDeviceId: sender.deviceId,
          fileId,
          orderId,
          chunkIndex,
          totalChunks,
          chunkData,
          mimeType
        });
      } catch (err) {
        console.error('[Signaling] Relay chunk error:', err);
      }
    });

    socket.on('p2p:relay_complete', (data) => {
      try {
        const sender = connectedDevices.get(socket.id);
        const { targetDeviceId, fileId, orderId, localPath } = data || {};
        if (!sender || !targetDeviceId) return;

        io.to(`device:${targetDeviceId}`).emit('p2p:relay_complete', {
          fromDeviceId: sender.deviceId,
          fileId,
          orderId,
          localPath
        });
      } catch (err) {
        console.error('[Signaling] Relay complete error:', err);
      }
    });

    // ─── 5. Disconnect ──────────────────────────────────────
    socket.on('disconnect', () => {
      const dev = connectedDevices.get(socket.id);
      if (dev) {
        connectedDevices.delete(socket.id);
        io.to(`owner:${dev.ownerId}`).emit('device:offline', {
          deviceId: dev.deviceId,
          deviceType: dev.deviceType
        });
        console.log(`[Signaling] Device disconnected: ${dev.deviceName} (${dev.deviceId})`);
      }
    });
  });

  console.log('[Signaling] Socket.io P2P Signaling Server initialized');
  return io;
}
