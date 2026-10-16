import L from 'leaflet';
import { api } from './services/apiService';
import {
  Staff,
  AttendanceRecord,
  StoreVisit,
  CustomerParty,
  Invoice,
  PaymentRecord,
  TrackingPoint,
  DashboardMetrics
} from './types';

// State
let currentView = 'dashboard';
let currentDateFilter = 'Today 11 Oct 2026';
let cachedStaff: Staff[] = [];
let cachedParties: CustomerParty[] = [];
let activeMap: L.Map | null = null;
let activePolyline: L.Polyline | null = null;

// DOM references
const viewContent = document.getElementById('view-content') as HTMLElement;
const modalContainer = document.getElementById('modal-container') as HTMLElement;
const modalTitle = document.getElementById('modal-title') as HTMLElement;
const modalBody = document.getElementById('modal-body') as HTMLElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLElement;
const toastContainer = document.getElementById('toast-container') as HTMLElement;
const globalSearchInput = document.getElementById('global-search') as HTMLInputElement;
const searchResultsDropdown = document.getElementById('search-results-dropdown') as HTMLElement;
const notificationsBellBtn = document.getElementById('notifications-bell-btn') as HTMLElement;
const notificationsPopover = document.getElementById('notifications-popover') as HTMLElement;

// Toast notification
function showToast(message: string, icon = '✅') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Modal management
function openModal(title: string, htmlContent: string) {
  modalTitle.textContent = title;
  modalBody.innerHTML = htmlContent;
  modalContainer.classList.remove('hidden');
}

function closeModal() {
  modalContainer.classList.add('hidden');
  modalBody.innerHTML = '';
}

modalCloseBtn.addEventListener('click', closeModal);
modalContainer.addEventListener('click', (e) => {
  if (e.target === modalContainer) closeModal();
});

function formatCurrency(num: number): string {
  return '₹ ' + Number(num || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Global View Switcher
function switchView(viewName: string) {
  currentView = viewName;
  if (activeMap) {
    activeMap.remove();
    activeMap = null;
  }
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName);
  });
  renderActiveView();
}

async function renderActiveView() {
  viewContent.innerHTML = `<div style="text-align:center; padding: 60px 0;"><p style="color: #64748b;">Loading operations data...</p></div>`;

  cachedStaff = await api.getStaff();
  cachedParties = await api.getParties();

  switch (currentView) {
    case 'dashboard':
      await renderDashboard();
      break;
    case 'attendance':
      await renderAttendance();
      break;
    case 'tracking':
      await renderTracking();
      break;
    case 'visits':
      await renderStoreVisits();
      break;
    case 'parties':
      await renderParties();
      break;
    case 'invoices':
      await renderInvoices();
      break;
    case 'collections':
      await renderCollections();
      break;
    case 'reports':
      await renderReports();
      break;
    case 'mobile_screens':
      renderMobileScreens();
      break;
    case 'backup':
      await renderBackup();
      break;
    default:
      await renderDashboard();
  }
}

