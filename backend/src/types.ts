export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: 'sales_executive' | 'manager' | 'delivery';
  avatar: string;
  status: 'active' | 'on_break' | 'logged_out';
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  punchInTime: string;
  punchOutTime?: string;
  punchInLocation: string;
  punchOutLocation?: string;
  photoUrl?: string;
  status: 'present' | 'half_day' | 'absent';
}

export interface TrackingPoint {
  id: string;
  staffId: string;
  staffName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string;
  batteryLevel: number;
  isOnline: boolean;
}

export interface StoreVisit {
  id: string;
  staffId: string;
  staffName: string;
  storeName: string;
  ownerName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string;
  visitTime: string;
  isVerified: boolean;
  notes: string;
  collectionAmount?: number;
}

export interface CustomerParty {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  email?: string;
  address: string;
  gstNumber?: string;
  biodata: string;
  creditLimit: number;
  currentBalance: number;
  duePaymentDate?: string;
  photoUrl?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  imeiNumber: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  shopName: string;
  customerPhone: string;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: 'UPI' | 'CASH' | 'SPLIT' | 'CREDIT';
  status: 'paid' | 'partial' | 'unpaid';
}

export interface PaymentRecord {
  id: string;
  invoiceId?: string;
  customerId: string;
  customerName: string;
  shopName: string;
  amount: number;
  paymentMode: 'UPI' | 'CASH';
  transactionRef?: string;
  date: string;
  collectedBy: string;
  notes?: string;
}
