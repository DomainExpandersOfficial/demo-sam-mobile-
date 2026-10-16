import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Staff,
  AttendanceRecord,
  TrackingPoint,
  StoreVisit,
  CustomerParty,
  Invoice,
  PaymentRecord
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');

interface Schema {
  staff: Staff[];
  attendance: AttendanceRecord[];
  tracking: TrackingPoint[];
  visits: StoreVisit[];
  parties: CustomerParty[];
  invoices: Invoice[];
  payments: PaymentRecord[];
}

export class DataStore {
  private data: Schema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): Schema {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Error reading data.json, initializing fresh store', err);
      }
    }
    const initial = this.getInitialMockData();
    this.saveData(initial);
    return initial;
  }

  private saveData(data: Schema) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save data.json', err);
    }
  }

  private getInitialMockData(): Schema {
    const today = new Date().toISOString().split('T')[0];
    return {
      staff: [
        { id: 'STF-01', name: 'Ramesh Kumar', phone: '9300035900', role: 'sales_executive', avatar: '👨‍💼', status: 'active' },
        { id: 'STF-02', name: 'Vikas Sharma', phone: '9811234567', role: 'sales_executive', avatar: '🧑‍💻', status: 'active' },
        { id: 'STF-03', name: 'Amit Singh', phone: '9955443322', role: 'delivery', avatar: '🛵', status: 'active' }
      ],
      attendance: [
        {
          id: 'ATT-101',
          staffId: 'STF-01',
          staffName: 'Ramesh Kumar',
          date: today,
          punchInTime: '09:32 AM',
          punchInLocation: 'Sector 18 Metro Station, Noida',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          status: 'present'
        }
      ],
      tracking: [
        { id: 'TRK-01', staffId: 'STF-01', staffName: 'Ramesh Kumar', timestamp: '09:30 AM', latitude: 28.5703, longitude: 77.3218, address: 'Sector 18 Metro Station, Noida', batteryLevel: 94, isOnline: true },
        { id: 'TRK-02', staffId: 'STF-01', staffName: 'Ramesh Kumar', timestamp: '10:15 AM', latitude: 28.5685, longitude: 77.3312, address: 'Atta Market, Sector 18, Noida', batteryLevel: 91, isOnline: true }
      ],
      visits: [
        {
          id: 'VST-201',
          staffId: 'STF-01',
          staffName: 'Ramesh Kumar',
          storeName: 'Sharma Telecom & Gadgets',
          ownerName: 'Sunil Sharma',
          phone: '9873112233',
          address: 'Atta Market, Sector 18, Noida',
          latitude: 28.5703,
          longitude: 77.3218,
          photoUrl: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=400',
          visitTime: '10:15 AM',
          isVerified: true,
          notes: 'Delivered 3 Vivo Y200 units. Took cash payment ₹10,000.',
          collectionAmount: 10000
        }
      ],
      parties: [
        {
          id: 'CUST-01',
          name: 'Sunil Sharma',
          shopName: 'Sharma Telecom & Gadgets',
          phone: '9873112233',
          email: 'sharmatelecom.noida@gmail.com',
          address: 'Shop 14, Ground Floor, Atta Market, Sector 18, Noida',
          gstNumber: '07AAAAA0000A1Z5',
          biodata: 'A+ Category Retailer. Sells 40+ smartphones every week. Always pays by cheque/UPI.',
          creditLimit: 150000,
          currentBalance: 42500,
          duePaymentDate: '2026-10-18',
          photoUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=200'
        },
        {
          id: 'CUST-02',
          name: 'Mohammad Farhan',
          shopName: 'Noida Mobile Gallery',
          phone: '9311445566',
          email: 'farhan.mobiles@outlook.com',
          address: 'Booth 8, Brahmaputra Shopping Complex, Sector 29, Noida',
          gstNumber: '07BBBBB1111B2Z6',
          biodata: 'Specializes in refurbished iPhones and Vivo/Oppo. Regular client.',
          creditLimit: 100000,
          currentBalance: 28000,
          duePaymentDate: '2026-10-16',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
        }
      ],
      invoices: [],
      payments: [
        {
          id: 'PAY-01',
          customerId: 'CUST-01',
          customerName: 'Sunil Sharma',
          shopName: 'Sharma Telecom & Gadgets',
          amount: 10000,
          paymentMode: 'CASH',
          date: `${today} 10:25:00`,
          collectedBy: 'Ramesh Kumar',
          notes: 'Cash payment on visit'
        }
      ]
    };
  }

  // Getters
  getStaff() { return this.data.staff; }
  getAttendance(date?: string) {
    if (date) return this.data.attendance.filter(a => a.date === date);
    return this.data.attendance;
  }
  getTracking() { return this.data.tracking; }
  getVisits() { return this.data.visits; }
  getParties() { return this.data.parties; }
  getInvoices() { return this.data.invoices; }
  getPayments() { return this.data.payments; }

  // Mutations
  addAttendance(rec: AttendanceRecord) {
    this.data.attendance.unshift(rec);
    this.saveData(this.data);
    return rec;
  }

  updatePunchOut(id: string, outTime: string, location: string) {
    const rec = this.data.attendance.find(a => a.id === id);
    if (rec) {
      rec.punchOutTime = outTime;
      rec.punchOutLocation = location;
      this.saveData(this.data);
      return rec;
    }
    return null;
  }

  addTracking(pt: TrackingPoint) {
    this.data.tracking.push(pt);
    this.saveData(this.data);
    return pt;
  }

  addVisit(visit: StoreVisit) {
    this.data.visits.unshift(visit);
    this.saveData(this.data);
    return visit;
  }

  updateVisitVerified(id: string, isVerified: boolean) {
    const v = this.data.visits.find(item => item.id === id);
    if (v) {
      v.isVerified = isVerified;
      this.saveData(this.data);
      return v;
    }
    return null;
  }

  addParty(party: CustomerParty) {
    this.data.parties.push(party);
    this.saveData(this.data);
    return party;
  }

  updatePartyBalance(id: string, delta: number) {
    const p = this.data.parties.find(item => item.id === id);
    if (p) {
      p.currentBalance = Math.max(0, p.currentBalance + delta);
      this.saveData(this.data);
    }
  }

  addInvoice(inv: Invoice) {
    this.data.invoices.unshift(inv);
    if (inv.balanceAmount > 0) {
      this.updatePartyBalance(inv.customerId, inv.balanceAmount);
    }
    this.saveData(this.data);
    return inv;
  }

  addPayment(pay: PaymentRecord) {
    this.data.payments.unshift(pay);
    this.updatePartyBalance(pay.customerId, -pay.amount);
    this.saveData(this.data);
    return pay;
  }
}

export const store = new DataStore();