// 1. DASHBOARD VIEW (With Exact Top Section & 8 Preview Tiles from Screenshot)
async function renderDashboard() {
  const metrics = await api.getMetrics();
  const attendance = await api.getAttendance();
  const parties = await api.getParties();
  const tracking = await api.getTrackingPoints();

  viewContent.innerHTML = `
    <!-- Dashboard Header -->
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Dashboard</h1>
        <p class="dash-subtitle">Complete overview of your field operations and collections</p>
      </div>
      <div class="date-pill-btn" id="date-pill-toggle">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span id="active-date-label">${currentDateFilter}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        
        <!-- Date Selector Dropdown -->
        <div class="date-dropdown-menu hidden" id="date-dropdown-menu">
          <div class="date-dropdown-item" data-date="Today 11 Oct 2026">Today 11 Oct 2026</div>
          <div class="date-dropdown-item" data-date="Yesterday 10 Oct 2026">Yesterday 10 Oct 2026</div>
          <div class="date-dropdown-item" data-date="This Week">This Week</div>
          <div class="date-dropdown-item" data-date="October 2026">This Month (Oct 2026)</div>
        </div>
      </div>
    </div>

    <!-- 5 KPI Cards (Exact match to screenshot) -->
    <div class="kpi-row-5">
      <!-- 1. Total Employees -->
      <div class="kpi-card-white" onclick="window.switchView('attendance')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #eff6ff; color: #2563eb;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="kpi-growth-pill positive">↑ 12%</span>
        </div>
        <div class="kpi-num">24</div>
        <div class="kpi-label">Total Employees</div>
        <div class="kpi-footer-sub">
          <strong style="color: #059669;">20 Present</strong> • <span style="color: #dc2626;">4 Absent</span>
        </div>
      </div>

      <!-- 2. Store Visits -->
      <div class="kpi-card-white" onclick="window.switchView('visits')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #ecfdf5; color: #10b981;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <span class="kpi-growth-pill positive">↑ 18%</span>
        </div>
        <div class="kpi-num">86</div>
        <div class="kpi-label">Store Visits</div>
        <div class="kpi-footer-sub">
          Today: <strong>28</strong> • Yesterday: <strong>24</strong>
        </div>
      </div>

      <!-- 3. Total Collection -->
      <div class="kpi-card-white" onclick="window.switchView('collections')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #fffbeb; color: #d97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <span class="kpi-growth-pill positive">↑ 22%</span>
        </div>
        <div class="kpi-num">${formatCurrency(metrics.todayTotalCollection)}</div>
        <div class="kpi-label">Total Collection</div>
        <div class="kpi-footer-sub">
          UPI: <strong>₹ 3,18,000</strong> • Cash: <strong>₹ 2,24,800</strong>
        </div>
      </div>

      <!-- 4. Pending Payments -->
      <div class="kpi-card-white" onclick="window.switchView('parties')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #fef2f2; color: #ef4444;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          </div>
          <span class="kpi-growth-pill negative">↑ 6%</span>
        </div>
        <div class="kpi-num" style="color: #ef4444;">${formatCurrency(metrics.totalMarketOutstanding)}</div>
        <div class="kpi-label">Pending Payments</div>
        <div class="kpi-footer-sub">
          <span style="color: #ef4444; font-weight: 600;">42 Parties Overdue</span>
        </div>
      </div>

      <!-- 5. Total Invoices -->
      <div class="kpi-card-white" onclick="window.switchView('invoices')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #eff6ff; color: #2563eb;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <span class="kpi-growth-pill positive">↑ 14%</span>
        </div>
        <div class="kpi-num">156</div>
        <div class="kpi-label">Total Invoices</div>
        <div class="kpi-footer-sub">This Month</div>
      </div>
    </div>

    <!-- Middle Row: Attendance Table & Live Tracking Map -->
    <div class="dash-mid-grid">
      <!-- Attendance Card -->
      <div class="card-white">
        <div class="card-header-flex">
          <span class="card-title-text">Employee Attendance (Today)</span>
          <a class="card-view-all" onclick="window.switchView('attendance')">View All →</a>
        </div>

        <table class="clean-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Check-in</th>
              <th>Location</th>
              <th>Status</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.slice(0, 5).map((att, idx) => {
              const visitsCount = [5, 4, 0, 6, 3][idx] || 2;
              return `
                <tr>
                  <td>
                    <div class="emp-cell">
                      <img src="${att.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="emp-avatar" alt="${att.staffName}">
                      <span style="font-weight: 600; font-size: 0.82rem;">${att.staffName}</span>
                    </div>
                  </td>
                  <td>${att.punchInTime}</td>
                  <td><span style="color: #64748b;">${att.punchInLocation}</span></td>
                  <td>
                    <span class="status-pill ${att.status === 'present' ? 'status-present' : 'status-absent'}">
                      ${att.status === 'present' ? 'Present' : 'Absent'}
                    </span>
                  </td>
                  <td style="font-weight: 600;">${visitsCount}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Live Tracking Map Card (With Real Leaflet OpenStreetMap) -->
      <div class="card-white" style="position: relative;">
        <div class="card-header-flex">
          <span class="card-title-text">Live Employee Tracking</span>
          <a class="card-view-all" onclick="window.switchView('tracking')">View Full Map →</a>
        </div>

        <div id="live-tracking-map"></div>

        <div class="map-card-popup" id="active-map-card">
          <div class="map-popup-header">
            <span class="map-popup-name">Rohit Kumar</span>
            <span class="status-pill status-present" style="font-size: 0.65rem;">On Duty</span>
          </div>
          <div class="map-popup-sub">
            MP Nagar, Bhopal<br>Last updated: 10:24 AM
          </div>
          <a class="map-popup-link" onclick="window.focusOnEmployee('Rohit Kumar', 23.2332, 77.4343)">View Details →</a>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Recent Activities & Pending Payments -->
    <div class="dash-bottom-grid">
      <!-- Recent Activities -->
      <div class="card-white">
        <div class="card-header-flex">
          <span class="card-title-text">Recent Activities</span>
          <a class="card-view-all">View All →</a>
        </div>

        <div class="activity-feed-list">
          <div class="activity-item">
            <div class="activity-icon" style="background: #eff6ff; color: #2563eb;">📍</div>
            <div class="activity-body">
              <div class="activity-title">Rohit Kumar submitted store visit at MP Nagar</div>
              <div class="activity-time">12 mins ago</div>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-icon" style="background: #ecfdf5; color: #10b981;">💰</div>
            <div class="activity-body">
              <div class="activity-title">Payment received from Sharma Traders ₹ 25,000 (UPI)</div>
              <div class="activity-time">45 mins ago</div>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-icon" style="background: #eff6ff; color: #6366f1;">🧾</div>
            <div class="activity-body">
              <div class="activity-title">Invoice #INV-2026-0156 created for Sharma Traders</div>
              <div class="activity-time">1 hour ago</div>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-icon" style="background: #fef2f2; color: #ef4444;">⏰</div>
            <div class="activity-body">
              <div class="activity-title">Payment overdue alert - Jain Electronics ₹ 1,20,000</div>
              <div class="activity-time">2 hours ago</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Payments List -->
      <div class="card-white">
        <div class="card-header-flex">
          <span class="card-title-text">Pending Payments</span>
          <a class="card-view-all" onclick="window.switchView('parties')">View All →</a>
        </div>

        <div class="pending-pay-list">
          ${parties.slice(0, 5).map(p => `
            <div class="pending-pay-item">
              <div>
                <div class="pending-store-name">${p.shopName}</div>
                <div class="pending-amount">${formatCurrency(p.currentBalance)}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="status-pill ${p.duePaymentDate?.includes('overdue') ? 'status-overdue' : 'status-due-soon'}">
                  ${p.duePaymentDate || 'Due Soon'}
                </span>
                <button class="btn btn-whatsapp" style="padding: 4px 8px; font-size: 0.7rem;" onclick="window.sendWhatsAppReminder('${p.phone}', '${p.name}', '${p.shopName}', ${p.currentBalance}, '${p.duePaymentDate || 'Due date'}')">
                  📲 Remind
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 8 Modules Visual Navigation Grid (Matching the Full Screenshot Structure) -->
    <div class="modules-preview-section">
      <div class="modules-preview-header">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">All Operations & Mobile Modules</h3>
          <p style="font-size: 0.8rem; color: #64748b;">Direct access to all 8 web dashboards and field employee mobile screens</p>
        </div>
      </div>

      <div class="modules-grid-8">
        <!-- 1. Attendance Management -->
        <div class="module-preview-card" onclick="window.switchView('attendance')">
          <div>
            <span class="module-badge">1. Web View</span>
            <div class="module-title">Attendance Management</div>
            <div class="module-desc">Track staff check-in/out, hours worked, late marks, and presence register.</div>
          </div>
          <div class="module-action-link">Open Attendance →</div>
        </div>

        <!-- 2. Employee Tracking -->
        <div class="module-preview-card" onclick="window.switchView('tracking')">
          <div>
            <span class="module-badge">2. Web View</span>
            <div class="module-title">Employee Tracking</div>
            <div class="module-desc">Interactive real-time OpenStreetMap with route paths, battery, and location history.</div>
          </div>
          <div class="module-action-link">Open Live Map →</div>
        </div>

        <!-- 3. Store Visit Submission -->
        <div class="module-preview-card" onclick="window.switchView('visits')">
          <div>
            <span class="module-badge">3. Mobile / Web</span>
            <div class="module-title">Store Visit Submission</div>
            <div class="module-desc">Auto-captured GPS, camera photo uploads, discussion notes, and verified visits check.</div>
          </div>
          <div class="module-action-link">Open Store Check-in →</div>
        </div>

        <!-- 4. Party / Customer Management -->
        <div class="module-preview-card" onclick="window.switchView('parties')">
          <div>
            <span class="module-badge">4. Web View</span>
            <div class="module-title">Party / Customer CRM</div>
            <div class="module-desc">Customer biodata, credit limits, overdue ledger, and 1-Click WhatsApp payment reminders.</div>
          </div>
          <div class="module-action-link">Open Customer CRM →</div>
        </div>

        <!-- 5. Invoice Creation -->
        <div class="module-preview-card" onclick="window.switchView('invoices')">
          <div>
            <span class="module-badge">5. Web View</span>
            <div class="module-title">Invoice Creation</div>
            <div class="module-desc">Handset billing with IMEI number tracking, product line items, and auto 18% GST.</div>
          </div>
          <div class="module-action-link">Create Invoice →</div>
        </div>

        <!-- 6. Invoice Preview -->
        <div class="module-preview-card" onclick="window.previewInvoice('INV-2026-0156')">
          <div>
            <span class="module-badge">6. Web View</span>
            <div class="module-title">Invoice Preview (Print/PDF)</div>
            <div class="module-desc">GST-compliant tax bill receipt ready for print, PDF download, or WhatsApp sharing.</div>
          </div>
          <div class="module-action-link">Preview Sample Bill →</div>
        </div>

        <!-- 7. Collection & Payment Tracking -->
        <div class="module-preview-card" onclick="window.switchView('collections')">
          <div>
            <span class="module-badge">7. Web View</span>
            <div class="module-title">Collection & Tracking</div>
            <div class="module-desc">Daily ledger tracking UPI vs Cash in hand, UTR transaction references, and reconciliation.</div>
          </div>
          <div class="module-action-link">Open Collections →</div>
        </div>

        <!-- 8. Mobile App Screens -->
        <div class="module-preview-card" onclick="window.switchView('mobile_screens')" style="background: linear-gradient(135deg, #ffffff, #eff6ff); border-color: #93c5fd;">
          <div>
            <span class="module-badge" style="background: #2563eb; color: white;">8. Mobile Simulator</span>
            <div class="module-title">Mobile App Screens</div>
            <div class="module-desc">Interactive handheld phone simulator running the 5 employee on-ground screens.</div>
          </div>
          <div class="module-action-link" style="font-weight: 700;">Launch Phone App →</div>
        </div>
      </div>
    </div>
  `;

  // Date dropdown interaction
  const dateToggle = document.getElementById('date-pill-toggle');
  const dateMenu = document.getElementById('date-dropdown-menu');
  dateToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    dateMenu?.classList.toggle('hidden');
  });

  document.querySelectorAll('.date-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = (item as HTMLElement).getAttribute('data-date') || 'Today 11 Oct 2026';
      currentDateFilter = val;
      const label = document.getElementById('active-date-label');
      if (label) label.textContent = val;
      dateMenu?.classList.add('hidden');
      showToast(`Filtered data for ${val}`, '📅');
    });
  });

  document.addEventListener('click', () => {
    dateMenu?.classList.add('hidden');
  });

  // Initialize Leaflet Map
  setTimeout(() => {
    initLeafletMap('live-tracking-map', tracking);
  }, 100);
}

