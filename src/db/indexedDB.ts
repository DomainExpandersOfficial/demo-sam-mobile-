import {
  Staff,
  AttendanceRecord,
  TrackingPoint,
  StoreVisit,
  CustomerParty,
  Invoice,
  PaymentRecord,
  DashboardMetrics
} from '../types';

const DB_NAME = 'SamMobileDB_v4';
const DB_VERSION = 1;

export class LocalDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        const storeNames = ['staff', 'attendance', 'tracking', 'visits', 'parties', 'invoices', 'payments'];
        storeNames.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = async (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        await this.seedInitialDataIfEmpty();
        resolve();
      };

      request.onerror = (event: Event) => {
        console.error('IndexedDB error:', event);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async getStore(name: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    const tx = this.db.transaction(name, mode);
    return tx.objectStore(name);
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | null> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async put<T>(storeName: string, item: T): Promise<T> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Domain queries
  async getStaff(): Promise<Staff[]> {
    return this.getAll<Staff>('staff');
  }

  async getAttendance(filter?: string): Promise<AttendanceRecord[]> {
    const all = await this.getAll<AttendanceRecord>('attendance');
    if (!filter || filter === 'all' || filter === 'today') {
      return all.sort((a, b) => b.punchInTime.localeCompare(a.punchInTime));
    }
    if (filter === 'present') return all.filter(a => a.status === 'present');
    if (filter === 'absent') return all.filter(a => a.status === 'absent');
    if (filter === 'late') return all.filter(a => a.punchInTime > '09:15 AM' && a.status === 'present');
    if (filter === 'half_day') return all.filter(a => a.status === 'half_day');
    return all.sort((a, b) => b.punchInTime.localeCompare(a.punchInTime));
  }

  async recordPunchIn(record: AttendanceRecord): Promise<AttendanceRecord> {
    return this.put<AttendanceRecord>('attendance', record);
  }

  async recordPunchOut(id: string, outTime: string, location: string): Promise<AttendanceRecord | null> {
    const rec = await this.getById<AttendanceRecord>('attendance', id);
    if (!rec) return null;
    rec.punchOutTime = outTime;
    rec.punchOutLocation = location;
    return this.put<AttendanceRecord>('attendance', rec);
  }

  async getTrackingPoints(): Promise<TrackingPoint[]> {
    return this.getAll<TrackingPoint>('tracking');
  }

  async addTrackingPoint(pt: TrackingPoint): Promise<TrackingPoint> {
    return this.put<TrackingPoint>('tracking', pt);
  }

  async getStoreVisits(): Promise<StoreVisit[]> {
    const visits = await this.getAll<StoreVisit>('visits');
    return visits.sort((a, b) => b.visitTime.localeCompare(a.visitTime));
  }

  async addStoreVisit(visit: StoreVisit): Promise<StoreVisit> {
    const saved = await this.put<StoreVisit>('visits', visit);
    if (visit.collectionAmount && visit.collectionAmount > 0) {
      const parties = await this.getParties();
      const party = parties.find(p => p.shopName === visit.storeName);
      if (party) {
        await this.addPayment({
          id: 'PAY-' + Date.now(),
          customerId: party.id,
          customerName: party.name,
          shopName: party.shopName,
          amount: visit.collectionAmount,
          paymentMode: 'CASH',
          transactionRef: 'VISIT-CASH-' + Math.floor(1000 + Math.random() * 9000),
          date: '11 Oct 2026',
          collectedBy: visit.staffName,
          notes: `Collected during visit at ${visit.storeName}`
        });
      }
    }
    return saved;
  }

  async toggleVisitVerified(id: string, isVerified: boolean): Promise<StoreVisit | null> {
    const v = await this.getById<StoreVisit>('visits', id);
    if (!v) return null;
    v.isVerified = isVerified;
    return this.put<StoreVisit>('visits', v);
  }

  async getParties(): Promise<CustomerParty[]> {
    return this.getAll<CustomerParty>('parties');
  }

  async addParty(party: CustomerParty): Promise<CustomerParty> {
    return this.put<CustomerParty>('parties', party);
  }

  async updatePartyBalance(id: string, deltaAmount: number): Promise<void> {
    const party = await this.getById<CustomerParty>('parties', id);
    if (party) {
      party.currentBalance = Math.max(0, party.currentBalance + deltaAmount);
      await this.put<CustomerParty>('parties', party);
    }
  }

  async getInvoices(): Promise<Invoice[]> {
    const invoices = await this.getAll<Invoice>('invoices');
    return invoices.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createInvoice(invoice: Invoice): Promise<Invoice> {
    await this.put<Invoice>('invoices', invoice);
    if (invoice.balanceAmount > 0) {
      await this.updatePartyBalance(invoice.customerId, invoice.balanceAmount);
    }
    if (invoice.paidAmount > 0) {
      const mode = invoice.paymentMode === 'CREDIT' ? 'CASH' : (invoice.paymentMode === 'SPLIT' ? 'UPI' : invoice.paymentMode);
      await this.addPayment({
        id: 'PAY-' + Date.now(),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        shopName: invoice.shopName,
        amount: invoice.paidAmount,
        paymentMode: mode as 'UPI' | 'CASH',
        transactionRef: 'UTR' + Math.floor(10000000 + Math.random() * 90000000),
        date: invoice.date || '11 Oct 2026',
        collectedBy: 'Rohit Kumar',
        notes: `Payment against ${invoice.invoiceNumber}`
      });
    }
    return invoice;
  }

  async getPayments(): Promise<PaymentRecord[]> {
    const payments = await this.getAll<PaymentRecord>('payments');
    return payments.sort((a, b) => b.date.localeCompare(a.date));
  }

  async addPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    await this.put<PaymentRecord>('payments', payment);
    await this.updatePartyBalance(payment.customerId, -payment.amount);
    return payment;
  }

  async getMetrics(): Promise<DashboardMetrics> {
    const payments = await this.getPayments();
    const parties = await this.getParties();
    const visits = await this.getStoreVisits();
    const attendance = await this.getAttendance();

    const upiTotal = payments
      .filter(p => p.paymentMode === 'UPI')
      .reduce((sum, p) => sum + p.amount, 0);

    const cashTotal = payments
      .filter(p => p.paymentMode === 'CASH')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalOutstanding = parties.reduce((sum, p) => sum + p.currentBalance, 0);
    const overdueParties = parties.filter(p => p.currentBalance > 0);
    const presentCount = attendance.filter(a => a.status === 'present').length;

    return {
      todayTotalCollection: (upiTotal + cashTotal) || 542800,
      todayUpiCollection: upiTotal || 318000,
      todayCashCollection: cashTotal || 224800,
      totalMarketOutstanding: totalOutstanding || 876500,
      presentStaffCount: presentCount || 20,
      totalVisitsToday: visits.length || 86,
      verifiedVisitsToday: visits.filter(v => v.isVerified).length || 28,
      pendingRemindersCount: overdueParties.length || 42
    };
  }

  async exportAllData(): Promise<string> {
    const data = {
      exportedAt: new Date().toISOString(),
      staff: await this.getAll('staff'),
      attendance: await this.getAll('attendance'),
      tracking: await this.getAll('tracking'),
      visits: await this.getAll('visits'),
      parties: await this.getAll('parties'),
      invoices: await this.getAll('invoices'),
      payments: await this.getAll('payments')
    };
    return JSON.stringify(data, null, 2);
  }

  async importAllData(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      const stores = ['staff', 'attendance', 'tracking', 'visits', 'parties', 'invoices', 'payments'];
      for (const s of stores) {
        if (Array.isArray(data[s])) {
          for (const item of data[s]) {
            await this.put(s, item);
          }
        }
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }

  async resetToDefaults(): Promise<void> {
    const storeNames = ['staff', 'attendance', 'tracking', 'visits', 'parties', 'invoices', 'payments'];
    for (const name of storeNames) {
      const store = await this.getStore(name, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    await this.seedInitialDataIfEmpty(true);
  }

  private async seedInitialDataIfEmpty(force = false) {
    const existing = await this.getAll('staff');
    if (existing.length > 0 && !force) return;

    console.log('Seeding Noida / NCR field force & retail ERP data...');

    // 1. Staff Members (Noida Field Sales Team)
    const mockStaff: Staff[] = [
      { id: 'STF-01', name: 'Rohit Kumar', phone: '0987654321', role: 'sales_executive', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', status: 'active' },
      { id: 'STF-02', name: 'Amit Singh', phone: '0981122334', role: 'sales_executive', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', status: 'active' },
      { id: 'STF-03', name: 'Sandeep Yadav', phone: '0995544332', role: 'sales_executive', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', status: 'logged_out' },
      { id: 'STF-04', name: 'Neha Verma', phone: '0982233445', role: 'sales_executive', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100', status: 'active' },
      { id: 'STF-05', name: 'Rajesh Patel', phone: '0971122334', role: 'sales_executive', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100', status: 'active' },
      { id: 'STF-06', name: 'Priya Singh', phone: '0989911223', role: 'sales_executive', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100', status: 'active' }
    ];
    for (const s of mockStaff) await this.put('staff', s);

    // 2. Attendance Records (Noida / NCR Locations)
    const today = '2026-10-11';
    const mockAttendance: AttendanceRecord[] = [
      { id: 'ATT-01', staffId: 'STF-01', staffName: 'Rohit Kumar', date: today, punchInTime: '09:08 AM', punchOutTime: '06:12 PM', punchInLocation: 'Sector 18, Atta Market, Noida', photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: 'present' },
      { id: 'ATT-02', staffId: 'STF-02', staffName: 'Amit Singh', date: today, punchInTime: '09:12 AM', punchOutTime: '06:01 PM', punchInLocation: 'Sector 62, Electronic City, Noida', photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', status: 'present' },
      { id: 'ATT-03', staffId: 'STF-03', staffName: 'Sandeep Yadav', date: today, punchInTime: '--', punchInLocation: '--', status: 'absent' },
      { id: 'ATT-04', staffId: 'STF-04', staffName: 'Neha Verma', date: today, punchInTime: '09:10 AM', punchOutTime: '06:20 PM', punchInLocation: 'Sector 29 / Botanical Garden, Noida', photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', status: 'present' },
      { id: 'ATT-05', staffId: 'STF-05', staffName: 'Rajesh Patel', date: today, punchInTime: '09:15 AM', punchOutTime: '06:05 PM', punchInLocation: 'Sector 15 Main Market, Noida', photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', status: 'present' },
      { id: 'ATT-06', staffId: 'STF-06', staffName: 'Priya Singh', date: today, punchInTime: '09:20 AM', punchOutTime: '05:45 PM', punchInLocation: 'Greater Noida Knowledge Park', photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', status: 'present' }
    ];
    for (const a of mockAttendance) await this.put('attendance', a);

    // 3. Parties / Customer Records (Noida Retail Directory)
    const mockParties: CustomerParty[] = [
      {
        id: 'CUST-01',
        name: 'Suresh Sharma',
        shopName: 'Sharma Traders',
        phone: '0987654321',
        email: 'sharmatraders@gmail.com',
        address: 'Shop 12, Atta Market, Sector 18, Noida - 201301',
        gstNumber: '09ABCD1234F1Z5',
        biodata: 'A+ Wholesale partner in Sector 18. High volume retailer for mobile covers, chargers and Vivo smartphones. Pays 50% UPI, 50% on 7-day terms.',
        creditLimit: 150000,
        currentBalance: 45000,
        duePaymentDate: '3 days overdue',
        photoUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=200'
      },
      {
        id: 'CUST-02',
        name: 'Manoj Gupta',
        shopName: 'Gupta Mobile Store',
        phone: '0987654322',
        email: 'guptamobile@yahoo.com',
        address: 'G-4, Ganga Shopping Complex, Sector 29, Noida',
        gstNumber: '09BCDEF2345G2Z6',
        biodata: 'Retail store running for 10 years in Sector 29. Fast stock turnaround. Regular daily visits required.',
        creditLimit: 80000,
        currentBalance: 28500,
        duePaymentDate: 'Due tomorrow',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'
      },
      {
        id: 'CUST-03',
        name: 'Rakesh Jain',
        shopName: 'Jain Electronics',
        phone: '0987766554',
        email: 'jainelectronics@gmail.com',
        address: 'C-58, Electronic City, Sector 62, Noida',
        gstNumber: '09CDEFG3456H3Z7',
        biodata: 'Multi-brand gadget showroom near IT hub. Large credit line. Send WhatsApp reminders every Friday.',
        creditLimit: 250000,
        currentBalance: 120000,
        duePaymentDate: '7 days overdue',
        photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200'
      },
      {
        id: 'CUST-04',
        name: 'Deepak Khandelwal',
        shopName: 'Khandelwal Distributors',
        phone: '0987356789',
        address: 'Main Market, Sector 15, Noida',
        biodata: 'Sub-distributor for mobile spares and screen guards. Quick clearance via UPI.',
        creditLimit: 100000,
        currentBalance: 32000,
        duePaymentDate: 'Due in 2 days',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200'
      },
      {
        id: 'CUST-05',
        name: 'Ashok Verma',
        shopName: 'Verma Traders',
        phone: '0987233455',
        address: 'Film City Road, Sector 16A, Noida',
        biodata: 'Accessories and mobile repairing center. Needs follow-up before dispatch.',
        creditLimit: 50000,
        currentBalance: 18000,
        duePaymentDate: '5 days overdue',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
      },
      {
        id: 'CUST-06',
        name: 'Pramod Agarwal',
        shopName: 'Agarwal Telecom',
        phone: '0987323456',
        address: 'Jagat Farm Market, Greater Noida',
        biodata: 'Clean payment record. Zero overdue. Pays 100% on delivery via PhonePe.',
        creditLimit: 100000,
        currentBalance: 0,
        duePaymentDate: 'Paid',
        photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200'
      }
    ];
    for (const p of mockParties) await this.put('parties', p);

    // 4. Store Visits (with photos)
    const mockVisits: StoreVisit[] = [
      {
        id: 'VST-01',
        staffId: 'STF-01',
        staffName: 'Rohit Kumar',
        storeName: 'Kumar Mobile Point',
        ownerName: 'Sunil Kumar',
        phone: '0987654321',
        address: 'Atta Market, Sector 18, Noida (Auto-captured)',
        latitude: 28.5708,
        longitude: 77.3271,
        photoUrl: 'https://images.unsplash.com/photo-1555421689-d68471e189f2?w=500',
        visitTime: '10:24 AM',
        isVerified: true,
        notes: 'Stock checked, good response. Owner requested 20 units of screen guards.'
      },
      {
        id: 'VST-02',
        staffId: 'STF-01',
        staffName: 'Rohit Kumar',
        storeName: 'Sharma Traders',
        ownerName: 'Suresh Sharma',
        phone: '0987654321',
        address: 'Shop 12, Sector 18, Noida',
        latitude: 28.5715,
        longitude: 77.3265,
        photoUrl: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500',
        visitTime: '11:15 AM',
        isVerified: true,
        notes: 'Payment of ₹ 25,000 received via UPI on the spot.'
      },
      {
        id: 'VST-03',
        staffId: 'STF-02',
        staffName: 'Amit Singh',
        storeName: 'Gupta Mobile Store',
        ownerName: 'Manoj Gupta',
        phone: '0987654322',
        address: 'Sector 29, Ganga Shopping Complex, Noida',
        latitude: 28.5645,
        longitude: 77.3340,
        photoUrl: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=500',
        visitTime: '12:30 PM',
        isVerified: true,
        notes: 'New sample kit handed over.'
      }
    ];
    for (const v of mockVisits) await this.put('visits', v);

    // 5. Tracking Points (Real Coordinates for Noida / NCR)
    const mockTracking: TrackingPoint[] = [
      { id: 'TRK-01', staffId: 'STF-01', staffName: 'Rohit Kumar', timestamp: '10:24 AM', latitude: 28.5708, longitude: 77.3271, address: 'Sector 18, Atta Market, Noida', batteryLevel: 92, isOnline: true },
      { id: 'TRK-02', staffId: 'STF-02', staffName: 'Amit Singh', timestamp: '10:20 AM', latitude: 28.6280, longitude: 77.3649, address: 'Sector 62, Electronic City, Noida', batteryLevel: 85, isOnline: true },
      { id: 'TRK-03', staffId: 'STF-04', staffName: 'Neha Verma', timestamp: '10:26 AM', latitude: 28.5645, longitude: 77.3340, address: 'Sector 29 / Botanical Garden, Noida', batteryLevel: 95, isOnline: true },
      { id: 'TRK-04', staffId: 'STF-05', staffName: 'Rajesh Patel', timestamp: '10:15 AM', latitude: 28.5835, longitude: 77.3150, address: 'Sector 15 Main Market, Noida', batteryLevel: 78, isOnline: true },
      { id: 'TRK-05', staffId: 'STF-06', staffName: 'Priya Singh', timestamp: '10:22 AM', latitude: 28.4744, longitude: 77.4930, address: 'Knowledge Park, Greater Noida', batteryLevel: 88, isOnline: true }
    ];
    for (const t of mockTracking) await this.put('tracking', t);

    // 6. Invoices (Sample invoice with 15-digit IMEI tracking)
    const mockInvoices: Invoice[] = [
      {
        id: 'INV-2026-0156',
        invoiceNumber: 'INV-2026-0156',
        customerId: 'CUST-01',
        customerName: 'Suresh Sharma',
        shopName: 'Sharma Traders',
        customerPhone: '0987654321',
        date: '11 Oct 2026',
        items: [
          { id: 'ITM-01', description: 'Vivo Y200 5G (8GB/128GB)', imeiNumber: '864201051234567', quantity: 1, rate: 21999, amount: 21999 },
          { id: 'ITM-02', description: 'Screen Guard 11D Premium', imeiNumber: 'N/A', quantity: 20, rate: 50, amount: 1000 }
        ],
        subtotal: 22999,
        gstPercent: 18,
        gstAmount: 4139.82,
        totalAmount: 27138.82,
        paidAmount: 27138.82,
        balanceAmount: 0,
        paymentMode: 'UPI',
        status: 'paid'
      }
    ];
    for (const inv of mockInvoices) await this.put('invoices', inv);

    // 7. Payments Collections
    const mockPayments: PaymentRecord[] = [
      { id: 'PAY-01', customerId: 'CUST-01', customerName: 'Suresh Sharma', shopName: 'Sharma Traders', amount: 25000, paymentMode: 'UPI', transactionRef: 'UTR98172635', date: '11 Oct 2026', collectedBy: 'Rohit Kumar', notes: 'Verified visit UPI settlement' },
      { id: 'PAY-02', customerId: 'CUST-02', customerName: 'Manoj Gupta', shopName: 'Gupta Mobile Store', amount: 15000, paymentMode: 'CASH', transactionRef: 'CASH-NOIDA-098', date: '11 Oct 2026', collectedBy: 'Amit Singh', notes: 'Cash collection in Sector 29' },
      { id: 'PAY-03', customerId: 'CUST-03', customerName: 'Rakesh Jain', shopName: 'Jain Electronics', amount: 20000, paymentMode: 'UPI', transactionRef: 'UTR56473829', date: '10 Oct 2026', collectedBy: 'Neha Verma', notes: 'Partial clearance for Sector 62' },
      { id: 'PAY-04', customerId: 'CUST-04', customerName: 'Deepak Khandelwal', shopName: 'Khandelwal Distributors', amount: 18000, paymentMode: 'CASH', transactionRef: 'CASH-NOIDA-099', date: '10 Oct 2026', collectedBy: 'Rajesh Patel', notes: 'Settlement for Sector 15 order' },
      { id: 'PAY-05', customerId: 'CUST-05', customerName: 'Ashok Verma', shopName: 'Verma Traders', amount: 12000, paymentMode: 'UPI', transactionRef: 'UTR38495021', date: '09 Oct 2026', collectedBy: 'Rohit Kumar', notes: 'Advance for accessories' }
    ];
    for (const p of mockPayments) await this.put('payments', p);

    console.log('Seeding finished successfully!');
  }
}

export const localDb = new LocalDatabase();
