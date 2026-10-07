/**
 * Local Database Schema Types for Offline-First Architecture
 */

export interface CustomerEntity {
  id: string; // UUID v4
  customer_code: string;
  name: string;
  phone?: string;
  address?: string;
  sync_status: 0 | 1; // 0: Unsynced, 1: Synced
  updated_at: number; // Timestamp ms
  is_deleted: 0 | 1; // 0: Active, 1: Soft deleted
  ownerId?: string;
  [key: string]: any;
}

export interface ProductEntity {
  id: string; // UUID v4
  product_code: string;
  name: string;
  unit?: string;
  base_price: number;
  local_image_path?: string | null;
  sync_status: 0 | 1;
  updated_at: number;
  is_deleted: 0 | 1;
  ownerId?: string;
  [key: string]: any;
}

export interface OrderEntity {
  id: string; // UUID v4
  order_code: string; // MOB-XXXX or PC-XXXX
  customer_id: string;
  total_amount: number;
  note?: string;
  is_printed: 0 | 1; // 0: Not printed, 1: Printed
  local_image_path?: string | null;
  image_sync_status: 0 | 1; // 0: Missing/Unsynced, 1: Synced
  sync_status: 0 | 1;
  created_at: number;
  updated_at: number;
  is_deleted: 0 | 1;
  ownerId?: string;
  items?: OrderItemEntity[];
  [key: string]: any;
}

export interface OrderItemEntity {
  id: string; // UUID v4
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sync_status: 0 | 1;
  updated_at: number;
  product_name?: string;
  unit?: string;
  ownerId?: string;
  [key: string]: any;
}

export interface AppMetadataEntity {
  key_name: string;
  key_value: string;
}

export interface SyncPayload {
  customers: CustomerEntity[];
  products: ProductEntity[];
  orders: OrderEntity[];
  order_items: OrderItemEntity[];
  [collection: string]: any[];
}