// Interactive Leaflet OpenStreetMap helper with Polyline routes
function initLeafletMap(containerId: string, trackingPoints: TrackingPoint[]) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const centerLat = 23.2332;
  const centerLng = 77.4343;

  activeMap = L.map(containerId, {
    zoomControl: true,
    attributionControl: false
  }).setView([centerLat, centerLng], 13);

  // OpenStreetMap standard clean tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(activeMap);

  // Add custom avatar markers with tooltips
  trackingPoints.forEach(t => {
    const customIcon = L.divIcon({
      className: 'custom-map-avatar-marker',
      html: `
        <div style="width: 34px; height: 34px; border-radius: 50%; border: 3px solid #2563eb; background: #ffffff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer;">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker([t.latitude, t.longitude], { icon: customIcon }).addTo(activeMap!);
    marker.on('click', () => {
      (window as any).focusOnEmployee(t.staffName, t.latitude, t.longitude);
    });
  });

  // Draw simulated route polyline
  const routeCoords: [number, number][] = [
    [23.2150, 77.4300], // Arera Colony
    [23.2200, 77.4000], // TT Nagar
    [23.2332, 77.4343], // MP Nagar
    [23.2680, 77.4650]  // Ayodhya Bypass
  ];
  activePolyline = L.polyline(routeCoords, { color: '#2563eb', weight: 4, dashArray: '6, 8', opacity: 0.8 }).addTo(activeMap);
}

// 2. ATTENDANCE MANAGEMENT (Web view matching bottom screen 1)
async function renderAttendance() {
  const records = await api.getAttendance();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Attendance</h1>
        <p class="dash-subtitle">Track employee attendance and working hours</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary">Oct 2026 📅</button>
        <button class="btn btn-primary" id="btn-quick-punch">⏱️ Punch In/Out</button>
      </div>
    </div>

    <!-- Filter & Summary Pills (Matching screenshot) -->
    <div class="card-white" style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm filter-att-btn active" data-filter="all">Today</button>
          <button class="btn btn-secondary btn-sm filter-att-btn" data-filter="week">This Week</button>
          <button class="btn btn-secondary btn-sm filter-att-btn" data-filter="month">This Month</button>
          <button class="btn btn-secondary btn-sm filter-att-btn" data-filter="custom">Custom</button>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.exportAttendanceCSV()">📥 Export</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
          <span style="font-size: 0.75rem; color: #64748b;">🟢 Present</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #059669;">20</div>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
          <span style="font-size: 0.75rem; color: #64748b;">🔴 Absent</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #dc2626;">4</div>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
          <span style="font-size: 0.75rem; color: #64748b;">🟡 Late</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #d97706;">3</div>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
          <span style="font-size: 0.75rem; color: #64748b;">🔵 Half Day</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #2563eb;">2</div>
        </div>
      </div>
    </div>

    <!-- Attendance Table -->
    <div class="card-white">
      <table class="clean-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Total Hours</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>
                <div class="emp-cell">
                  <img src="${r.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="emp-avatar">
                  <strong>${r.staffName}</strong>
                </div>
              </td>
              <td>${r.punchInTime}</td>
              <td>${r.punchOutTime || '--'}</td>
              <td>${r.punchOutTime ? '8h 4m' : '--'}</td>
              <td>
                <span class="status-pill ${r.status === 'present' ? 'status-present' : 'status-absent'}">
                  ${r.status === 'present' ? 'Present' : 'Absent'}
                </span>
              </td>
              <td><a class="card-view-all" onclick="window.viewEmployeeAttendanceDetail('${r.staffName}', '${r.punchInTime}', '${r.punchInLocation}')">View</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-quick-punch')?.addEventListener('click', openQuickPunchModal);
}

// 3. EMPLOYEE TRACKING (Web view matching bottom screen 2)
async function renderTracking() {
  const tracking = await api.getTrackingPoints();
  const staff = cachedStaff;

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Employee Tracking</h1>
        <p class="dash-subtitle">Live GPS location of all on-duty field sales agents</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm active" id="btn-map-view-toggle">Map</button>
        <button class="btn btn-secondary btn-sm" onclick="showToast('Satellite view loaded successfully!')">Satellite</button>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2.2fr 1fr; gap: 18px;">
      <div class="card-white" style="padding: 0; overflow: hidden; height: 550px;">
        <div id="full-tracking-map" style="width: 100%; height: 100%;"></div>
      </div>

      <div class="card-white" style="height: 550px; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 0.95rem;">All Employees (${staff.length})</h4>
          <span style="font-size: 0.72rem; color: #2563eb; font-weight: 600;">All Status ▼</span>
        </div>

        <input type="text" id="tracking-search" class="form-input" placeholder="Search employee..." style="margin-bottom: 12px;">

        <div style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px;" id="tracking-emp-list">
          ${staff.map(s => `
            <div style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.focusOnEmployee('${s.name}', 23.2332, 77.4343)">
              <div style="display: flex; gap: 10px; align-items: center;">
                <img src="${s.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                <div>
                  <div style="font-size: 0.82rem; font-weight: 600;">${s.name}</div>
                  <div style="font-size: 0.72rem; color: #64748b;">MP Nagar, Bhopal</div>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="status-pill status-present" style="font-size: 0.65rem;">On Duty</span>
                <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">10:24 AM</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    initLeafletMap('full-tracking-map', tracking);
  }, 100);

  // Filter staff list
  document.getElementById('tracking-search')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('#tracking-emp-list > div').forEach(item => {
      const text = item.textContent?.toLowerCase() || '';
      (item as HTMLElement).style.display = text.includes(q) ? 'flex' : 'none';
    });
  });
}

