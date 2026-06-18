/**
 * Notification utilities - tạo thông báo cho toàn tổ chức hoặc riêng admin
 */
import { db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

type NotifPayload = {
  title: string;
  body: string;
  type: string;
  priority?: 'low' | 'normal' | 'high';
};

/**
 * Tạo thông báo cho TẤT CẢ thành viên trong tổ chức (dựa trên ownerId)
 */
export async function createOrgNotification(ownerId: string, payload: NotifPayload) {
  try {
    const usersSnap = await getDocs(query(
      collection(db, 'users'),
      where('ownerId', '==', ownerId),
      where('status', '==', 'active')
    ));
    const pendingSnap = await getDocs(query(
      collection(db, 'permissions'),
      where('ownerId', '==', ownerId)
    ));

    const allUsers = [...usersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      ...pendingSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))];

    const batch = allUsers.map(user =>
      addDoc(collection(db, 'notifications'), {
        userId: user.id || user.email,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        priority: payload.priority || 'normal',
        read: false,
        createdAt: serverTimestamp()
      })
    );
    await Promise.all(batch);
  } catch (e) {
    console.error('createOrgNotification error:', e);
  }
}

/**
 * Tạo thông báo cho CHỈ ADMIN trong tổ chức
 */
export async function createAdminNotification(ownerId: string, payload: NotifPayload) {
  try {
    const usersSnap = await getDocs(query(
      collection(db, 'users'),
      where('ownerId', '==', ownerId),
      where('role', '==', 'admin')
    ));

    const batch = usersSnap.docs.map(user =>
      addDoc(collection(db, 'notifications'), {
        userId: user.id,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        priority: payload.priority || 'high',
        read: false,
        createdAt: serverTimestamp()
      })
    );
    await Promise.all(batch);
  } catch (e) {
    console.error('createAdminNotification error:', e);
  }
}

/**
 * Tạo thông báo cho người dùng cụ thể
 */
export async function createUserNotification(userId: string, payload: NotifPayload) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      priority: payload.priority || 'normal',
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error('createUserNotification error:', e);
  }
}
