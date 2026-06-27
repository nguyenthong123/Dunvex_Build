export interface Timestamp {
  seconds: number;
  nanoseconds: number;
}

export interface BaseRecord {
  id: string;
  ownerId: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface Product extends BaseRecord {
  name: string;
  code?: string;
  category?: string;
  price: number;
  priceImport: number;
  stock: number;
  unit: string;
  imageUrl?: string;
}

export interface Supplier extends BaseRecord {
  name: string;
  phone?: string;
  address?: string;
  taxCode?: string;
  totalDebt: number;
}

export interface Customer extends BaseRecord {
  name: string;
  phone?: string;
  address?: string;
  taxCode?: string;
  totalDebt: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  priceImport?: number;
}

export interface Order extends BaseRecord {
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  note?: string;
  status: string;
  orderDate?: string;
  createdBy?: string;
}

export interface PurchaseOrder extends BaseRecord {
  supplierId: string;
  supplierName: string;
  items: OrderItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  note?: string;
  status: string;
  orderDate?: string;
  createdBy?: string;
}

export interface SupplierDebt extends BaseRecord {
  supplierId: string;
  supplierName: string;
  type: 'debt_increase' | 'payment' | 'cancellation';
  amount: number;
  note?: string;
  orderId?: string;
  createdBy?: string;
}

export interface CustomerDebt extends BaseRecord {
  customerId: string;
  customerName: string;
  type: 'debt_increase' | 'payment' | 'cancellation';
  amount: number;
  note?: string;
  orderId?: string;
  createdBy?: string;
}