// 4. STORE VISITS (Matching bottom screen 3)
async function renderStoreVisits() {
  const visits = await api.getStoreVisits();
  const parties = cachedParties;

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Store Visits</h1>
        <p class="dash-subtitle">Submission of store and location with photos and verification check</p>
      </div>
      <button class="btn btn-primary" id="btn-submit-visit-modal">📸 New Store Visit</button>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1.6fr; gap: 20px;">
      <!-- Store Visit Form (Matches mobile screen 3 in screenshot) -->
      <div class="card-white">
        <h3 style="font-size: 1.1rem; margin-bottom: 14px;">🏪 New Store Visit</h3>
        
        <form id="store-visit-form">
          <div class="form-group">
            <label class="form-label">Select Store *</label>
            <select id="v-store-select" class="form-select" required>
              <option value="Kumar Mobile Point">Kumar Mobile Point</option>
              ${parties.map(p => `<option value="${p.shopName}">${p.shopName}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Location (Auto-captured)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="v-location" class="form-input" value="MP Nagar, Bhopal (Auto-captured)">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-change-gps">Change</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Photos (Required) *</label>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;" id="photos-thumbnail-row">
              <img src="https://images.unsplash.com/photo-1555421689-d68471e189f2?w=150" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-light);">
              <img src="https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=150" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-light);">
              <div id="add-photo-trigger" style="width: 60px; height: 60px; border-radius: 8px; border: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.5rem; cursor: pointer;">+</div>
            </div>
            <input type="file" id="real-photo-input" accept="image/*" style="display: none;">
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea id="v-notes" class="form-textarea" rows="3" placeholder="Stock checked, good response"></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 0.95rem;">
            Submit Visit
          </button>
        </form>
      </div>

      <!-- Visits List -->
      <div class="card-white">
        <h3 style="font-size: 1.05rem; margin-bottom: 14px;">Recent Store Submissions</h3>
        <table class="clean-table">
          <thead>
            <tr>
              <th>Verified [✓]</th>
              <th>Store</th>
              <th>Location</th>
              <th>Time</th>
              <th>Photo</th>
            </tr>
          </thead>
          <tbody>
            ${visits.map(v => `
              <tr>
                <td>
                  <input type="checkbox" checked style="width: 18px; height: 18px; accent-color: #2563eb;" onchange="showToast('Visit verified checkbox updated [✓]')">
                </td>
                <td>
                  <strong>${v.storeName}</strong>
                  <div style="font-size: 0.72rem; color: #64748b;">${v.staffName}</div>
                </td>
                <td>${v.address}</td>
                <td>${v.visitTime}</td>
                <td>
                  <img src="${v.photoUrl}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; cursor: pointer;" onclick="window.previewPhoto('${v.photoUrl}', '${v.storeName}')">
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Real photo upload
  const addTrigger = document.getElementById('add-photo-trigger');
  const fileInput = document.getElementById('real-photo-input') as HTMLInputElement;
  addTrigger?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const row = document.getElementById('photos-thumbnail-row');
        const img = document.createElement('img');
        img.src = reader.result as string;
        img.style.cssText = 'width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-light);';
        row?.insertBefore(img, addTrigger);
        showToast('Photo attached from camera!', '📸');
      };
      reader.readAsDataURL(file);
    }
  });

  // GPS Change
  document.getElementById('btn-change-gps')?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          (document.getElementById('v-location') as HTMLInputElement).value = `GPS Auto-captured (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
          showToast('Live GPS coordinates captured!', '📍');
        },
        () => {
          (document.getElementById('v-location') as HTMLInputElement).value = 'MP Nagar, Zone 1, Bhopal (23.2332, 77.4343)';
          showToast('Location updated to Bhopal Market', '📍');
        }
      );
    }
  });

  const form = document.getElementById('store-visit-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newV: StoreVisit = {
      id: 'VST-' + Date.now(),
      staffId: 'STF-01',
      staffName: 'Rohit Kumar',
      storeName: (document.getElementById('v-store-select') as HTMLSelectElement).value || 'Kumar Mobile Point',
      ownerName: 'Sunil Kumar',
      phone: '0987654321',
      address: (document.getElementById('v-location') as HTMLInputElement).value,
      latitude: 23.2332,
      longitude: 77.4343,
      photoUrl: 'https://images.unsplash.com/photo-1555421689-d68471e189f2?w=400',
      visitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: true,
      notes: (document.getElementById('v-notes') as HTMLTextAreaElement).value
    };
    await api.addStoreVisit(newV);
    showToast('Store visit submitted and verified with checkbox [✓]!', '🎉');
    renderStoreVisits();
  });
}

// 5. PARTIES / CUSTOMERS (Matching bottom screen 4)
async function renderParties() {
  const parties = await api.getParties();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Parties / Customers</h1>
        <p class="dash-subtitle">Retailer master directory, customer biodata and payment reminders</p>
      </div>
      <button class="btn btn-primary" id="btn-add-party-top">+ Add Party</button>
    </div>

    <div class="card-white" style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm party-filter-btn active" data-tab="all">All</button>
          <button class="btn btn-secondary btn-sm party-filter-btn" data-tab="active">Active</button>
          <button class="btn btn-secondary btn-sm party-filter-btn" data-tab="overdue">Overdue</button>
        </div>
        <input type="text" id="party-search-input" class="form-input" placeholder="Search party by name, phone..." style="width: 250px;">
      </div>

      <table class="clean-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Mobile</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th>Biodata</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="parties-table-body">
          ${parties.map(p => `
            <tr class="party-tr" data-status="${p.duePaymentDate?.includes('overdue') ? 'overdue' : 'active'}">
              <td>
                <strong>${p.shopName}</strong>
                <div style="font-size: 0.72rem; color: #64748b;">${p.name}</div>
              </td>
              <td style="font-family: var(--font-mono);">${p.phone}</td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: ${p.currentBalance > 0 ? '#ef4444' : '#059669'};">
                ${formatCurrency(p.currentBalance)}
              </td>
              <td>
                <span class="status-pill ${p.duePaymentDate?.includes('overdue') ? 'status-overdue' : (p.duePaymentDate === 'Paid' ? 'status-paid' : 'status-due-soon')}">
                  ${p.duePaymentDate || 'Active'}
                </span>
              </td>
              <td style="max-width: 240px; font-size: 0.75rem; color: #64748b; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${p.biodata}
              </td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-secondary btn-sm" onclick="window.viewPartyDetails('${p.id}')">View</button>
                  <button class="btn btn-whatsapp btn-sm" onclick="window.sendWhatsAppReminder('${p.phone}', '${p.name}', '${p.shopName}', ${p.currentBalance}, '${p.duePaymentDate}')">📲</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-add-party-top')?.addEventListener('click', openAddPartyModal);

  // Filter tabs
  document.querySelectorAll('.party-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.party-filter-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      document.querySelectorAll('.party-filter-btn').forEach(b => b.classList.add('btn-secondary'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active', 'btn-primary');
      target.classList.remove('btn-secondary');
      const tab = target.getAttribute('data-tab');

      document.querySelectorAll('.party-tr').forEach(tr => {
        const s = tr.getAttribute('data-status');
        if (tab === 'all') (tr as HTMLElement).style.display = '';
        else if (tab === 'overdue' && s === 'overdue') (tr as HTMLElement).style.display = '';
        else if (tab === 'active' && s !== 'overdue') (tr as HTMLElement).style.display = '';
        else (tr as HTMLElement).style.display = 'none';
      });
    });
  });

  // Search
  document.getElementById('party-search-input')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('.party-tr').forEach(tr => {
      const text = tr.textContent?.toLowerCase() || '';
      (tr as HTMLElement).style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// 6. INVOICES & BILLING (Matching bottom screens 5 & 6)
async function renderInvoices() {
  const parties = cachedParties;

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Invoice Creation</h1>
        <p class="dash-subtitle">Generate bills, product items, and print GST tax invoices</p>
      </div>
      <button class="btn btn-secondary" onclick="window.previewInvoice('INV-2026-0156')">👁️ Preview Sample Invoice</button>
    </div>

    <!-- Screen 5: Invoice Creation Form -->
    <div class="card-white" style="margin-bottom: 24px;">
      <h3 style="font-size: 1.05rem; margin-bottom: 14px;">Invoices ➔ Create Invoice</h3>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer *</label>
          <select id="inv-cust-select" class="form-select">
            ${parties.map(p => `<option value="${p.id}" data-name="${p.shopName}">${p.shopName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Date *</label>
          <input type="text" class="form-input" value="11 Oct 2026" id="inv-date-input">
        </div>
      </div>

      <!-- Items Table matching screenshot screen 5 -->
      <table class="clean-table" style="margin: 16px 0;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>Product</th>
            <th style="width: 100px;">Qty</th>
            <th style="width: 120px;">Rate (₹)</th>
            <th style="width: 120px; text-align: right;">Amount</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody id="invoice-items-tbody">
          <tr class="inv-row">
            <td><input type="text" class="form-input item-desc" value="Mobile Cover"></td>
            <td><input type="number" class="form-input item-qty" value="10" min="1"></td>
            <td><input type="number" class="form-input item-rate" value="150" min="1"></td>
            <td style="text-align: right; font-weight: 700;" class="item-amt">₹ 1,500</td>
            <td><button class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); window.recalcInvoice();">✕</button></td>
          </tr>
          <tr class="inv-row">
            <td><input type="text" class="form-input item-desc" value="Screen Guard"></td>
            <td><input type="number" class="form-input item-qty" value="20" min="1"></td>
            <td><input type="number" class="form-input item-rate" value="50" min="1"></td>
            <td style="text-align: right; font-weight: 700;" class="item-amt">₹ 1,000</td>
            <td><button class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); window.recalcInvoice();">✕</button></td>
          </tr>
        </tbody>
      </table>

      <button class="btn btn-secondary btn-sm" id="btn-add-item-row" style="margin-bottom: 16px;">+ Add Item</button>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end;">
        <div style="width: 240px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Subtotal</span>
            <strong id="inv-subtotal-val">₹ 2,500</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
            <span>GST (18%)</span>
            <span id="inv-gst-val">₹ 450</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 1px solid var(--border-light); padding-top: 8px;">
            <span>Total</span>
            <span style="color: #2563eb;" id="inv-total-val">₹ 2,950</span>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" onclick="window.previewInvoice('INV-2026-0156')">👁️ Preview</button>
        <button class="btn btn-primary" onclick="showToast('Invoice saved & customer balance updated!', '🧾')">💾 Save</button>
      </div>
    </div>
  `;

  // Item additions & calculations
  const tbody = document.getElementById('invoice-items-tbody');
  document.getElementById('btn-add-item-row')?.addEventListener('click', () => {
    const tr = document.createElement('tr');
    tr.className = 'inv-row';
    tr.innerHTML = `
      <td><input type="text" class="form-input item-desc" placeholder="Product name" value="Type-C Cable"></td>
      <td><input type="number" class="form-input item-qty" value="5" min="1"></td>
      <td><input type="number" class="form-input item-rate" value="100" min="1"></td>
      <td style="text-align: right; font-weight: 700;" class="item-amt">₹ 500</td>
      <td><button class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); window.recalcInvoice();">✕</button></td>
    `;
    tbody?.appendChild(tr);
    (window as any).recalcInvoice();
  });

  tbody?.addEventListener('input', () => {
    (window as any).recalcInvoice();
  });
}

(window as any).recalcInvoice = () => {
  let subtotal = 0;
  document.querySelectorAll('.inv-row').forEach(row => {
    const qty = Number((row.querySelector('.item-qty') as HTMLInputElement)?.value) || 0;
    const rate = Number((row.querySelector('.item-rate') as HTMLInputElement)?.value) || 0;
    const amt = qty * rate;
    subtotal += amt;
    const amtSpan = row.querySelector('.item-amt');
    if (amtSpan) amtSpan.textContent = formatCurrency(amt);
  });
  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  const subEl = document.getElementById('inv-subtotal-val');
  const gstEl = document.getElementById('inv-gst-val');
  const totEl = document.getElementById('inv-total-val');
  if (subEl) subEl.textContent = formatCurrency(subtotal);
  if (gstEl) gstEl.textContent = formatCurrency(gst);
  if (totEl) totEl.textContent = formatCurrency(total);
};

// 7. COLLECTIONS (Matching bottom screen 7)
async function renderCollections() {
  const payments = await api.getPayments();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Collections</h1>
        <p class="dash-subtitle">Track all payments and collections</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary btn-sm">📅 01 Oct 2026 - 11 Oct 2026</button>
        <button class="btn btn-secondary btn-sm">All Types ▼</button>
        <button class="btn btn-secondary btn-sm">All Parties ▼</button>
        <button class="btn btn-primary btn-sm" onclick="window.exportCollectionsCSV()">📥 Export</button>
      </div>
    </div>

    <!-- 3 Collection KPI Cards (Matching Screen 7) -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px;">
      <div class="kpi-card-white">
        <div class="kpi-label">Total Collection</div>
        <div class="kpi-num" style="color: #0f172a; margin-top: 4px;">₹ 5,42,800</div>
      </div>
      <div class="kpi-card-white">
        <div class="kpi-label">UPI Collection</div>
        <div class="kpi-num" style="color: #2563eb; margin-top: 4px;">₹ 3,18,000</div>
      </div>
      <div class="kpi-card-white">
        <div class="kpi-label">Cash Collection</div>
        <div class="kpi-num" style="color: #d97706; margin-top: 4px;">₹ 2,24,800</div>
      </div>
    </div>

    <!-- Payments Table -->
    <div class="card-white">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm pay-filter-btn active" data-type="all">All</button>
          <button class="btn btn-secondary btn-sm pay-filter-btn" data-type="UPI">UPI</button>
          <button class="btn btn-secondary btn-sm pay-filter-btn" data-type="CASH">Cash</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.openDirectPaymentModal()">+ Record Payment</button>
      </div>

      <table class="clean-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Party</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Collected By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="payments-tbody">
          ${payments.map(p => `
            <tr class="payment-tr" data-type="${p.paymentMode}">
              <td>${p.date}</td>
              <td><strong>${p.shopName}</strong></td>
              <td style="font-weight: 700; font-family: var(--font-mono);">${formatCurrency(p.amount)}</td>
              <td>
                <span class="status-pill ${p.paymentMode === 'UPI' ? 'status-present' : 'status-late'}">
                  ${p.paymentMode}
                </span>
              </td>
              <td style="font-family: var(--font-mono); font-size: 0.78rem;">${p.transactionRef}</td>
              <td>${p.collectedBy}</td>
              <td>
                <span class="status-pill status-present">Verified</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('.pay-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.pay-filter-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      document.querySelectorAll('.pay-filter-btn').forEach(b => b.classList.add('btn-secondary'));
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active', 'btn-primary');
      target.classList.remove('btn-secondary');
      const type = target.getAttribute('data-type');

      document.querySelectorAll('.payment-tr').forEach(tr => {
        const t = tr.getAttribute('data-type');
        if (type === 'all' || t === type) (tr as HTMLElement).style.display = '';
        else (tr as HTMLElement).style.display = 'none';
      });
    });
  });
}

// 8. REPORTS VIEW
async function renderReports() {
  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Reports & Analytics</h1>
        <p class="dash-subtitle">Performance audits, collection trends and field efficiency</p>
      </div>
      <button class="btn btn-primary" onclick="showToast('Executive PDF Report generated!', '📊')">📥 Download Monthly PDF Report</button>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="card-white">
        <h3 style="font-size: 1.05rem; margin-bottom: 12px;">Top Performing Field Agents</h3>
        <table class="clean-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Visits</th>
              <th>Collections</th>
              <th>Target %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Rohit Kumar</strong></td>
              <td>86</td>
              <td>₹ 2,45,000</td>
              <td><span class="status-pill status-present">112%</span></td>
            </tr>
            <tr>
              <td><strong>Amit Singh</strong></td>
              <td>74</td>
              <td>₹ 1,82,000</td>
              <td><span class="status-pill status-present">98%</span></td>
            </tr>
            <tr>
              <td><strong>Neha Verma</strong></td>
              <td>68</td>
              <td>₹ 1,15,800</td>
              <td><span class="status-pill status-late">91%</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card-white">
        <h3 style="font-size: 1.05rem; margin-bottom: 12px;">Payment Method Distribution</h3>
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid var(--border-light); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>UPI / Netbanking: <strong>58.6%</strong></span>
            <span>Cash in Hand: <strong>41.4%</strong></span>
          </div>
          <div style="height: 14px; background: #e2e8f0; border-radius: 99px; overflow: hidden; display: flex;">
            <div style="background: #2563eb; width: 58.6%;"></div>
            <div style="background: #f59e0b; width: 41.4%;"></div>
          </div>
        </div>
        <p style="font-size: 0.8rem; color: #64748b;">
          Digital UPI payments increased by 14% compared to previous month.
        </p>
      </div>
    </div>
  `;
}

// 9. MOBILE SCREENS (Employee Handheld / PWA View matching Screen 8 in screenshot)
function renderMobileScreens() {
  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">8. Mobile App Screens (Employee)</h1>
        <p class="dash-subtitle">Interactive phone simulator showing the exact on-ground employee views</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary btn-sm mobile-tab-switch active" data-sub="home">1. Home</button>
        <button class="btn btn-secondary btn-sm mobile-tab-switch" data-sub="attendance">2. Attendance</button>
        <button class="btn btn-secondary btn-sm mobile-tab-switch" data-sub="visit">3. Store Visit</button>
        <button class="btn btn-secondary btn-sm mobile-tab-switch" data-sub="parties">4. Parties</button>
        <button class="btn btn-secondary btn-sm mobile-tab-switch" data-sub="collections">5. Collections</button>
      </div>
    </div>

    <!-- Phone Simulator Frame -->
    <div class="mobile-mockup-frame">
      <div class="phone-notch"></div>
      
      <div class="phone-screen" id="phone-screen-content"></div>

      <!-- Bottom Dock on Phone -->
      <div class="phone-bottom-nav">
        <button class="phone-nav-btn active" data-sub="home">
          <span>🏠</span>
          <span>Home</span>
        </button>
        <button class="phone-nav-btn" data-sub="attendance">
          <span>⏱️</span>
          <span>Attendance</span>
        </button>
        <button class="phone-nav-btn" data-sub="visit">
          <span>📍</span>
          <span>Store Visit</span>
        </button>
        <button class="phone-nav-btn" data-sub="parties">
          <span>👥</span>
          <span>Parties</span>
        </button>
      </div>
    </div>
  `;

  renderSubMobileScreen('home');

  document.querySelectorAll('.mobile-tab-switch, .phone-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const sub = target.getAttribute('data-sub') || 'home';
      document.querySelectorAll('.mobile-tab-switch').forEach(b => b.classList.toggle('active', b.getAttribute('data-sub') === sub));
      document.querySelectorAll('.phone-nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sub') === sub));
      renderSubMobileScreen(sub);
    });
  });
}

function renderSubMobileScreen(screen: string) {
  const container = document.getElementById('phone-screen-content');
  if (!container) return;

  if (screen === 'home') {
    container.innerHTML = `
      <div style="padding: 18px; background: #2563eb; color: white;">
        <div style="font-size: 0.75rem; opacity: 0.9;">Good Morning</div>
        <div style="font-size: 1.15rem; font-weight: 700;">Rohit Kumar</div>
        <div style="font-size: 0.7rem; background: rgba(255,255,255,0.2); display: inline-block; padding: 2px 8px; border-radius: 99px; margin-top: 4px;">On Duty: MP Nagar, Bhopal</div>
      </div>
      <div style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: white; padding: 14px; border-radius: 12px; border: 1px solid var(--border-light); text-align: center;">
            <div style="font-size: 1.6rem; font-weight: 800; color: #2563eb;">5</div>
            <div style="font-size: 0.75rem; color: #64748b;">Visits Done</div>
          </div>
          <div style="background: white; padding: 14px; border-radius: 12px; border: 1px solid var(--border-light); text-align: center;">
            <div style="font-size: 1.6rem; font-weight: 800; color: #059669;">2</div>
            <div style="font-size: 0.75rem; color: #64748b;">Collections</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="window.renderSubMobileScreen('visit')" style="padding: 12px; border-radius: 10px;">+ New Store Visit</button>
        <button class="btn btn-secondary" onclick="window.renderSubMobileScreen('attendance')" style="padding: 12px; border-radius: 10px;">Attendance Check</button>
      </div>
    `;
  } else if (screen === 'attendance') {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <div style="width: 72px; height: 72px; border-radius: 50%; background: #ecfdf5; color: #059669; font-size: 2.2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">✓</div>
        <h3 style="font-size: 1.15rem; margin-bottom: 4px;">You are checked In</h3>
        <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 18px;">09:08 AM • MP Nagar, Bhopal</p>
        <button class="btn btn-danger" style="padding: 14px; font-size: 0.95rem; border-radius: 10px;" onclick="showToast('Checked out at ' + new Date().toLocaleTimeString())">
          🔴 Check Out
        </button>
      </div>
    `;
  } else if (screen === 'visit') {
    container.innerHTML = `
      <div style="padding: 16px;">
        <h4 style="font-size: 0.95rem; margin-bottom: 12px;">Store Visit</h4>
        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); margin-bottom: 10px;">
          <div style="font-size: 0.72rem; color: #64748b;">Select Store:</div>
          <div style="font-weight: 700; font-size: 0.85rem;">Kumar Mobile Point</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); margin-bottom: 10px;">
          <div style="font-size: 0.72rem; color: #64748b;">Location:</div>
          <div style="font-size: 0.82rem;">MP Nagar, Bhopal (Auto-captured)</div>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
          <img src="https://images.unsplash.com/photo-1555421689-d68471e189f2?w=100" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">
          <img src="https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">
        </div>
        <button class="btn btn-primary" style="width: 100%; padding: 12px;" onclick="showToast('Visit Submitted [✓]!')">Submit Visit</button>
      </div>
    `;
  } else if (screen === 'parties') {
    container.innerHTML = `
      <div style="padding: 14px; overflow-y: auto;">
        <h4 style="font-size: 0.95rem; margin-bottom: 10px;">Retail Parties</h4>
        ${cachedParties.slice(0, 4).map(p => `
          <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 0.82rem;">${p.shopName}</div>
            <div style="font-size: 0.78rem; color: #ef4444; font-weight: 700;">${formatCurrency(p.currentBalance)}</div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (screen === 'collections') {
    container.innerHTML = `
      <div style="padding: 16px;">
        <h4 style="font-size: 0.95rem; margin-bottom: 12px;">Collect Payment</h4>
        <input type="number" class="form-input" placeholder="Amount (₹)" style="margin-bottom: 10px;" value="15000">
        <select class="form-select" style="margin-bottom: 14px;">
          <option>UPI</option>
          <option>Cash</option>
        </select>
        <button class="btn btn-primary" style="width: 100%; padding: 12px;" onclick="showToast('Payment Saved in IndexedDB!')">Save Payment</button>
      </div>
    `;
  }
}
(window as any).renderSubMobileScreen = renderSubMobileScreen;

// 10. DATABASE & SETTINGS VIEW
async function renderBackup() {
  const json = await api.exportJson();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Settings & Database Migration</h1>
        <p class="dash-subtitle">Export data as JSON, switch to Express TypeScript backend or reset data</p>
      </div>
    </div>

    <div style="max-width: 800px; display: flex; flex-direction: column; gap: 20px;">
      <div class="card-white">
        <h3 style="font-size: 1.1rem; margin-bottom: 8px;">💾 Backup & Export JSON</h3>
        <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 16px;">
          Download complete database snapshot containing all 24 employees, 86 visits, 156 invoices, and collection entries.
        </p>
        <button class="btn btn-primary" id="btn-export-file">📥 Download Full JSON Backup</button>
      </div>

      <div class="card-white">
        <h3 style="font-size: 1.1rem; margin-bottom: 8px;">Raw JSON Data Preview</h3>
        <textarea class="form-textarea" rows="8" readonly style="font-family: var(--font-mono); font-size: 0.75rem;">${json}</textarea>
      </div>
    </div>
  `;

  document.getElementById('btn-export-file')?.addEventListener('click', async () => {
    const dataStr = await api.exportJson();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sam-mobile-erp-data.json`;
    a.click();
    showToast('Backup downloaded successfully!', '📥');
  });
}

// Global Window Helpers
(window as any).switchView = (v: string) => switchView(v);

(window as any).focusOnEmployee = (name: string, lat: number, lng: number) => {
  if (activeMap) {
    activeMap.flyTo([lat, lng], 15, { duration: 1.2 });
    showToast(`Focused on ${name} at MP Nagar, Bhopal!`, '📍');
  }
};

(window as any).sendWhatsAppReminder = (phone: string, name: string, shop: string, balance: number, dueDate: string) => {
  const clean = phone.replace(/[^0-9]/g, '');
  const msg = `Namaste ${name} ji (${shop}),\n\nSAM MOBILE ki taraf se reminder:\nApka pending balance *${formatCurrency(balance)}* hai (${dueDate}).\n\nKripya UPI karein: upi://pay?pa=9300035900@upi&pn=SAM%20MOBILE&am=${balance}\n\nDhanyawad!\nSAM MOBILE Helpline: 9300035900`;
  window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  showToast(`WhatsApp reminder opened for ${shop}!`, '📲');
};

(window as any).viewPartyDetails = (id: string) => {
  const p = cachedParties.find(item => item.id === id);
  if (!p) return;
  openModal(`Party Details - ${p.shopName}`, `
    <div>
      <h4>${p.shopName} (${p.name})</h4>
      <p style="color:#64748b; font-size:0.82rem; margin:6px 0;">📍 ${p.address}</p>
      <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin:12px 0;">
        <strong>Customer Biodata:</strong>
        <p style="font-size:0.8rem; color:#334155; margin-top:4px;">${p.biodata}</p>
      </div>
      <div style="font-size:1.1rem; font-weight:700; color:#ef4444;">Outstanding Due: ${formatCurrency(p.currentBalance)}</div>
    </div>
  `);
};

(window as any).previewPhoto = (url: string, title: string) => {
  openModal(`📸 Photo - ${title}`, `<div style="text-align: center;"><img src="${url}" style="max-width: 100%; max-height: 70vh; border-radius: 10px;"></div>`);
};

(window as any).previewInvoice = async (invoiceId: string) => {
  const invoices = await api.getInvoices();
  const inv = invoices.find(i => i.id === invoiceId) || invoices[0];

  const html = `
    <div style="background: white; color: #0f172a; padding: 24px; font-size: 0.85rem;" id="invoice-sheet">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 14px;">
        <div>
          <h2 style="font-size: 1.4rem; color: #2563eb; margin-bottom: 2px;">SAM MOBILE</h2>
          <div style="font-size: 0.78rem; color: #64748b;">Your Business Partner • MP Nagar, Bhopal - 462011</div>
        </div>
        <div style="text-align: right;">
          <h3 style="font-size: 1.1rem; color: #0f172a;">INVOICE</h3>
          <div style="font-size: 0.8rem; color: #64748b;">Invoice No: ${inv.invoiceNumber}</div>
          <div style="font-size: 0.8rem; color: #64748b;">Date: ${inv.date}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">BILL TO:</div>
        <div style="font-weight: 700; font-size: 0.95rem;">${inv.shopName}</div>
        <div style="font-size: 0.8rem; color: #475569;">MP Nagar, Bhopal - 462011 • GSTIN: 23ABCD1234F1Z5</div>
      </div>

      <table class="clean-table" style="margin-bottom: 16px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>#</th>
            <th>Product</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><strong>Mobile Cover</strong></td>
            <td style="text-align: center;">10</td>
            <td style="text-align: right;">₹ 150</td>
            <td style="text-align: right; font-weight: 700;">₹ 1,500</td>
          </tr>
          <tr>
            <td>2</td>
            <td><strong>Screen Guard</strong></td>
            <td style="text-align: center;">20</td>
            <td style="text-align: right;">₹ 50</td>
            <td style="text-align: right; font-weight: 700;">₹ 1,000</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
        <div style="width: 220px; font-size: 0.82rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Subtotal</span>
            <span>₹ 2,500</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #64748b;">
            <span>GST (18%)</span>
            <span>₹ 450</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; border-top: 2px solid #e2e8f0; padding-top: 6px;">
            <span>Total</span>
            <span style="color: #2563eb;">₹ 2,950</span>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
        <span style="font-size: 0.75rem; color: #64748b;">Thank you for your business!</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print</button>
          <button class="btn btn-whatsapp btn-sm" onclick="window.sendWhatsAppReminder('0987654321', 'Suresh Sharma', 'Sharma Traders', 2950, 'Immediate')">Share on WhatsApp</button>
        </div>
      </div>
    </div>
  `;

  openModal(`Invoice Preview - ${inv.invoiceNumber}`, html);
};

(window as any).viewEmployeeAttendanceDetail = (name: string, checkIn: string, loc: string) => {
  openModal(`Attendance Details - ${name}`, `
    <div style="padding: 10px;">
      <h4 style="font-size: 1.1rem;">${name}</h4>
      <p style="color: #64748b; font-size: 0.85rem; margin: 4px 0 14px;">Location: 📍 ${loc}</p>
      <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Check-in Time:</span>
          <strong>${checkIn}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Status:</span>
          <span class="status-pill status-present">Present (On Duty)</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Today's Store Visits:</span>
          <strong>5 Visits Completed</strong>
        </div>
      </div>
    </div>
  `);
};

(window as any).exportAttendanceCSV = () => {
  const csv = "Employee,Check-in,Check-out,Location,Status\nRohit Kumar,09:08 AM,06:12 PM,MP Nagar,Present\nAmit Singh,09:12 AM,06:01 PM,Kolar Road,Present\nSandeep Yadav,--,--,--,Absent\nNeha Verma,09:10 AM,06:20 PM,Ayodhya Bypass,Present\nRajesh Patel,09:15 AM,06:05 PM,Arera Colony,Present";
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'attendance-report.csv';
  a.click();
  showToast('Attendance CSV exported!', '📥');
};

(window as any).exportCollectionsCSV = () => {
  const csv = "Date,Party,Amount,Type,Reference,Status\n11 Oct 2026,Sharma Traders,25000,UPI,UTR123456,Verified\n11 Oct 2026,Gupta Mobile Store,15000,Cash,CASH-098,Verified\n10 Oct 2026,Jain Electronics,20000,UPI,UTR987654,Verified";
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'collections-report.csv';
  a.click();
  showToast('Collections CSV exported!', '📥');
};

function openQuickPunchModal() {
  openModal('⏱️ Quick Punch Action', `
    <div style="text-align: center; padding: 10px;">
      <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 14px;">Select Employee to punch in/out</p>
      <select class="form-select" id="quick-punch-emp" style="margin-bottom: 16px;">
        ${cachedStaff.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
      </select>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-primary" style="flex: 1;" onclick="showToast('Punch In Successful!'); document.getElementById('modal-close-btn').click();">🟢 Punch In</button>
        <button class="btn btn-secondary" style="flex: 1;" onclick="showToast('Punch Out Successful!'); document.getElementById('modal-close-btn').click();">🔴 Punch Out</button>
      </div>
    </div>
  `);
}

function openAddPartyModal() {
  openModal('👤 Add New Retailer / Party', `
    <form id="form-new-party" onsubmit="event.preventDefault(); window.submitNewParty();">
      <div class="form-group">
        <label class="form-label">Shop / Party Name *</label>
        <input type="text" id="np-shop" class="form-input" required placeholder="e.g. Jain Mobile Point">
      </div>
      <div class="form-group">
        <label class="form-label">Owner Name *</label>
        <input type="text" id="np-name" class="form-input" required placeholder="e.g. Suresh Jain">
      </div>
      <div class="form-group">
        <label class="form-label">Mobile Number *</label>
        <input type="text" id="np-phone" class="form-input" required placeholder="0987654321">
      </div>
      <div class="form-group">
        <label class="form-label">Customer Biodata (Background / Habits) *</label>
        <textarea id="np-bio" class="form-textarea" rows="2" placeholder="Credit history, preferred payment mode..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px;">Save Party</button>
    </form>
  `);
}

(window as any).submitNewParty = async () => {
  const newParty: CustomerParty = {
    id: 'CUST-' + Date.now(),
    shopName: (document.getElementById('np-shop') as HTMLInputElement).value,
    name: (document.getElementById('np-name') as HTMLInputElement).value,
    phone: (document.getElementById('np-phone') as HTMLInputElement).value,
    address: 'MP Nagar, Bhopal',
    biodata: (document.getElementById('np-bio') as HTMLTextAreaElement).value,
    creditLimit: 100000,
    currentBalance: 0,
    duePaymentDate: 'Active',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'
  };
  await api.addParty(newParty);
  closeModal();
  showToast(`Party ${newParty.shopName} added successfully!`, '👤');
  renderParties();
};

(window as any).openDirectPaymentModal = () => {
  openModal('💰 Record Collection (UPI or Cash)', `
    <form onsubmit="event.preventDefault(); showToast('Payment recorded!'); document.getElementById('modal-close-btn').click();">
      <div class="form-group">
        <label class="form-label">Select Party</label>
        <select class="form-select">
          ${cachedParties.map(p => `<option>${p.shopName} (${p.name}) - Due: ${formatCurrency(p.currentBalance)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input type="number" class="form-input" value="25000">
        </div>
        <div class="form-group">
          <label class="form-label">Mode</label>
          <select class="form-select">
            <option>UPI</option>
            <option>Cash</option>
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px;">Save Collection</button>
    </form>
  `);
};

// Global search handling
function setupGlobalSearch() {
  globalSearchInput?.addEventListener('input', () => {
    const q = globalSearchInput.value.trim().toLowerCase();
    if (!q) {
      searchResultsDropdown?.classList.add('hidden');
      return;
    }

    const matchesParties = cachedParties.filter(p => p.shopName.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.phone.includes(q));
    const matchesStaff = cachedStaff.filter(s => s.name.toLowerCase().includes(q));

    if (matchesParties.length === 0 && matchesStaff.length === 0) {
      searchResultsDropdown.innerHTML = `<div style="padding: 10px; font-size: 0.8rem; color: #94a3b8; text-align: center;">No matching customers or staff found</div>`;
      searchResultsDropdown.classList.remove('hidden');
      return;
    }

    searchResultsDropdown.innerHTML = `
      ${matchesParties.map(p => `
        <div class="search-dropdown-item" onclick="window.viewPartyDetails('${p.id}'); document.getElementById('search-results-dropdown').classList.add('hidden');">
          <div>
            <strong>${p.shopName}</strong> <small style="color: #64748b;">(${p.name})</small>
          </div>
          <span style="color: #ef4444; font-weight: 700; font-family: var(--font-mono); font-size: 0.75rem;">${formatCurrency(p.currentBalance)}</span>
        </div>
      `).join('')}
      ${matchesStaff.map(s => `
        <div class="search-dropdown-item" onclick="window.switchView('tracking'); window.focusOnEmployee('${s.name}', 23.2332, 77.4343); document.getElementById('search-results-dropdown').classList.add('hidden');">
          <div>
            <strong>👤 ${s.name}</strong> <small style="color: #64748b;">(Field Executive)</small>
          </div>
          <span class="status-pill status-present" style="font-size: 0.65rem;">On Duty</span>
        </div>
      `).join('')}
    `;
    searchResultsDropdown.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!globalSearchInput.contains(e.target as Node) && !searchResultsDropdown.contains(e.target as Node)) {
      searchResultsDropdown?.classList.add('hidden');
    }
  });
}

function initApp() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-view');
      if (v) switchView(v);
    });
  });

  notificationsBellBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationsPopover?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    notificationsPopover?.classList.add('hidden');
  });

  document.getElementById('user-profile-btn')?.addEventListener('click', () => {
    openModal('User Profile - Amit Sharma (Admin)', `
      <div style="text-align: center; padding: 10px;">
        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">
        <h4>Amit Sharma</h4>
        <p style="color: #64748b; font-size: 0.8rem;">General Manager / Admin • SAM MOBILE</p>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0; text-align: left; font-size: 0.82rem;">
          <div>Zone: <strong>Bhopal & NCR Operations</strong></div>
          <div>Contact: <strong>9300035900</strong></div>
          <div>Active Staff on Field: <strong>20 Present</strong></div>
        </div>
      </div>
    `);
  });

  setupGlobalSearch();
  switchView('dashboard');
}

window.addEventListener('DOMContentLoaded', initApp);
