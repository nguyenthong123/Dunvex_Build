import { io, Socket } from 'socket.io-client';
import { localDb } from './localDb';
import { localFileService } from './localFileService';
import { getCurrentSessionUser } from './sqliteSession';
import { syncEngine } from './syncEngine';
import { isNativeApp } from '../utils/platform';

export interface P2PDevice {
  deviceId: string;
  deviceType: 'mobile' | 'desktop' | 'web';
  deviceName: string;
  connectedAt: number;
}

export interface P2PProgressState {
  isTransferring: boolean;
  role: 'sender' | 'receiver' | 'idle';
  statusMessage: string;
  currentOrderCode?: string;
  progressPercent: number;
  totalImages: number;
  completedImages: number;
}

type P2PListener = (state: P2PProgressState) => void;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

class P2PSyncService {
  private socket: Socket | null = null;
  private deviceId: string | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onlinePeers: P2PDevice[] = [];
  private listeners = new Set<P2PListener>();

  // Buffer for assembling incoming binary chunks: fileId -> ArrayBuffer[]
  private incomingChunks = new Map<string, { chunks: ArrayBuffer[]; totalChunks: number; orderId: string; mimeType: string }>();

  private state: P2PProgressState = {
    isTransferring: false,
    role: 'idle',
    statusMessage: '',
    progressPercent: 0,
    totalImages: 0,
    completedImages: 0
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('dunvex_login', () => {
        if (isNativeApp()) void this.connect();
      });
      window.addEventListener('dunvex_logout', () => {
        this.disconnect();
      });
    }
  }

  public subscribe(listener: P2PListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private updateState(partial: Partial<P2PProgressState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => fn(this.state));
  }

  /**
   * Connect to Signaling Server & Register Device
   */
  public async connect(): Promise<void> {
    if (!isNativeApp()) return;
    if (this.socket && this.socket.connected) return;

    const user = getCurrentSessionUser();
    const ownerId = user?.ownerId || user?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('dunvex_owner_id') : '');
    if (!ownerId) return;

    const deviceId = await localDb.getDeviceId();
    this.deviceId = deviceId;
    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    const deviceName = `${isMobile ? 'Điện thoại' : 'Máy tính'} (${deviceId.substring(0, 6)})`;

    const socketUrl = typeof window !== 'undefined' && window.location.origin.includes('localhost:5173')
      ? 'http://localhost:5000'
      : window.location.origin;

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('device:register', {
        ownerId,
        deviceId,
        deviceType,
        deviceName,
      });
    });

    this.socket.on('device:registered', (data: { peers: P2PDevice[] }) => {
      this.onlinePeers = data.peers || [];
      this.updateState({
        statusMessage: this.onlinePeers.length > 0 
          ? `Đã kết nối với ${this.onlinePeers.length} thiết bị cùng tài khoản.`
          : 'Đã sẵn sàng. Đang chờ thiết bị khác đăng nhập cùng tài khoản.'
      });
      void this.autoTriggerImageSyncIfMissing();
    });

    this.socket.on('device:online', (peer: P2PDevice) => {
      this.onlinePeers = this.onlinePeers.filter(p => p.deviceId !== peer.deviceId).concat(peer);
      this.updateState({
        statusMessage: `Thiết bị ${peer.deviceName} vừa kết nối trực tuyến.`
      });
      void this.autoTriggerImageSyncIfMissing();
    });

    this.socket.on('device:offline', (data: { deviceId: string }) => {
      this.onlinePeers = this.onlinePeers.filter(p => p.deviceId !== data.deviceId);
      this.updateState({
        statusMessage: 'Một thiết bị đã ngắt kết nối.'
      });
    });

    this.socket.on('sync:remote_data_pushed', (data: { senderDeviceId?: string; affectedTables?: string[] }) => {
      if (data.senderDeviceId === this.deviceId) return;
      void syncEngine.syncNow(true);
      setTimeout(() => {
        void this.autoTriggerImageSyncIfMissing();
      }, 1500);
    });

    // ─── P2P Signaling Listeners ─────────────────────────────
    this.socket.on('p2p:incoming_request', async (data: { fromDeviceId: string; orderIds: string[] }) => {
      await this.handleIncomingSyncRequest(data.fromDeviceId, data.orderIds);
    });

    this.socket.on('p2p:signal', async (data: { fromDeviceId: string; signalData: any }) => {
      await this.handleIncomingSignal(data.fromDeviceId, data.signalData);
    });

    // Fallback direct socket relay chunk receiver
    this.socket.on('p2p:relay_chunk', async (data) => {
      await this.handleReceivedChunk(data);
    });

    this.socket.on('p2p:relay_complete', async (data) => {
      await this.handleReceivedComplete(data);
    });
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.deviceId = null;
    this.onlinePeers = [];
  }

  public getOnlinePeers(): P2PDevice[] {
    return this.onlinePeers;
  }

  /**
   * Check if this device has orders missing images and automatically request them from an online peer
   */
  public async autoTriggerImageSyncIfMissing(): Promise<void> {
    if (this.state.isTransferring || this.onlinePeers.length === 0) return;
    try {
      const missingOrders = await localDb.getOrdersMissingImages();
      if (missingOrders.length > 0) {
        // If there is any online peer, request sync
        void this.requestImageSyncFromPhone();
      }
    } catch (e) {
      console.warn('[P2PSync] Auto image check error:', e);
    }
  }

  // ─── SENDER SIDE (Mobile / Phone) ──────────────────────────

  private async handleIncomingSyncRequest(fromDeviceId: string, orderIds: string[]) {
    if (!orderIds || orderIds.length === 0) return;

    this.updateState({
      isTransferring: true,
      role: 'sender',
      statusMessage: 'Đang đồng bộ hình ảnh sang máy tính... Vui lòng không đóng ứng dụng và giữ kết nối mạng.',
      totalImages: orderIds.length,
      completedImages: 0,
      progressPercent: 0,
    });

    try {
      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const order = await localDb.getOrderWithItems(orderId);
        if (!order || !order.local_image_path) continue;

        this.updateState({
          currentOrderCode: order.order_code,
          statusMessage: `Đang gửi ảnh đơn hàng ${order.order_code}...`,
        });

        const blob = await localFileService.getImageBlob(order.local_image_path);
        if (!blob) continue;

        // Split image into 64KB binary chunks
        const chunks = await localFileService.splitFileIntoChunks(blob);
        const fileId = `file_${orderId}_${Date.now()}`;

        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const chunkData = chunks[cIdx];

          // Stream via Socket Relay fallback (or WebRTC DataChannel if open)
          this.socket?.emit('p2p:relay_chunk', {
            targetDeviceId: fromDeviceId,
            fileId,
            orderId,
            chunkIndex: cIdx,
            totalChunks: chunks.length,
            chunkData,
            mimeType: blob.type || 'image/jpeg',
          });

          // Small yield to prevent socket buffer congestion
          if (cIdx % 5 === 0) {
            await new Promise(r => setTimeout(r, 10));
          }
        }

        this.socket?.emit('p2p:relay_complete', {
          targetDeviceId: fromDeviceId,
          fileId,
          orderId,
        });

        this.updateState({
          completedImages: i + 1,
          progressPercent: Math.round(((i + 1) / orderIds.length) * 100),
        });
      }

      this.updateState({
        isTransferring: false,
        role: 'idle',
        statusMessage: 'Đồng bộ hình ảnh hoàn tất!',
        progressPercent: 100,
      });
    } catch (err: any) {
      console.error('[P2P Sender] Error:', err);
      this.updateState({
        isTransferring: false,
        statusMessage: `Lỗi đồng bộ: ${err.message || 'Lỗi truyền tải'}`,
      });
    }
  }

  // ─── RECEIVER SIDE (Desktop / PC) ──────────────────────────

  public async requestImageSyncFromPhone(targetDeviceId?: string): Promise<boolean> {
    await this.connect();

    const missingOrders = await localDb.getOrdersMissingImages();
    if (missingOrders.length === 0) {
      this.updateState({
        statusMessage: 'Tất cả đơn hàng đều đã có hình ảnh.',
        progressPercent: 100,
      });
      return false;
    }

    // Pick target phone
    let target = targetDeviceId;
    if (!target) {
      const mobilePeer = this.onlinePeers.find(p => p.deviceType === 'mobile');
      if (mobilePeer) target = mobilePeer.deviceId;
    }

    if (!target) {
      this.updateState({
        statusMessage: 'Không tìm thấy điện thoại nào đang online trong cửa hàng để đồng bộ.',
      });
      return false;
    }

    const orderIds = missingOrders.map(o => o.id);

    this.updateState({
      isTransferring: true,
      role: 'receiver',
      statusMessage: `Đang yêu cầu đồng bộ ${orderIds.length} hình ảnh từ điện thoại...`,
      totalImages: orderIds.length,
      completedImages: 0,
      progressPercent: 0,
    });

    this.socket?.emit('p2p:request_sync', {
      targetDeviceId: target,
      orderIds,
    });

    return true;
  }

  private async handleReceivedChunk(data: {
    fileId: string;
    orderId: string;
    chunkIndex: number;
    totalChunks: number;
    chunkData: ArrayBuffer;
    mimeType: string;
  }) {
    const { fileId, orderId, chunkIndex, totalChunks, chunkData, mimeType } = data;

    if (!this.incomingChunks.has(fileId)) {
      this.incomingChunks.set(fileId, {
        chunks: new Array(totalChunks),
        totalChunks,
        orderId,
        mimeType: mimeType || 'image/jpeg',
      });
    }

    const fileEntry = this.incomingChunks.get(fileId)!;
    fileEntry.chunks[chunkIndex] = chunkData;
  }

  private async handleReceivedComplete(data: { fileId: string; orderId: string }) {
    const { fileId, orderId } = data;
    const fileEntry = this.incomingChunks.get(fileId);
    if (!fileEntry) return;

    try {
      // Reassemble chunks
      const assembledBlob = localFileService.assembleChunks(fileEntry.chunks, fileEntry.mimeType);

      // Save file locally to device storage
      const saved = await localFileService.saveImage(assembledBlob, `order_${orderId}.jpg`);

      // Update SQLite local record
      await localDb.updateOrderImagePath(orderId, saved.localPath);

      this.incomingChunks.delete(fileId);

      const completed = this.state.completedImages + 1;
      const percent = this.state.totalImages > 0 ? Math.round((completed / this.state.totalImages) * 100) : 100;

      this.updateState({
        completedImages: completed,
        progressPercent: percent,
        statusMessage: `Đã nhận thành công ảnh cho đơn hàng (${completed}/${this.state.totalImages})`,
      });

      if (completed >= this.state.totalImages) {
        this.updateState({
          isTransferring: false,
          role: 'idle',
          statusMessage: 'Hoàn tất đồng bộ hình ảnh về máy tính!',
          progressPercent: 100,
        });
      }
    } catch (err: any) {
      console.error('[P2P Receiver] Save error:', err);
    }
  }

  private async handleIncomingSignal(fromDeviceId: string, signalData: any) {
    // Optional WebRTC direct signaling hook
  }
}

export const p2pSync = new P2PSyncService();
