import { localDb } from '../db/indexedDB';
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

export type DataSourceMode = 'indexeddb' | 'backend_api';

class ApiService {
  private mode: DataSourceMode = 'indexeddb';
  private backendBaseUrl = 'http://localhost:5000/api';

  constructor() {
    const savedMode = localStorage.getItem('SAM_ERP_DATA_MODE') as DataSourceMode;
    if (savedMode) {
      this.mode = savedMode;
    }
  }

  getMode(): DataSourceMode {
    return this.mode;
  }

  setMode(newMode: DataSourceMode) {
    this.mode = newMode;
    localStorage.setItem('SAM_ERP_DATA_MODE', newMode);
  }

  async getStaff(): Promise<Staff[]> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/staff`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, falling back to local IndexedDB', err);
      }
    }
    return localDb.getStaff();
  }

  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    if (this.mode === 'backend_api') {
      try {
        const url = date ? `${this.backendBaseUrl}/attendance?date=${date}` : `${this.backendBaseUrl}/attendance`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, falling back to local IndexedDB', err);
      }
    }
    return localDb.getAttendance(date);
  }

  async recordPunchIn(record: AttendanceRecord): Promise<AttendanceRecord> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/attendance/punch-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend punch in failed, saving locally', err);
      }
    }
    return localDb.recordPunchIn(record);
  }

  async recordPunchOut(id: string, outTime: string, location: string): Promise<AttendanceRecord | null> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/attendance/punch-out/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ punchOutTime: outTime, punchOutLocation: location })
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend punch out failed, saving locally', err);
      }
    }
    return localDb.recordPunchOut(id, outTime, location);
  }

  async getTrackingPoints(): Promise<TrackingPoint[]> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/tracking`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, using local data', err);
      }
    }
    return localDb.getTrackingPoints();
  }

  async addTrackingPoint(pt: TrackingPoint): Promise<TrackingPoint> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/tracking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pt)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend tracking failed', err);
      }
    }
    return localDb.addTrackingPoint(pt);
  }

  async getStoreVisits(): Promise<StoreVisit[]> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/visits`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, using local data', err);
      }
    }
    return localDb.getStoreVisits();
  }

  async addStoreVisit(visit: StoreVisit): Promise<StoreVisit> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visit)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend visit failed, saving locally', err);
      }
    }
    return localDb.addStoreVisit(visit);
  }

  async toggleVisitVerified(id: string, isVerified: boolean): Promise<StoreVisit | null> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/visits/${id}/verify`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isVerified })
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend toggle failed', err);
      }
    }
    return localDb.toggleVisitVerified(id, isVerified);
  }

  async getParties(): Promise<CustomerParty[]> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/parties`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, using local data', err);
      }
    }
    return localDb.getParties();
  }

  async addParty(party: CustomerParty): Promise<CustomerParty> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/parties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(party)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend add party failed', err);
      }
    }
    return localDb.addParty(party);
  }

  async getInvoices(): Promise<Invoice[]> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/invoices`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, using local data', err);
      }
    }
    return localDb.getInvoices();
  }

  async createInvoice(invoice: Invoice): Promise<Invoice> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoice)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend invoice failed', err);
      }
    }
    return localDb.createInvoice(invoice);
  }

  async getPayments(): Promise<PaymentRecord[]> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/payments`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend unavailable, using local data', err);
      }
    }
    return localDb.getPayments();
  }

  async addPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    if (this.mode === 'backend_api') {
      try {
        const res = await fetch(`${this.backendBaseUrl}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payment)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend payment failed', err);
      }
    }
    return localDb.addPayment(payment);
  }

  async getMetrics(): Promise<DashboardMetrics> {
    return localDb.getMetrics();
  }

  async exportJson(): Promise<string> {
    return localDb.exportAllData();
  }

  async importJson(json: string): Promise<boolean> {
    return localDb.importAllData(json);
  }
}

export const api = new ApiService();
