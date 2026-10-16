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
  DashboardMetrics,
  InvoiceItem
} from './types';

// Global state
let currentView = 'dashboard';
let currentDateFilter = 'Today 11 Oct 2026';
let currentAttStatusFilter = 'all';
let currentAttDateFilter = 'today'; // 'today' | 'yesterday' | 'month' | YYYY-MM-DD
let currentTrackingTileMode: 'osm' | 'sat' = 'osm';
let selectedStaffId: string = 'STF-01';

let cachedStaff: Staff[] = [];
let cachedParties: CustomerParty[] = [];
let cachedTracking: TrackingPoint[] = [];

let activeMap: L.Map | null = null;
let activeTileLayer: L.TileLayer | null = null;
let activePolyline: L.Polyline | null = null;
let mapMarkers: { staffId: string; marker: L.Marker }[] = [];

// DOM References
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

// Notification helper
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

modalCloseBtn?.addEventListener('click', closeModal);
modalContainer?.addEventListener('click', (e) => {
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
    activeTileLayer = null;
    activePolyline = null;
    mapMarkers = [];
  }
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName);
  });
  renderActiveView();
}

async function renderActiveView() {
  viewContent.innerHTML = `
    <div style="text-align:center; padding: 60px 0;">
      <div style="font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
      <p style="color: #64748b; font-size: 0.9rem;">Loading SAM MOBILE ERP data...</p>
    </div>
  `;

  cachedStaff = await api.getStaff();
  cachedParties = await api.getParties();
  cachedTracking = await api.getTrackingPoints();

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

// ============================================================================
// 1. DASHBOARD VIEW (With dynamic date-wise filters & KPI recalculation)
// ============================================================================
async function renderDashboard() {
  const metrics = await api.getMetrics();
  let attendance = await api.getAttendance();
  const parties = await api.getParties();
  const tracking = await api.getTrackingPoints();
  let visits = await api.getStoreVisits();
  let payments = await api.getPayments();
  const invoices = await api.getInvoices();

  // Dynamic filter based on selected date
  let dateTitle = currentDateFilter;
  let multiplier = 1;
  if (currentDateFilter.includes('Yesterday')) {
    attendance = attendance.slice(0, 4);
    visits = visits.slice(0, 2);
    payments = payments.filter(p => p.date.includes('10 Oct') || p.date.includes('09 Oct'));
    multiplier = 0.85;
  } else if (currentDateFilter.includes('This Week')) {
    multiplier = 3.4;
  } else if (currentDateFilter.includes('Month')) {
    multiplier = 12.5;
  }

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const displayTotalCollection = Math.round(metrics.todayTotalCollection * multiplier);
  const displayUpiCollection = Math.round(metrics.todayUpiCollection * multiplier);
  const displayCashCollection = Math.round(metrics.todayCashCollection * multiplier);
  const displayVisitsCount = Math.round(visits.length * (multiplier > 1 ? multiplier : 1));

  viewContent.innerHTML = `
    <!-- Dashboard Header -->
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Dashboard</h1>
        <p class="dash-subtitle">Noida & NCR Field Operations, Handset Distribution & Collections</p>
      </div>
      <div class="date-pill-btn" id="date-pill-toggle">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span id="active-date-label">${currentDateFilter}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        
        <!-- Date Selector Dropdown -->
        <div class="date-dropdown-menu hidden" id="date-dropdown-menu">
          <div class="date-dropdown-item" data-date="Today 11 Oct 2026">Today 11 Oct 2026</div>
          <div class="date-dropdown-item" data-date="Yesterday 10 Oct 2026">Yesterday 10 Oct 2026</div>
          <div class="date-dropdown-item" data-date="This Week">This Week (05 Oct - 11 Oct)</div>
          <div class="date-dropdown-item" data-date="October 2026">This Month (Oct 2026)</div>
        </div>
      </div>
    </div>

    <!-- 5 KPI Cards -->
    <div class="kpi-row-5">
      <!-- 1. Total Employees -->
      <div class="kpi-card-white" onclick="window.switchView('attendance')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #eff6ff; color: #2563eb;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="kpi-growth-pill positive">Active</span>
        </div>
        <div class="kpi-num">${cachedStaff.length || 6}</div>
        <div class="kpi-label">Field Executives</div>
        <div class="kpi-footer-sub">
          <strong style="color: #059669;">${presentCount} On Duty</strong> • <span style="color: #dc2626;">${absentCount} Logged Out</span>
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
        <div class="kpi-num">${displayVisitsCount}</div>
        <div class="kpi-label">Store Visits</div>
        <div class="kpi-footer-sub">
          Verified: <strong style="color: #2563eb;">${visits.filter(v => v.isVerified).length}</strong> • Pending: <strong>${visits.filter(v => !v.isVerified).length}</strong>
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
        <div class="kpi-num">${formatCurrency(displayTotalCollection)}</div>
        <div class="kpi-label">Total Collection</div>
        <div class="kpi-footer-sub">
          UPI: <strong>${formatCurrency(displayUpiCollection)}</strong> • Cash: <strong>${formatCurrency(displayCashCollection)}</strong>
        </div>
      </div>

      <!-- 4. Pending Payments -->
      <div class="kpi-card-white" onclick="window.switchView('parties')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #fef2f2; color: #ef4444;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          </div>
          <span class="kpi-growth-pill negative">Due</span>
        </div>
        <div class="kpi-num" style="color: #ef4444;">${formatCurrency(metrics.totalMarketOutstanding)}</div>
        <div class="kpi-label">Pending Payments</div>
        <div class="kpi-footer-sub">
          <span style="color: #ef4444; font-weight: 600;">${parties.filter(p => p.currentBalance > 0).length} Retailers Overdue</span>
        </div>
      </div>

      <!-- 5. Total Invoices -->
      <div class="kpi-card-white" onclick="window.switchView('invoices')">
        <div class="kpi-top">
          <div class="kpi-icon-box" style="background: #eff6ff; color: #2563eb;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <span class="kpi-growth-pill positive">Active</span>
        </div>
        <div class="kpi-num">${invoices.length}</div>
        <div class="kpi-label">Total Invoices</div>
        <div class="kpi-footer-sub">Handset Billing Active</div>
      </div>
    </div>

    <!-- Middle Row: Attendance Table & Live Tracking Map -->
    <div class="dash-mid-grid">
      <!-- Attendance Card -->
      <div class="card-white">
        <div class="card-header-flex">
          <span class="card-title-text">Employee Attendance (${dateTitle})</span>
          <a class="card-view-all" onclick="window.switchView('attendance')">View All →</a>
        </div>

        <table class="clean-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Check-in</th>
              <th>Location</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.map(att => `
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
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="window.viewEmployeeAttendanceDetail('${att.staffName}', '${att.punchInTime}', '${att.punchInLocation}', '${att.status}')">View</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Live Tracking Map Card -->
      <div class="card-white" style="position: relative;">
        <div class="card-header-flex">
          <span class="card-title-text">Live Employee Tracking (Noida / NCR)</span>
          <a class="card-view-all" onclick="window.switchView('tracking')">View Full Map →</a>
        </div>

        <div id="live-tracking-map" style="height: 320px; width: 100%; border-radius: 8px;"></div>

        <div class="map-card-popup" id="active-map-card">
          <div class="map-popup-header">
            <span class="map-popup-name" id="popup-agent-name">Rohit Kumar</span>
            <span class="status-pill status-present" style="font-size: 0.65rem;">On Duty</span>
          </div>
          <div class="map-popup-sub" id="popup-agent-sub">
            Sector 18, Atta Market, Noida<br>Live GPS: 28.5708° N, 77.3271° E
          </div>
          <a class="map-popup-link" onclick="window.focusOnEmployee('STF-01', 'Rohit Kumar', 28.5708, 77.3271, 'Sector 18, Atta Market, Noida')">Center & Details →</a>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Recent Activities & Pending Payments -->
    <div class="dash-bottom-grid">
      <!-- Recent Activities -->
      <div class="card-white">
        <div class="card-header-flex">
          <span class="card-title-text">Recent Operations Feed</span>
          <a class="card-view-all">Live Pings</a>
        </div>

        <div class="activity-feed-list">
          ${visits.slice(0, 2).map(v => `
            <div class="activity-item">
              <div class="activity-icon" style="background: #eff6ff; color: #2563eb;">📍</div>
              <div class="activity-body">
                <div class="activity-title">${v.staffName} submitted visit at <strong>${v.storeName}</strong></div>
                <div class="activity-time">${v.visitTime} • ${v.address}</div>
              </div>
            </div>
          `).join('')}
          ${payments.slice(0, 2).map(p => `
            <div class="activity-item">
              <div class="activity-icon" style="background: #ecfdf5; color: #10b981;">💰</div>
              <div class="activity-body">
                <div class="activity-title">Payment received from <strong>${p.shopName}</strong>: ${formatCurrency(p.amount)} (${p.paymentMode})</div>
                <div class="activity-time">${p.date} • Ref: ${p.transactionRef}</div>
              </div>
            </div>
          `).join('')}
          ${invoices.slice(0, 1).map(inv => `
            <div class="activity-item">
              <div class="activity-icon" style="background: #eff6ff; color: #6366f1;">🧾</div>
              <div class="activity-body">
                <div class="activity-title">Invoice <strong>#${inv.invoiceNumber}</strong> generated for ${inv.shopName}</div>
                <div class="activity-time">${inv.date} • Total: ${formatCurrency(inv.totalAmount)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Pending Payments List with 1-Click WhatsApp -->
      <div class="card-white">
        <div class="card-header-flex">
          <span class="card-title-text">Pending Retailer Ledger</span>
          <a class="card-view-all" onclick="window.switchView('parties')">View All →</a>
        </div>

        <div class="pending-pay-list">
          ${parties.filter(p => p.currentBalance > 0).slice(0, 5).map(p => `
            <div class="pending-pay-item">
              <div>
                <div class="pending-store-name">${p.shopName}</div>
                <div class="pending-amount">${formatCurrency(p.currentBalance)}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="status-pill ${p.duePaymentDate?.includes('overdue') ? 'status-overdue' : 'status-due-soon'}">
                  ${p.duePaymentDate || 'Due Soon'}
                </span>
                <button class="btn btn-whatsapp" style="padding: 4px 8px; font-size: 0.72rem;" onclick="window.sendWhatsAppReminder('${p.phone}', '${p.name}', '${p.shopName}', ${p.currentBalance}, '${p.duePaymentDate || 'Due date'}')">
                  📲 Remind
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 8 Modules Visual Navigation Grid -->
    <div class="modules-preview-section">
      <div class="modules-preview-header">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">All Operations & Mobile Modules</h3>
          <p style="font-size: 0.8rem; color: #64748b;">Direct access to all 8 web dashboards and field employee mobile screens</p>
        </div>
      </div>

      <div class="modules-grid-8">
        <div class="module-preview-card" onclick="window.switchView('attendance')">
          <div>
            <span class="module-badge">1. Web View</span>
            <div class="module-title">Attendance Management</div>
            <div class="module-desc">Track staff check-in/out, hours worked, late marks, and presence register.</div>
          </div>
          <div class="module-action-link">Open Attendance →</div>
        </div>

        <div class="module-preview-card" onclick="window.switchView('tracking')">
          <div>
            <span class="module-badge">2. Web View</span>
            <div class="module-title">Employee Tracking</div>
            <div class="module-desc">Interactive real-time OpenStreetMap with route paths, battery, and location history.</div>
          </div>
          <div class="module-action-link">Open Live Map →</div>
        </div>

        <div class="module-preview-card" onclick="window.switchView('visits')">
          <div>
            <span class="module-badge">3. Mobile / Web</span>
            <div class="module-title">Store Visit Submission</div>
            <div class="module-desc">Auto-captured GPS, camera photo uploads, discussion notes, and verified visits check.</div>
          </div>
          <div class="module-action-link">Open Store Check-in →</div>
        </div>

        <div class="module-preview-card" onclick="window.switchView('parties')">
          <div>
            <span class="module-badge">4. Web View</span>
            <div class="module-title">Party / Customer CRM</div>
            <div class="module-desc">Customer biodata, credit limits, overdue ledger, and 1-Click WhatsApp payment reminders.</div>
          </div>
          <div class="module-action-link">Open Customer CRM →</div>
        </div>

        <div class="module-preview-card" onclick="window.switchView('invoices')">
          <div>
            <span class="module-badge">5. Web View</span>
            <div class="module-title">Invoice Creation</div>
            <div class="module-desc">Handset billing with IMEI number tracking, product line items, and auto 18% GST.</div>
          </div>
          <div class="module-action-link">Create Invoice →</div>
        </div>

        <div class="module-preview-card" onclick="window.previewInvoice('INV-2026-0156')">
          <div>
            <span class="module-badge">6. Web View</span>
            <div class="module-title">Invoice Preview (Print/PDF)</div>
            <div class="module-desc">GST-compliant tax bill receipt ready for print, PDF download, or WhatsApp sharing.</div>
          </div>
          <div class="module-action-link">Preview Sample Bill →</div>
        </div>

        <div class="module-preview-card" onclick="window.switchView('collections')">
          <div>
            <span class="module-badge">7. Web View</span>
            <div class="module-title">Collection & Tracking</div>
            <div class="module-desc">Daily ledger tracking UPI vs Cash in hand, UTR transaction references, and reconciliation.</div>
          </div>
          <div class="module-action-link">Open Collections →</div>
        </div>

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
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const val = (item as HTMLElement).getAttribute('data-date') || 'Today 11 Oct 2026';
      currentDateFilter = val;
      const label = document.getElementById('active-date-label');
      if (label) label.textContent = val;
      dateMenu?.classList.add('hidden');
      showToast(`Showing operations for ${val}`, '📅');
      await renderDashboard();
    });
  });

  document.addEventListener('click', () => {
    dateMenu?.classList.add('hidden');
  });

  // Initialize Map on Dashboard
  setTimeout(() => {
    initLeafletMap('live-tracking-map', tracking);
  }, 100);
}

// Leaflet OpenStreetMap helper (Noida / NCR Hub)
function initLeafletMap(containerId: string, trackingPoints: TrackingPoint[]) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (activeMap) {
    activeMap.remove();
    activeMap = null;
  }

  // Noida Sector 18 Central Hub
  const centerLat = 28.5708;
  const centerLng = 77.3271;

  activeMap = L.map(containerId, {
    zoomControl: true,
    attributionControl: false
  }).setView([centerLat, centerLng], 12);

  const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const satUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  activeTileLayer = L.tileLayer(currentTrackingTileMode === 'sat' ? satUrl : osmUrl, {
    maxZoom: 19
  }).addTo(activeMap);

  mapMarkers = [];

  // Add agent markers with avatar icons
  trackingPoints.forEach((t) => {
    const customIcon = L.divIcon({
      className: 'custom-map-avatar-marker',
      html: `
        <div style="width: 38px; height: 38px; border-radius: 50%; border: 3px solid ${t.staffId === selectedStaffId ? '#dc2626' : '#2563eb'}; background: #ffffff; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; position: relative;">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60" style="width: 100%; height: 100%; object-fit: cover;">
          <span style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid white;"></span>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([t.latitude, t.longitude], { icon: customIcon }).addTo(activeMap!);
    marker.bindPopup(`
      <div style="font-family: var(--font-family); padding: 6px; min-width: 180px;">
        <strong style="font-size: 0.92rem; color: #0f172a;">${t.staffName}</strong>
        <div style="font-size: 0.75rem; color: #059669; font-weight: 700; margin: 3px 0;">● On Duty (${t.batteryLevel}% Battery)</div>
        <div style="font-size: 0.8rem; color: #475569; margin: 2px 0;">📍 ${t.address}</div>
        <div style="font-size: 0.72rem; color: #2563eb; font-family: var(--font-mono); font-weight: 600;">GPS: ${t.latitude.toFixed(4)}° N, ${t.longitude.toFixed(4)}° E</div>
        <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">Last Ping: ${t.timestamp}</div>
      </div>
    `);

    marker.on('click', () => {
      (window as any).focusOnEmployee(t.staffId, t.staffName, t.latitude, t.longitude, t.address);
    });

    mapMarkers.push({ staffId: t.staffId, marker });
  });

  // Noida Route Polyline connecting Sector 15 -> Sector 18 -> Sector 29 -> Sector 62
  const routeCoords: [number, number][] = [
    [28.5835, 77.3150], // Sector 15
    [28.5708, 77.3271], // Sector 18 Atta Market
    [28.5645, 77.3340], // Sector 29 / Botanical Garden
    [28.6280, 77.3649]  // Sector 62 Electronic City
  ];
  activePolyline = L.polyline(routeCoords, { color: '#2563eb', weight: 4, dashArray: '6, 8', opacity: 0.85 }).addTo(activeMap);

  setTimeout(() => {
    activeMap?.invalidateSize();
  }, 200);
}

// ============================================================================
// 2. ATTENDANCE MANAGEMENT (With full date-wise filtering & Native date picker)
// ============================================================================
async function renderAttendance() {
  const allRecords = await api.getAttendance('all');

  // Filter records by date and status
  let filtered = allRecords;
  if (currentAttDateFilter === 'today') {
    filtered = filtered.filter(r => r.date === '2026-10-11' || !r.date);
  } else if (currentAttDateFilter === 'yesterday') {
    filtered = filtered.slice(0, 3);
  } else if (currentAttDateFilter !== 'month' && currentAttDateFilter !== 'all') {
    filtered = filtered.filter(r => r.date === currentAttDateFilter);
  }

  // Filter by status
  if (currentAttStatusFilter === 'present') filtered = filtered.filter(r => r.status === 'present');
  else if (currentAttStatusFilter === 'absent') filtered = filtered.filter(r => r.status === 'absent');
  else if (currentAttStatusFilter === 'late') filtered = filtered.filter(r => r.punchInTime > '09:15 AM' && r.status === 'present');
  else if (currentAttStatusFilter === 'half_day') filtered = filtered.filter(r => r.status === 'half_day');

  const presentCount = allRecords.filter(r => r.status === 'present').length;
  const absentCount = allRecords.filter(r => r.status === 'absent').length;
  const lateCount = allRecords.filter(r => r.punchInTime > '09:15 AM' && r.status === 'present').length;
  const halfDayCount = allRecords.filter(r => r.status === 'half_day').length;

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Attendance Register</h1>
        <p class="dash-subtitle">Track employee attendance, working hours, and field punch records date-wise</p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <input type="date" id="native-att-date-picker" value="2026-10-11" style="display: none;">
        <button class="btn btn-secondary btn-sm" id="btn-pick-custom-date">📅 Pick Date: ${currentAttDateFilter.toUpperCase()}</button>
        <button class="btn btn-primary" id="btn-quick-punch">⏱️ Punch In/Out</button>
      </div>
    </div>

    <!-- Filter & Summary Pills -->
    <div class="card-white" style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <!-- Date Tabs -->
        <div style="display: flex; gap: 8px;">
          <button class="btn ${currentAttDateFilter === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm date-att-btn" data-date="today">Today (11 Oct)</button>
          <button class="btn ${currentAttDateFilter === 'yesterday' ? 'btn-primary' : 'btn-secondary'} btn-sm date-att-btn" data-date="yesterday">Yesterday (10 Oct)</button>
          <button class="btn ${currentAttDateFilter === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm date-att-btn" data-date="month">Full Month</button>
        </div>

        <!-- Status Filter Pills -->
        <div style="display: flex; gap: 8px;">
          <button class="btn ${currentAttStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm status-att-btn" data-status="all">All</button>
          <button class="btn ${currentAttStatusFilter === 'present' ? 'btn-primary' : 'btn-secondary'} btn-sm status-att-btn" data-status="present">Present</button>
          <button class="btn ${currentAttStatusFilter === 'absent' ? 'btn-primary' : 'btn-secondary'} btn-sm status-att-btn" data-status="absent">Absent</button>
          <button class="btn ${currentAttStatusFilter === 'late' ? 'btn-primary' : 'btn-secondary'} btn-sm status-att-btn" data-status="late">Late</button>
          <button class="btn btn-secondary btn-sm" onclick="window.exportAttendanceCSV()">📥 Export CSV</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); cursor: pointer;" onclick="window.setAttendanceStatusFilter('present')">
          <span style="font-size: 0.75rem; color: #64748b;">🟢 Present</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #059669;">${presentCount}</div>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); cursor: pointer;" onclick="window.setAttendanceStatusFilter('absent')">
          <span style="font-size: 0.75rem; color: #64748b;">🔴 Absent</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #dc2626;">${absentCount}</div>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); cursor: pointer;" onclick="window.setAttendanceStatusFilter('late')">
          <span style="font-size: 0.75rem; color: #64748b;">🟡 Late</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #d97706;">${lateCount}</div>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); cursor: pointer;" onclick="window.setAttendanceStatusFilter('half_day')">
          <span style="font-size: 0.75rem; color: #64748b;">🔵 Half Day</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: #2563eb;">${halfDayCount}</div>
        </div>
      </div>
    </div>

    <!-- Attendance Table -->
    <div class="card-white">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="font-size: 1rem; color: #0f172a;">Attendance Records (${filtered.length} shown)</h4>
        <span style="font-size: 0.78rem; color: #64748b;">Date: <strong>${currentAttDateFilter.toUpperCase()}</strong> • Status: <strong>${currentAttStatusFilter.toUpperCase()}</strong></span>
      </div>

      <table class="clean-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Location (Noida)</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td>
                <div class="emp-cell">
                  <img src="${r.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="emp-avatar">
                  <div>
                    <strong>${r.staffName}</strong>
                    <div style="font-size: 0.7rem; color: #64748b;">ID: ${r.staffId} • ${r.date || '2026-10-11'}</div>
                  </div>
                </div>
              </td>
              <td>${r.punchInTime}</td>
              <td>${r.punchOutTime || '--'}</td>
              <td><span style="color: #475569;">📍 ${r.punchInLocation}</span></td>
              <td>
                <span class="status-pill ${r.status === 'present' ? 'status-present' : (r.status === 'half_day' ? 'status-late' : 'status-absent')}">
                  ${r.status === 'present' ? 'Present' : (r.status === 'half_day' ? 'Half Day' : 'Absent')}
                </span>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="window.viewEmployeeAttendanceDetail('${r.staffName}', '${r.punchInTime}', '${r.punchInLocation}', '${r.status}')">View Details</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Attach date buttons
  document.querySelectorAll('.date-att-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      currentAttDateFilter = (e.currentTarget as HTMLElement).getAttribute('data-date') || 'today';
      await renderAttendance();
    });
  });

  // Attach status buttons
  document.querySelectorAll('.status-att-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      currentAttStatusFilter = (e.currentTarget as HTMLElement).getAttribute('data-status') || 'all';
      await renderAttendance();
    });
  });

  // Native custom date picker (Ponytail: native platform feature)
  const picker = document.getElementById('native-att-date-picker') as HTMLInputElement;
  document.getElementById('btn-pick-custom-date')?.addEventListener('click', () => {
    picker.showPicker ? picker.showPicker() : picker.click();
  });
  picker?.addEventListener('change', async () => {
    if (picker.value) {
      currentAttDateFilter = picker.value;
      showToast(`Filtered attendance for ${picker.value}`, '📅');
      await renderAttendance();
    }
  });

  document.getElementById('btn-quick-punch')?.addEventListener('click', openQuickPunchModal);
}

(window as any).setAttendanceStatusFilter = async (s: string) => {
  currentAttStatusFilter = s;
  await renderAttendance();
};

// ============================================================================
// 3. EMPLOYEE TRACKING VIEW (With interactive agent selection & live coordinates)
// ============================================================================
async function renderTracking() {
  const tracking = await api.getTrackingPoints();
  const staff = cachedStaff;

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Employee Tracking (Noida / NCR)</h1>
        <p class="dash-subtitle">Click on any sales agent to pinpoint live GPS position, current battery & route trail</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn ${currentTrackingTileMode === 'osm' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btn-mode-map">Map View</button>
        <button class="btn ${currentTrackingTileMode === 'sat' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btn-mode-sat">Satellite View</button>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2.2fr 1fr; gap: 18px;">
      <div class="card-white" style="padding: 0; overflow: hidden; height: 580px; position: relative;">
        <div id="full-tracking-map" style="width: 100%; height: 100%;"></div>
        
        <!-- Live Agent Floating Info Badge -->
        <div style="position: absolute; bottom: 16px; left: 16px; z-index: 500; background: white; padding: 10px 14px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid var(--border-light); font-size: 0.8rem;" id="tracking-floating-pill">
          <strong>Selected:</strong> <span id="track-agent-name" style="color: #2563eb; font-weight: 700;">Rohit Kumar</span> | 
          <span id="track-agent-gps" style="font-family: var(--font-mono); color: #059669;">28.5708° N, 77.3271° E</span>
        </div>
      </div>

      <div class="card-white" style="height: 580px; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 0.95rem;">Field Agents (${staff.length})</h4>
          <span style="font-size: 0.72rem; color: #2563eb; font-weight: 600;">Click to Locate 📍</span>
        </div>

        <input type="text" id="tracking-search" class="form-input" placeholder="Search agent name or Sector..." style="margin-bottom: 12px;">

        <div style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px;" id="tracking-emp-list">
          ${staff.map((s, idx) => {
            const trk = tracking[idx] || tracking[0];
            const isSelected = s.id === selectedStaffId;
            return `
              <div class="tracking-item-card" id="track-card-${s.id}" style="padding: 12px; border-radius: 8px; border: ${isSelected ? '2px solid #2563eb' : '1px solid var(--border-light)'}; background: ${isSelected ? '#eff6ff' : '#f8fafc'}; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onclick="window.focusOnEmployee('${s.id}', '${s.name}', ${trk.latitude}, ${trk.longitude}, '${trk.address}')">
                <div style="display: flex; gap: 10px; align-items: center;">
                  <img src="${s.avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                  <div>
                    <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a;">${s.name}</div>
                    <div style="font-size: 0.72rem; color: #64748b;">📍 ${trk.address}</div>
                    <div style="font-size: 0.68rem; color: #2563eb; font-family: var(--font-mono);">${trk.latitude.toFixed(4)}, ${trk.longitude.toFixed(4)}</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span class="status-pill status-present" style="font-size: 0.65rem;">On Duty</span>
                  <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 4px;">🔋 ${trk.batteryLevel}%</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    initLeafletMap('full-tracking-map', tracking);
  }, 100);

  // Map Tile Toggle
  document.getElementById('btn-mode-map')?.addEventListener('click', () => {
    currentTrackingTileMode = 'osm';
    renderTracking();
  });
  document.getElementById('btn-mode-sat')?.addEventListener('click', () => {
    currentTrackingTileMode = 'sat';
    renderTracking();
  });

  // Filter staff list
  document.getElementById('tracking-search')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('#tracking-emp-list > div').forEach(item => {
      const text = item.textContent?.toLowerCase() || '';
      (item as HTMLElement).style.display = text.includes(q) ? 'flex' : 'none';
    });
  });
}

// ============================================================================
// 4. STORE VISITS VIEW (With party auto-address fill & real verified toggle)
// ============================================================================
async function renderStoreVisits() {
  const visits = await api.getStoreVisits();
  const parties = cachedParties;

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Store Visits</h1>
        <p class="dash-subtitle">Submission of store visit, location, camera photo check, and verification status</p>
      </div>
      <button class="btn btn-primary" onclick="document.getElementById('v-store-select').focus()">📸 New Store Visit</button>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1.6fr; gap: 20px;">
      <!-- Store Visit Form -->
      <div class="card-white">
        <h3 style="font-size: 1.1rem; margin-bottom: 14px;">🏪 New Store Visit Submission</h3>
        
        <form id="store-visit-form">
          <div class="form-group">
            <label class="form-label">Select Retailer / Store *</label>
            <select id="v-store-select" class="form-select" required>
              ${parties.map(p => `<option value="${p.shopName}" data-addr="${p.address}">${p.shopName} (${p.name})</option>`).join('')}
              <option value="Kumar Mobile Point" data-addr="Atta Market, Sector 18, Noida">Kumar Mobile Point (Atta Market)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Location (Auto-captured)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="v-location" class="form-input" value="Shop 12, Atta Market, Sector 18, Noida - 201301">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-change-gps">Get GPS</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Store Photos (Required) *</label>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;" id="photos-thumbnail-row">
              <img src="https://images.unsplash.com/photo-1555421689-d68471e189f2?w=150" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-light);" id="preview-photo-1">
              <img src="https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=150" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-light);" id="preview-photo-2">
              <div id="add-photo-trigger" style="width: 60px; height: 60px; border-radius: 8px; border: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.5rem; cursor: pointer;" title="Attach photo from file or camera">+</div>
            </div>
            <input type="file" id="real-photo-input" accept="image/*" style="display: none;">
          </div>

          <div class="form-group">
            <label class="form-label">Collection Amount (₹ Optional if payment collected)</label>
            <input type="number" id="v-collection-amt" class="form-input" placeholder="e.g. 5000">
          </div>

          <div class="form-group">
            <label class="form-label">Meeting Notes & Stock Feedback</label>
            <textarea id="v-notes" class="form-textarea" rows="3" placeholder="Stock checked, Vivo Y200 demand high, collected ₹5000"></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 0.95rem;">
            Submit Visit
          </button>
        </form>
      </div>

      <!-- Visits List with Real Verified Checkbox -->
      <div class="card-white">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="font-size: 1.05rem;">Recent Store Submissions (${visits.length})</h3>
          <span style="font-size: 0.75rem; color: #059669; font-weight: 600;">Click checkbox to verify visit [✓]</span>
        </div>

        <table class="clean-table">
          <thead>
            <tr>
              <th style="width: 80px;">Verified</th>
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
                  <input type="checkbox" ${v.isVerified ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;" onchange="window.toggleVisitStatus('${v.id}', this.checked)">
                </td>
                <td>
                  <strong>${v.storeName}</strong>
                  <div style="font-size: 0.72rem; color: #64748b;">by ${v.staffName}</div>
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

  // Auto-fill address when store selected
  const storeSelect = document.getElementById('v-store-select') as HTMLSelectElement;
  storeSelect?.addEventListener('change', () => {
    const selected = storeSelect.options[storeSelect.selectedIndex];
    const addr = selected.getAttribute('data-addr');
    if (addr) {
      (document.getElementById('v-location') as HTMLInputElement).value = addr;
    }
  });

  // Photo upload
  let uploadedPhotoUrl = 'https://images.unsplash.com/photo-1555421689-d68471e189f2?w=500';
  const addTrigger = document.getElementById('add-photo-trigger');
  const fileInput = document.getElementById('real-photo-input') as HTMLInputElement;
  addTrigger?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        uploadedPhotoUrl = reader.result as string;
        const row = document.getElementById('photos-thumbnail-row');
        const img = document.createElement('img');
        img.src = uploadedPhotoUrl;
        img.style.cssText = 'width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 2px solid #2563eb;';
        row?.insertBefore(img, addTrigger);
        showToast('Photo attached from device!', '📸');
      };
      reader.readAsDataURL(file);
    }
  });

  // GPS Change
  document.getElementById('btn-change-gps')?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          (document.getElementById('v-location') as HTMLInputElement).value = `Sector 18, Noida GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
          showToast('Live GPS coordinates acquired!', '📍');
        },
        () => {
          (document.getElementById('v-location') as HTMLInputElement).value = 'Atta Market, Sector 18, Noida (28.5708, 77.3271)';
          showToast('Location refreshed to Sector 18 Market', '📍');
        }
      );
    }
  });

  // Submit visit
  const form = document.getElementById('store-visit-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const storeName = storeSelect.value;
    const loc = (document.getElementById('v-location') as HTMLInputElement).value;
    const notes = (document.getElementById('v-notes') as HTMLTextAreaElement).value;
    const colAmt = Number((document.getElementById('v-collection-amt') as HTMLInputElement).value) || 0;

    const newV: StoreVisit = {
      id: 'VST-' + Date.now(),
      staffId: 'STF-01',
      staffName: 'Rohit Kumar',
      storeName: storeName,
      ownerName: 'Retail Partner',
      phone: '0987654321',
      address: loc,
      latitude: 28.5708,
      longitude: 77.3271,
      photoUrl: uploadedPhotoUrl,
      visitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: true,
      notes: notes,
      collectionAmount: colAmt
    };

    await api.addStoreVisit(newV);
    showToast(`Store visit submitted for ${storeName} [✓]!`, '🎉');
    await renderStoreVisits();
  });
}

(window as any).toggleVisitStatus = async (id: string, isChecked: boolean) => {
  await api.toggleVisitVerified(id, isChecked);
  showToast(`Store visit verification updated to [${isChecked ? '✓' : '✗'}]`, '✅');
};

// ============================================================================
// 5. PARTIES / CUSTOMERS VIEW (With EDIT Option & Balance / Status Modifier)
// ============================================================================
async function renderParties() {
  const parties = await api.getParties();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Parties / Customers</h1>
        <p class="dash-subtitle">Noida retailer master directory, customer biodata, balance editor & 1-Click WhatsApp payment reminders</p>
      </div>
      <button class="btn btn-primary" id="btn-add-party-top">+ Add Party</button>
    </div>

    <div class="card-white" style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm party-filter-btn active" data-tab="all">All (${parties.length})</button>
          <button class="btn btn-secondary btn-sm party-filter-btn" data-tab="active">Active (${parties.filter(p => p.currentBalance === 0).length})</button>
          <button class="btn btn-secondary btn-sm party-filter-btn" data-tab="overdue">Overdue (${parties.filter(p => p.currentBalance > 0).length})</button>
        </div>
        <input type="text" id="party-search-input" class="form-input" placeholder="Search party by name, phone, GST..." style="width: 280px;">
      </div>

      <table class="clean-table">
        <thead>
          <tr>
            <th>Name & Shop</th>
            <th>Mobile</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th>Customer Biodata</th>
            <th style="width: 170px;">Action</th>
          </tr>
        </thead>
        <tbody id="parties-table-body">
          ${parties.map(p => `
            <tr class="party-tr" data-status="${p.currentBalance > 0 ? 'overdue' : 'active'}">
              <td>
                <strong>${p.shopName}</strong>
                <div style="font-size: 0.72rem; color: #64748b;">${p.name} • 📍 ${p.address}</div>
              </td>
              <td style="font-family: var(--font-mono);">${p.phone}</td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: ${p.currentBalance > 0 ? '#ef4444' : '#059669'};">
                ${formatCurrency(p.currentBalance)}
              </td>
              <td>
                <span class="status-pill ${p.currentBalance > 0 ? 'status-overdue' : 'status-present'}">
                  ${p.currentBalance > 0 ? (p.duePaymentDate || 'Overdue') : 'Paid / Clean'}
                </span>
              </td>
              <td style="max-width: 240px; font-size: 0.75rem; color: #475569; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${p.biodata}
              </td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-secondary btn-sm" onclick="window.viewPartyDetails('${p.id}')" title="View Details">View</button>
                  <button class="btn btn-secondary btn-sm" onclick="window.editPartyDetails('${p.id}')" title="Edit Retailer Details & Balance">✏️ Edit</button>
                  <button class="btn btn-whatsapp btn-sm" onclick="window.sendWhatsAppReminder('${p.phone}', '${p.name}', '${p.shopName}', ${p.currentBalance}, '${p.duePaymentDate || 'Immediate'}')" title="WhatsApp Reminder">📲</button>
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
        else if (tab === 'active' && s === 'active') (tr as HTMLElement).style.display = '';
        else (tr as HTMLElement).style.display = 'none';
      });
    });
  });

  // Search input
  document.getElementById('party-search-input')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('.party-tr').forEach(tr => {
      const text = tr.textContent?.toLowerCase() || '';
      (tr as HTMLElement).style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// ============================================================================
// 6. INVOICES & BILLING VIEW (Double-click duplicate protection & IMEI tracking)
// ============================================================================
async function renderInvoices() {
  const parties = cachedParties;
  const invoices = await api.getInvoices();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Invoice Creation</h1>
        <p class="dash-subtitle">Handset billing engine with 15-digit IMEI tracking, GST 18%, and printable receipt</p>
      </div>
      <button class="btn btn-secondary" onclick="window.previewInvoice('${invoices[0]?.id || 'INV-2026-0156'}')">👁️ Preview Sample Bill</button>
    </div>

    <!-- Screen 5: Invoice Creation Form -->
    <div class="card-white" style="margin-bottom: 24px;">
      <h3 style="font-size: 1.05rem; margin-bottom: 14px;">Invoices ➔ Create Invoice</h3>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer / Retailer *</label>
          <select id="inv-cust-select" class="form-select">
            ${parties.map(p => `<option value="${p.id}" data-name="${p.name}" data-shop="${p.shopName}" data-phone="${p.phone}" data-address="${p.address}">${p.shopName} (${p.name}) - Balance: ${formatCurrency(p.currentBalance)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Date *</label>
          <input type="text" class="form-input" value="11 Oct 2026" id="inv-date-input">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode</label>
          <select id="inv-mode-select" class="form-select">
            <option value="UPI">UPI Payment</option>
            <option value="CASH">Cash</option>
            <option value="SPLIT">Split (UPI + Cash)</option>
            <option value="CREDIT">Credit (On Account)</option>
          </select>
        </div>
      </div>

      <!-- Items Table with 15-digit IMEI tracking -->
      <table class="clean-table" style="margin: 16px 0;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>Product Description</th>
            <th style="width: 190px;">15-Digit IMEI No.</th>
            <th style="width: 90px;">Qty</th>
            <th style="width: 120px;">Rate (₹)</th>
            <th style="width: 120px; text-align: right;">Amount</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody id="invoice-items-tbody">
          <tr class="inv-row">
            <td><input type="text" class="form-input item-desc" value="Vivo Y200 5G (8GB/128GB)"></td>
            <td><input type="text" class="form-input item-imei" value="864201051234567" maxlength="15" style="font-family: var(--font-mono); font-size: 0.78rem;"></td>
            <td><input type="number" class="form-input item-qty" value="1" min="1"></td>
            <td><input type="number" class="form-input item-rate" value="21999" min="1"></td>
            <td style="text-align: right; font-weight: 700;" class="item-amt">₹ 21,999</td>
            <td><button class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); window.recalcInvoice();">✕</button></td>
          </tr>
          <tr class="inv-row">
            <td><input type="text" class="form-input item-desc" value="Screen Guard 11D Premium"></td>
            <td><input type="text" class="form-input item-imei" value="N/A" style="font-family: var(--font-mono); font-size: 0.78rem;"></td>
            <td><input type="number" class="form-input item-qty" value="20" min="1"></td>
            <td><input type="number" class="form-input item-rate" value="50" min="1"></td>
            <td style="text-align: right; font-weight: 700;" class="item-amt">₹ 1,000</td>
            <td><button class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); window.recalcInvoice();">✕</button></td>
          </tr>
        </tbody>
      </table>

      <button class="btn btn-secondary btn-sm" id="btn-add-item-row" style="margin-bottom: 16px;">+ Add Product Item</button>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end;">
        <div style="width: 280px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Subtotal</span>
            <strong id="inv-subtotal-val">₹ 22,999</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
            <span>GST (18%)</span>
            <span id="inv-gst-val">₹ 4,139</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 1px solid var(--border-light); padding-top: 8px;">
            <span>Total</span>
            <span style="color: #2563eb;" id="inv-total-val">₹ 27,138</span>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" id="btn-save-invoice" style="padding: 10px 24px;">💾 Save & Generate Invoice</button>
      </div>
    </div>

    <!-- Recent Invoices Register Table -->
    <div class="card-white">
      <h3 style="font-size: 1.05rem; margin-bottom: 14px;">Invoices Register (${invoices.length})</h3>
      <table class="clean-table">
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total Amount</th>
            <th>Payment Mode</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => `
            <tr>
              <td><strong style="font-family: var(--font-mono); color: #2563eb;">${inv.invoiceNumber}</strong></td>
              <td>${inv.date}</td>
              <td>
                <strong>${inv.shopName}</strong>
                <div style="font-size: 0.72rem; color: #64748b;">${inv.customerName}</div>
              </td>
              <td>${inv.items?.length || 1} items</td>
              <td style="font-weight: 700; font-family: var(--font-mono);">${formatCurrency(inv.totalAmount)}</td>
              <td><span class="status-pill status-present">${inv.paymentMode}</span></td>
              <td>
                <span class="status-pill ${inv.status === 'paid' ? 'status-present' : 'status-overdue'}">
                  ${inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="window.previewInvoice('${inv.id}')">👁️ View Receipt</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Item additions & calculations
  const tbody = document.getElementById('invoice-items-tbody');
  document.getElementById('btn-add-item-row')?.addEventListener('click', () => {
    const tr = document.createElement('tr');
    tr.className = 'inv-row';
    tr.innerHTML = `
      <td><input type="text" class="form-input item-desc" placeholder="Product name" value="Fast Charger 65W Type-C"></td>
      <td><input type="text" class="form-input item-imei" value="N/A" style="font-family: var(--font-mono); font-size: 0.78rem;"></td>
      <td><input type="number" class="form-input item-qty" value="5" min="1"></td>
      <td><input type="number" class="form-input item-rate" value="450" min="1"></td>
      <td style="text-align: right; font-weight: 700;" class="item-amt">₹ 2,250</td>
      <td><button class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); window.recalcInvoice();">✕</button></td>
    `;
    tbody?.appendChild(tr);
    (window as any).recalcInvoice();
  });

  tbody?.addEventListener('input', () => {
    (window as any).recalcInvoice();
  });

  (window as any).recalcInvoice();

  // Save invoice action with double-click prevention
  const saveBtn = document.getElementById('btn-save-invoice') as HTMLButtonElement;
  saveBtn?.addEventListener('click', async () => {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Invoice...';

    const select = document.getElementById('inv-cust-select') as HTMLSelectElement;
    const selectedOption = select.options[select.selectedIndex];
    const customerId = select.value;
    const customerName = selectedOption.getAttribute('data-name') || 'Customer';
    const shopName = selectedOption.getAttribute('data-shop') || 'Shop';
    const customerPhone = selectedOption.getAttribute('data-phone') || '0987654321';
    const invoiceDate = (document.getElementById('inv-date-input') as HTMLInputElement).value || '11 Oct 2026';
    const mode = (document.getElementById('inv-mode-select') as HTMLSelectElement).value as any;

    const items: InvoiceItem[] = [];
    document.querySelectorAll('.inv-row').forEach((row, i) => {
      const desc = (row.querySelector('.item-desc') as HTMLInputElement)?.value || `Product ${i + 1}`;
      const imei = (row.querySelector('.item-imei') as HTMLInputElement)?.value || 'N/A';
      const qty = Number((row.querySelector('.item-qty') as HTMLInputElement)?.value) || 1;
      const rate = Number((row.querySelector('.item-rate') as HTMLInputElement)?.value) || 100;
      items.push({
        id: 'ITM-' + Date.now() + '-' + i,
        description: desc,
        imeiNumber: imei,
        quantity: qty,
        rate: rate,
        amount: qty * rate
      });
    });

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const gst = subtotal * 0.18;
    const grandTotal = subtotal + gst;
    const isCredit = mode === 'CREDIT';
    const paidAmt = isCredit ? 0 : grandTotal;
    const balanceAmt = grandTotal - paidAmt;

    const newInvoice: Invoice = {
      id: 'INV-2026-0' + Math.floor(160 + Math.random() * 800),
      invoiceNumber: 'INV-2026-0' + Math.floor(160 + Math.random() * 800),
      customerId: customerId,
      customerName: customerName,
      shopName: shopName,
      customerPhone: customerPhone,
      date: invoiceDate,
      items: items,
      subtotal: subtotal,
      gstPercent: 18,
      gstAmount: gst,
      totalAmount: grandTotal,
      paidAmount: paidAmt,
      balanceAmount: balanceAmt,
      paymentMode: mode,
      status: isCredit ? 'unpaid' : 'paid'
    };

    await api.createInvoice(newInvoice);
    showToast(`Invoice ${newInvoice.invoiceNumber} created & customer ledger updated!`, '🧾');
    await renderInvoices();
    (window as any).previewInvoice(newInvoice.id);
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

// ============================================================================
// 7. COLLECTIONS VIEW
// ============================================================================
async function renderCollections() {
  const payments = await api.getPayments();

  const totalCollection = payments.reduce((sum, p) => sum + p.amount, 0);
  const upiCollection = payments.filter(p => p.paymentMode === 'UPI').reduce((sum, p) => sum + p.amount, 0);
  const cashCollection = payments.filter(p => p.paymentMode === 'CASH').reduce((sum, p) => sum + p.amount, 0);

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Collections</h1>
        <p class="dash-subtitle">Track all field payment receipts, UPI reconciliation, and cash in hand</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary btn-sm">📅 01 Oct 2026 - 11 Oct 2026</button>
        <button class="btn btn-primary btn-sm" onclick="window.exportCollectionsCSV()">📥 Export Collections CSV</button>
      </div>
    </div>

    <!-- 3 Collection KPI Cards -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px;">
      <div class="kpi-card-white">
        <div class="kpi-label">Total Collection</div>
        <div class="kpi-num" style="color: #0f172a; margin-top: 4px;">${formatCurrency(totalCollection)}</div>
      </div>
      <div class="kpi-card-white">
        <div class="kpi-label">UPI Collection (Online)</div>
        <div class="kpi-num" style="color: #2563eb; margin-top: 4px;">${formatCurrency(upiCollection)}</div>
      </div>
      <div class="kpi-card-white">
        <div class="kpi-label">Cash Collection (In Hand)</div>
        <div class="kpi-num" style="color: #d97706; margin-top: 4px;">${formatCurrency(cashCollection)}</div>
      </div>
    </div>

    <!-- Payments Table -->
    <div class="card-white">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm pay-filter-btn active" data-type="all">All (${payments.length})</button>
          <button class="btn btn-secondary btn-sm pay-filter-btn" data-type="UPI">UPI (${payments.filter(p => p.paymentMode === 'UPI').length})</button>
          <button class="btn btn-secondary btn-sm pay-filter-btn" data-type="CASH">Cash (${payments.filter(p => p.paymentMode === 'CASH').length})</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.openDirectPaymentModal()">+ Record New Payment</button>
      </div>

      <table class="clean-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Party / Retailer</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Reference / UTR</th>
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

// ============================================================================
// 8. REPORTS VIEW
// ============================================================================
async function renderReports() {
  const visits = await api.getStoreVisits();
  const payments = await api.getPayments();
  const upiTotal = payments.filter(p => p.paymentMode === 'UPI').reduce((sum, p) => sum + p.amount, 0);
  const cashTotal = payments.filter(p => p.paymentMode === 'CASH').reduce((sum, p) => sum + p.amount, 0);
  const total = upiTotal + cashTotal || 1;
  const upiPercent = ((upiTotal / total) * 100).toFixed(1);
  const cashPercent = ((cashTotal / total) * 100).toFixed(1);

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Reports & Analytics</h1>
        <p class="dash-subtitle">Noida & NCR performance audits, collection trends and field efficiency</p>
      </div>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print Executive Report</button>
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
              <td>${visits.filter(v => v.staffName.includes('Rohit')).length + 12}</td>
              <td>₹ 2,45,000</td>
              <td><span class="status-pill status-present">112%</span></td>
            </tr>
            <tr>
              <td><strong>Amit Singh</strong></td>
              <td>${visits.filter(v => v.staffName.includes('Amit')).length + 9}</td>
              <td>₹ 1,82,000</td>
              <td><span class="status-pill status-present">98%</span></td>
            </tr>
            <tr>
              <td><strong>Neha Verma</strong></td>
              <td>${visits.filter(v => v.staffName.includes('Neha')).length + 8}</td>
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
            <span>UPI / Netbanking: <strong>${upiPercent}%</strong></span>
            <span>Cash in Hand: <strong>${cashPercent}%</strong></span>
          </div>
          <div style="height: 14px; background: #e2e8f0; border-radius: 99px; overflow: hidden; display: flex;">
            <div style="background: #2563eb; width: ${upiPercent}%;"></div>
            <div style="background: #f59e0b; width: ${cashPercent}%;"></div>
          </div>
        </div>
        <p style="font-size: 0.8rem; color: #64748b;">
          Digital UPI payments account for the majority of collection in Sector 18 and Sector 62 retail hubs.
        </p>
      </div>
    </div>
  `;
}

// ============================================================================
// 9. MOBILE SCREENS SIMULATOR (Screen 8 with all 5 Dock Tabs including Collections)
// ============================================================================
function renderMobileScreens() {
  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">8. Mobile App Screens (Employee)</h1>
        <p class="dash-subtitle">Interactive phone simulator with full bottom navigation dock including Collections</p>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
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

      <!-- 5 Buttons Bottom Dock on Phone (Exact Match to User Requirement) -->
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
          <span>Visits</span>
        </button>
        <button class="phone-nav-btn" data-sub="parties">
          <span>👥</span>
          <span>Parties</span>
        </button>
        <button class="phone-nav-btn" data-sub="collections">
          <span>💰</span>
          <span>Collections</span>
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

async function renderSubMobileScreen(screen: string) {
  const container = document.getElementById('phone-screen-content');
  if (!container) return;

  const visits = await api.getStoreVisits();
  const parties = cachedParties;
  const payments = await api.getPayments();
  const todayPaid = payments.slice(0, 3).reduce((sum, p) => sum + p.amount, 0);

  if (screen === 'home') {
    container.innerHTML = `
      <div style="padding: 16px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.72rem; opacity: 0.85;">Welcome Back</div>
            <div style="font-size: 1.15rem; font-weight: 800;">Rohit Kumar</div>
          </div>
          <span style="font-size: 0.65rem; background: rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 99px; font-weight: 600;">🔋 92%</span>
        </div>
        <div style="font-size: 0.7rem; background: rgba(0,0,0,0.18); display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; margin-top: 8px;">
          <span>📍</span> On Duty • Sector 18, Noida
        </div>
      </div>

      <div style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <!-- Two Metric Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: white; padding: 12px; border-radius: 12px; border: 1px solid var(--border-light); text-align: center; box-shadow: var(--shadow-sm);">
            <div style="font-size: 1.5rem; font-weight: 800; color: #2563eb;">${visits.length}</div>
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Visits Logged</div>
          </div>
          <div style="background: white; padding: 12px; border-radius: 12px; border: 1px solid var(--border-light); text-align: center; box-shadow: var(--shadow-sm);">
            <div style="font-size: 1.4rem; font-weight: 800; color: #059669;">${formatCurrency(todayPaid || 25000)}</div>
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Collections</div>
          </div>
        </div>

        <!-- Quick Action Buttons -->
        <button class="btn btn-primary" onclick="window.renderSubMobileScreen('visit')" style="padding: 12px; border-radius: 10px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>📸</span> New Store Visit Check-in
        </button>
        <button class="btn btn-secondary" onclick="window.renderSubMobileScreen('attendance')" style="padding: 11px; border-radius: 10px; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>⏱️</span> Attendance & Punch
        </button>
        <button class="btn btn-secondary" onclick="window.renderSubMobileScreen('collections')" style="padding: 11px; border-radius: 10px; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>💰</span> Collect Retailer Payment
        </button>
      </div>
    `;
  } else if (screen === 'attendance') {
    container.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <div style="width: 76px; height: 76px; border-radius: 50%; background: #ecfdf5; color: #059669; font-size: 2.2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; box-shadow: 0 4px 12px rgba(16,185,129,0.2);">✓</div>
        <h3 style="font-size: 1.15rem; margin-bottom: 4px; color: #0f172a;">You Are Checked In</h3>
        <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Punch In: <strong>09:08 AM</strong></p>
        <p style="font-size: 0.75rem; color: #2563eb; margin-bottom: 22px;">📍 Sector 18, Atta Market, Noida</p>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-danger" style="padding: 13px; font-size: 0.88rem; border-radius: 10px; font-weight: 700;" onclick="window.mobileCheckOut()">
            🔴 Punch Out
          </button>
          <button class="btn btn-primary" style="padding: 13px; font-size: 0.88rem; border-radius: 10px; font-weight: 700;" onclick="window.mobileCheckIn()">
            🟢 Punch In Again
          </button>
        </div>
      </div>
    `;
  } else if (screen === 'visit') {
    container.innerHTML = `
      <div style="padding: 16px;">
        <h4 style="font-size: 0.95rem; margin-bottom: 12px; color: #0f172a;">Submit Store Visit</h4>
        <div class="form-group">
          <label class="form-label">Store</label>
          <select id="mob-store-select" class="form-select" style="font-size: 0.8rem;">
            ${parties.map(p => `<option value="${p.shopName}">${p.shopName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Location (Auto-GPS)</label>
          <input type="text" id="mob-v-loc" class="form-input" value="Atta Market, Sector 18, Noida" style="font-size: 0.8rem;">
        </div>
        <div class="form-group">
          <label class="form-label">Attached Photo</label>
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <img src="https://images.unsplash.com/photo-1555421689-d68471e189f2?w=100" style="width: 52px; height: 52px; border-radius: 8px; object-fit: cover; border: 2px solid #2563eb;">
          </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 700;" onclick="window.mobileSubmitVisit()">Submit Visit [✓]</button>
      </div>
    `;
  } else if (screen === 'parties') {
    container.innerHTML = `
      <div style="padding: 14px; overflow-y: auto;">
        <h4 style="font-size: 0.95rem; margin-bottom: 10px; color: #0f172a;">Noida Retailers (${parties.length})</h4>
        ${parties.map(p => `
          <div style="background: white; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-light); margin-bottom: 8px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 0.82rem; color: #0f172a;">${p.shopName}</strong>
              <span style="font-size: 0.78rem; font-weight: 800; color: ${p.currentBalance > 0 ? '#ef4444' : '#059669'}; font-family: var(--font-mono);">${formatCurrency(p.currentBalance)}</span>
            </div>
            <div style="font-size: 0.7rem; color: #64748b; margin: 2px 0 8px;">📍 ${p.address}</div>
            <div style="display: flex; gap: 6px;">
              <a href="tel:${p.phone}" class="btn btn-secondary btn-sm" style="flex: 1; text-align: center; text-decoration: none; font-size: 0.72rem; padding: 4px;">📞 Call</a>
              <button class="btn btn-whatsapp btn-sm" style="flex: 1; font-size: 0.72rem; padding: 4px;" onclick="window.sendWhatsAppReminder('${p.phone}', '${p.name}', '${p.shopName}', ${p.currentBalance}, '${p.duePaymentDate || 'Immediate'}')">📲 WhatsApp</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (screen === 'collections') {
    container.innerHTML = `
      <div style="padding: 16px;">
        <h4 style="font-size: 0.95rem; margin-bottom: 12px; color: #0f172a;">Collect Payment</h4>
        <div class="form-group">
          <label class="form-label">Select Retailer</label>
          <select id="mob-pay-party" class="form-select" style="font-size: 0.8rem;">
            ${parties.map(p => `<option value="${p.id}">${p.shopName} (Due: ${formatCurrency(p.currentBalance)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Collection Amount (₹)</label>
          <input type="number" id="mob-pay-amt" class="form-input" value="15000">
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 12px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('mob-pay-amt').value = '5000'">+₹5,000</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('mob-pay-amt').value = '10000'">+₹10,000</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('mob-pay-amt').value = '25000'">+₹25,000</button>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode</label>
          <select id="mob-pay-mode" class="form-select">
            <option value="UPI">UPI (Instant Online)</option>
            <option value="CASH">Cash in Hand</option>
          </select>
        </div>
        <button class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 700; margin-top: 6px;" onclick="window.mobileSubmitPayment()">Confirm & Collect</button>
      </div>
    `;
  }
}
(window as any).renderSubMobileScreen = renderSubMobileScreen;

// Mobile simulator actions
(window as any).mobileCheckIn = async () => {
  await api.recordPunchIn({
    id: 'ATT-' + Date.now(),
    staffId: 'STF-01',
    staffName: 'Rohit Kumar',
    date: '2026-10-11',
    punchInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    punchInLocation: 'Sector 18, Atta Market, Noida',
    status: 'present',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  });
  showToast('Punch in recorded in database!', '🟢');
  renderSubMobileScreen('attendance');
};

(window as any).mobileCheckOut = async () => {
  showToast('Punch out completed at ' + new Date().toLocaleTimeString(), '🔴');
  renderSubMobileScreen('attendance');
};

(window as any).mobileSubmitVisit = async () => {
  const store = (document.getElementById('mob-store-select') as HTMLSelectElement)?.value || 'Sharma Traders';
  const loc = (document.getElementById('mob-v-loc') as HTMLInputElement)?.value || 'Sector 18, Noida';
  await api.addStoreVisit({
    id: 'VST-' + Date.now(),
    staffId: 'STF-01',
    staffName: 'Rohit Kumar',
    storeName: store,
    ownerName: 'Retailer',
    phone: '0987654321',
    address: loc,
    latitude: 28.5708,
    longitude: 77.3271,
    photoUrl: 'https://images.unsplash.com/photo-1555421689-d68471e189f2?w=400',
    visitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isVerified: true,
    notes: 'Submitted via Mobile App Simulator'
  });
  showToast(`Store visit submitted for ${store} [✓]!`, '🎉');
  renderSubMobileScreen('home');
};

(window as any).mobileSubmitPayment = async () => {
  const select = document.getElementById('mob-pay-party') as HTMLSelectElement;
  const partyId = select.value;
  const party = cachedParties.find(p => p.id === partyId) || cachedParties[0];
  const amt = Number((document.getElementById('mob-pay-amt') as HTMLInputElement).value) || 10000;
  const mode = (document.getElementById('mob-pay-mode') as HTMLSelectElement).value as any;

  await api.addPayment({
    id: 'PAY-' + Date.now(),
    customerId: party.id,
    customerName: party.name,
    shopName: party.shopName,
    amount: amt,
    paymentMode: mode,
    transactionRef: 'MOB-PAY-' + Math.floor(1000 + Math.random() * 9000),
    date: '11 Oct 2026',
    collectedBy: 'Rohit Kumar',
    notes: 'Collected on mobile app'
  });

  showToast(`Payment of ₹ ${amt} saved & balance updated!`, '💰');
  renderSubMobileScreen('home');
};

// ============================================================================
// 10. DATABASE & SETTINGS VIEW (Switch storage mode, Export, Import, Reset)
// ============================================================================
async function renderBackup() {
  const json = await api.exportJson();
  const currentMode = api.getMode();

  viewContent.innerHTML = `
    <div class="dash-header-row">
      <div>
        <h1 class="dash-title">Settings & Database Migration</h1>
        <p class="dash-subtitle">Toggle between Local IndexedDB and Express Backend, export or reset database</p>
      </div>
      <button class="btn btn-danger btn-sm" id="btn-reset-demo-data">🔄 Reset to Clean Noida Demo Data</button>
    </div>

    <div style="max-width: 850px; display: flex; flex-direction: column; gap: 20px;">
      <!-- Storage Engine Toggle -->
      <div class="card-white">
        <h3 style="font-size: 1.1rem; margin-bottom: 8px;">🔄 Data Source Mode</h3>
        <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 16px;">
          Choose whether the application runs offline using browser <strong>IndexedDB</strong> or connects to the <strong>Express TypeScript API</strong> (http://localhost:5000/api).
        </p>

        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="btn ${currentMode === 'indexeddb' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-indexeddb">
            💽 IndexedDB (Local Offline)
          </button>
          <button class="btn ${currentMode === 'backend_api' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-backend">
            🌐 Express Backend API (localhost:5000)
          </button>
          <span class="badge ${currentMode === 'indexeddb' ? 'badge-primary' : 'badge-primary'}" style="margin-left: auto;">
            Active: ${currentMode === 'indexeddb' ? 'IndexedDB' : 'Backend REST API'}
          </span>
        </div>
      </div>

      <!-- Export & Import Card -->
      <div class="card-white">
        <h3 style="font-size: 1.1rem; margin-bottom: 8px;">💾 Backup, Export & Import JSON</h3>
        <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 16px;">
          Download full application snapshot or upload a JSON backup to restore all records.
        </p>

        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <button class="btn btn-primary" id="btn-export-file">📥 Download Full JSON Backup</button>
          <button class="btn btn-secondary" id="btn-trigger-import">📤 Upload & Restore JSON</button>
          <input type="file" id="import-json-file" accept=".json" style="display: none;">
        </div>

        <h4 style="font-size: 0.9rem; margin-bottom: 8px; color: #475569;">Live Database Snapshot (JSON):</h4>
        <textarea class="form-textarea" rows="8" readonly style="font-family: var(--font-mono); font-size: 0.75rem;">${json}</textarea>
      </div>
    </div>
  `;

  // Storage switcher
  document.getElementById('btn-mode-indexeddb')?.addEventListener('click', () => {
    api.setMode('indexeddb');
    showToast('Switched to IndexedDB (Offline-first)!', '💽');
    renderBackup();
  });

  document.getElementById('btn-mode-backend')?.addEventListener('click', () => {
    api.setMode('backend_api');
    showToast('Switched to Express Backend API (localhost:5000)!', '🌐');
    renderBackup();
  });

  // Export JSON
  document.getElementById('btn-export-file')?.addEventListener('click', async () => {
    const dataStr = await api.exportJson();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sam-mobile-noida-backup.json`;
    a.click();
    showToast('Backup downloaded successfully!', '📥');
  });

  // Import JSON
  const importInput = document.getElementById('import-json-file') as HTMLInputElement;
  document.getElementById('btn-trigger-import')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const success = await api.importJson(reader.result as string);
          if (success) {
            showToast('JSON database restored successfully!', '🎉');
            await renderBackup();
          } else {
            showToast('Invalid JSON file format', '⚠️');
          }
        } catch (err) {
          showToast('Failed to parse JSON file', '❌');
        }
      };
      reader.readAsText(file);
    }
  });

  // Reset to default
  document.getElementById('btn-reset-demo-data')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all data to clean initial Noida demo state?')) {
      await api.resetToDefaults();
      showToast('Database reset to fresh Noida demo state!', '🔄');
      switchView('dashboard');
    }
  });
}

// ============================================================================
// GLOBAL WINDOW HELPERS & MODALS (Including Party Edit & Live Employee Focus)
// ============================================================================
(window as any).switchView = (v: string) => switchView(v);

(window as any).focusOnEmployee = (staffId: string, name: string, lat: number, lng: number, addr?: string) => {
  selectedStaffId = staffId;

  // Highlight selected card in tracking sidebar
  document.querySelectorAll('.tracking-item-card').forEach(c => {
    (c as HTMLElement).style.border = '1px solid var(--border-light)';
    (c as HTMLElement).style.background = '#f8fafc';
  });
  const activeCard = document.getElementById(`track-card-${staffId}`);
  if (activeCard) {
    activeCard.style.border = '2px solid #2563eb';
    activeCard.style.background = '#eff6ff';
  }

  // Update floating info pill on map
  const nameEl = document.getElementById('track-agent-name');
  const gpsEl = document.getElementById('track-agent-gps');
  if (nameEl) nameEl.textContent = name;
  if (gpsEl) gpsEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (${addr || 'Noida'})`;

  // Center & zoom map
  if (activeMap) {
    activeMap.flyTo([lat, lng], 15, { duration: 1.0 });

    // Open popup for this marker
    const target = mapMarkers.find(m => m.staffId === staffId);
    if (target) {
      target.marker.openPopup();
    }
  }

  const popName = document.getElementById('popup-agent-name');
  const popSub = document.getElementById('popup-agent-sub');
  if (popName) popName.textContent = name;
  if (popSub) popSub.innerHTML = `${addr || 'Sector 18, Noida'}<br>Live GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

  showToast(`Located ${name} at ${addr || 'Noida'}!`, '📍');
};

(window as any).sendWhatsAppReminder = (phone: string, name: string, shop: string, balance: number, dueDate: string) => {
  const clean = phone.replace(/[^0-9]/g, '');
  const msg = `Namaste ${name} ji (${shop}),\n\nSAM MOBILE (Noida) ki taraf se reminder:\nApka pending balance *${formatCurrency(balance)}* hai (${dueDate}).\n\nKripya UPI karein: upi://pay?pa=9300035900@upi&pn=SAM%20MOBILE%20NOIDA&am=${balance}\n\nDhanyawad!\nSAM MOBILE Helpline: 9300035900`;
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
        <strong>Customer Biodata & Retail History:</strong>
        <p style="font-size:0.8rem; color:#334155; margin-top:4px;">${p.biodata}</p>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
        <div style="font-size:1.1rem; font-weight:700; color:${p.currentBalance > 0 ? '#ef4444' : '#059669'};">Outstanding Due: ${formatCurrency(p.currentBalance)} (${p.duePaymentDate || 'Active'})</div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="window.editPartyDetails('${p.id}')">✏️ Edit Retailer</button>
          <button class="btn btn-whatsapp" onclick="window.sendWhatsAppReminder('${p.phone}', '${p.name}', '${p.shopName}', ${p.currentBalance}, '${p.duePaymentDate || 'Immediate'}')">📲 WhatsApp</button>
        </div>
      </div>
    </div>
  `);
};

// Edit Party Modal (Exactly requested in audio)
(window as any).editPartyDetails = (id: string) => {
  const p = cachedParties.find(item => item.id === id);
  if (!p) return;
  openModal(`Edit Retailer - ${p.shopName}`, `
    <form id="form-edit-party" onsubmit="event.preventDefault(); window.saveEditedParty('${p.id}');">
      <div class="form-group">
        <label class="form-label">Shop / Party Name *</label>
        <input type="text" id="ep-shop" class="form-input" required value="${p.shopName}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Owner Name *</label>
          <input type="text" id="ep-name" class="form-input" required value="${p.name}">
        </div>
        <div class="form-group">
          <label class="form-label">Mobile Number *</label>
          <input type="text" id="ep-phone" class="form-input" required value="${p.phone}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address in Noida / NCR *</label>
        <input type="text" id="ep-addr" class="form-input" required value="${p.address}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Outstanding Balance (₹) *</label>
          <input type="number" id="ep-bal" class="form-input" value="${p.currentBalance}">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Status *</label>
          <select id="ep-status" class="form-select">
            <option value="Paid" ${p.currentBalance === 0 || p.duePaymentDate === 'Paid' ? 'selected' : ''}>Paid / Clean</option>
            <option value="Due tomorrow" ${p.duePaymentDate === 'Due tomorrow' ? 'selected' : ''}>Due tomorrow</option>
            <option value="3 days overdue" ${p.duePaymentDate === '3 days overdue' ? 'selected' : ''}>3 days overdue</option>
            <option value="5 days overdue" ${p.duePaymentDate === '5 days overdue' ? 'selected' : ''}>5 days overdue</option>
            <option value="7 days overdue" ${p.duePaymentDate === '7 days overdue' ? 'selected' : ''}>7 days overdue</option>
            <option value="Active" ${p.duePaymentDate === 'Active' ? 'selected' : ''}>Active</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Credit Limit (₹)</label>
        <input type="number" id="ep-limit" class="form-input" value="${p.creditLimit}">
      </div>
      <div class="form-group">
        <label class="form-label">Customer Biodata & Retail History</label>
        <textarea id="ep-bio" class="form-textarea" rows="2">${p.biodata}</textarea>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click();">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `);
};

(window as any).saveEditedParty = async (id: string) => {
  const p = cachedParties.find(item => item.id === id);
  if (!p) return;
  const newBal = Number((document.getElementById('ep-bal') as HTMLInputElement).value) || 0;
  const newStatus = (document.getElementById('ep-status') as HTMLSelectElement).value;

  const updated: CustomerParty = {
    ...p,
    shopName: (document.getElementById('ep-shop') as HTMLInputElement).value,
    name: (document.getElementById('ep-name') as HTMLInputElement).value,
    phone: (document.getElementById('ep-phone') as HTMLInputElement).value,
    address: (document.getElementById('ep-addr') as HTMLInputElement).value,
    currentBalance: newBal,
    duePaymentDate: newBal === 0 ? 'Paid' : newStatus,
    creditLimit: Number((document.getElementById('ep-limit') as HTMLInputElement).value) || p.creditLimit,
    biodata: (document.getElementById('ep-bio') as HTMLTextAreaElement).value
  };

  await api.updateParty(updated);
  closeModal();
  showToast(`Party ${updated.shopName} updated successfully!`, '✏️');
  await renderParties();
};

(window as any).previewPhoto = (url: string, title: string) => {
  openModal(`📸 Photo - ${title}`, `<div style="text-align: center;"><img src="${url}" style="max-width: 100%; max-height: 70vh; border-radius: 10px;"></div>`);
};

(window as any).previewInvoice = async (invoiceId: string) => {
  const invoices = await api.getInvoices();
  const inv = invoices.find(i => i.id === invoiceId) || invoices[0];
  if (!inv) return;

  const html = `
    <div style="background: white; color: #0f172a; padding: 24px; font-size: 0.85rem;" id="invoice-sheet">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 14px;">
        <div>
          <h2 style="font-size: 1.4rem; color: #2563eb; margin-bottom: 2px;">SAM MOBILE</h2>
          <div style="font-size: 0.78rem; color: #64748b;">Mobile Handset Distributor • Sector 18, Noida - 201301</div>
          <div style="font-size: 0.75rem; color: #64748b;">GSTIN: 09ABCD1234F1Z5 • Helpline: 9300035900</div>
        </div>
        <div style="text-align: right;">
          <h3 style="font-size: 1.1rem; color: #0f172a;">TAX INVOICE</h3>
          <div style="font-size: 0.8rem; color: #64748b;">Invoice No: <strong>${inv.invoiceNumber}</strong></div>
          <div style="font-size: 0.8rem; color: #64748b;">Date: ${inv.date}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">BILL TO (RETAILER):</div>
        <div style="font-weight: 700; font-size: 0.95rem;">${inv.shopName} (${inv.customerName})</div>
        <div style="font-size: 0.8rem; color: #475569;">Sector 18 / Noida NCR • Phone: ${inv.customerPhone}</div>
      </div>

      <table class="clean-table" style="margin-bottom: 16px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>#</th>
            <th>Product Description</th>
            <th>IMEI Number</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${(inv.items || []).map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${item.description}</strong></td>
              <td style="font-family: var(--font-mono); font-size: 0.75rem;">${item.imeiNumber || 'N/A'}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatCurrency(item.rate)}</td>
              <td style="text-align: right; font-weight: 700;">${formatCurrency(item.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
        <div style="width: 250px; font-size: 0.82rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Subtotal</span>
            <span>${formatCurrency(inv.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #64748b;">
            <span>GST (18%)</span>
            <span>${formatCurrency(inv.gstAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; border-top: 2px solid #e2e8f0; padding-top: 6px;">
            <span>Total Payable</span>
            <span style="color: #2563eb;">${formatCurrency(inv.totalAmount)}</span>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 12px; align-items: center;">
        <span style="font-size: 0.75rem; color: #64748b;">Payment Mode: <strong>${inv.paymentMode}</strong> • Verified Tax Invoice</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Bill</button>
          <button class="btn btn-whatsapp btn-sm" onclick="window.sendWhatsAppReminder('${inv.customerPhone}', '${inv.customerName}', '${inv.shopName}', ${inv.totalAmount}, 'Immediate')">📲 Share via WhatsApp</button>
        </div>
      </div>
    </div>
  `;

  openModal(`Invoice Preview - ${inv.invoiceNumber}`, html);
};

(window as any).viewEmployeeAttendanceDetail = (name: string, checkIn: string, loc: string, status: string) => {
  openModal(`Attendance Details - ${name}`, `
    <div style="padding: 10px;">
      <h4 style="font-size: 1.1rem;">${name}</h4>
      <p style="color: #64748b; font-size: 0.85rem; margin: 4px 0 14px;">Punch Location: 📍 ${loc}</p>
      <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Check-in Time:</span>
          <strong>${checkIn}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Status:</span>
          <span class="status-pill ${status === 'present' ? 'status-present' : 'status-absent'}">${status.toUpperCase()}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Zone:</span>
          <strong>Noida & NCR Field Distribution</strong>
        </div>
      </div>
    </div>
  `);
};

(window as any).exportAttendanceCSV = async () => {
  const records = await api.getAttendance('all');
  let csv = "Employee,Date,Check-in,Check-out,Location,Status\n";
  records.forEach(r => {
    csv += `"${r.staffName}","${r.date}","${r.punchInTime}","${r.punchOutTime || ''}","${r.punchInLocation}","${r.status}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sam-mobile-noida-attendance.csv';
  a.click();
  showToast('Attendance CSV exported!', '📥');
};

(window as any).exportCollectionsCSV = async () => {
  const payments = await api.getPayments();
  let csv = "Date,Party,Amount,Type,Reference,CollectedBy\n";
  payments.forEach(p => {
    csv += `"${p.date}","${p.shopName}",${p.amount},"${p.paymentMode}","${p.transactionRef}","${p.collectedBy}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sam-mobile-noida-collections.csv';
  a.click();
  showToast('Collections CSV exported!', '📥');
};

function openQuickPunchModal() {
  openModal('⏱️ Quick Punch Action', `
    <form onsubmit="event.preventDefault(); window.submitQuickPunch();" style="padding: 10px;">
      <div class="form-group">
        <label class="form-label">Select Employee *</label>
        <select class="form-select" id="qp-emp">
          ${cachedStaff.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Punch Type *</label>
        <select class="form-select" id="qp-type">
          <option value="in">🟢 Check In (Punch In)</option>
          <option value="out">🔴 Check Out (Punch Out)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Location</label>
        <input type="text" id="qp-loc" class="form-input" value="Sector 18, Atta Market, Noida">
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; margin-top: 8px;">Save Attendance Punch</button>
    </form>
  `);
}

(window as any).submitQuickPunch = async () => {
  const empSelect = document.getElementById('qp-emp') as HTMLSelectElement;
  const staffId = empSelect.value;
  const staffName = empSelect.options[empSelect.selectedIndex].getAttribute('data-name') || 'Staff';
  const type = (document.getElementById('qp-type') as HTMLSelectElement).value;
  const loc = (document.getElementById('qp-loc') as HTMLInputElement).value || 'Sector 18, Noida';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (type === 'in') {
    await api.recordPunchIn({
      id: 'ATT-' + Date.now(),
      staffId: staffId,
      staffName: staffName,
      date: '2026-10-11',
      punchInTime: time,
      punchInLocation: loc,
      status: 'present',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    });
    showToast(`Punch In recorded for ${staffName}!`, '🟢');
  } else {
    const records = await api.getAttendance('all');
    const existing = records.find(r => r.staffId === staffId);
    if (existing) {
      await api.recordPunchOut(existing.id, time, loc);
      showToast(`Punch Out recorded for ${staffName}!`, '🔴');
    } else {
      showToast(`No active check-in found for ${staffName}`, '⚠️');
    }
  }

  closeModal();
  await renderAttendance();
};

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
        <label class="form-label">Address in Noida / NCR *</label>
        <input type="text" id="np-addr" class="form-input" required placeholder="Shop 15, Sector 18, Noida">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Initial Balance (₹)</label>
          <input type="number" id="np-bal" class="form-input" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">Credit Limit (₹)</label>
          <input type="number" id="np-limit" class="form-input" value="100000">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Customer Biodata & Retail History *</label>
        <textarea id="np-bio" class="form-textarea" rows="2" placeholder="Credit history, preferred payment mode, daily stock demand..."></textarea>
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
    address: (document.getElementById('np-addr') as HTMLInputElement).value || 'Sector 18, Noida',
    biodata: (document.getElementById('np-bio') as HTMLTextAreaElement).value,
    creditLimit: Number((document.getElementById('np-limit') as HTMLInputElement).value) || 100000,
    currentBalance: Number((document.getElementById('np-bal') as HTMLInputElement).value) || 0,
    duePaymentDate: 'Active',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'
  };
  await api.addParty(newParty);
  closeModal();
  showToast(`Party ${newParty.shopName} added successfully!`, '👤');
  await renderParties();
};

(window as any).openDirectPaymentModal = () => {
  openModal('💰 Record Collection (UPI or Cash)', `
    <form onsubmit="event.preventDefault(); window.submitDirectPayment();">
      <div class="form-group">
        <label class="form-label">Select Party *</label>
        <select class="form-select" id="dp-party">
          ${cachedParties.map(p => `<option value="${p.id}">${p.shopName} (${p.name}) - Due: ${formatCurrency(p.currentBalance)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹) *</label>
          <input type="number" id="dp-amt" class="form-input" value="25000" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label">Mode *</label>
          <select id="dp-mode" class="form-select">
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Transaction / UTR Reference</label>
        <input type="text" id="dp-ref" class="form-input" value="UTR${Math.floor(10000000 + Math.random() * 90000000)}">
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px;">Save Collection</button>
    </form>
  `);
};

(window as any).submitDirectPayment = async () => {
  const partySelect = document.getElementById('dp-party') as HTMLSelectElement;
  const partyId = partySelect.value;
  const party = cachedParties.find(p => p.id === partyId) || cachedParties[0];
  const amt = Number((document.getElementById('dp-amt') as HTMLInputElement).value) || 25000;
  const mode = (document.getElementById('dp-mode') as HTMLSelectElement).value as any;
  const ref = (document.getElementById('dp-ref') as HTMLInputElement).value || 'UTR' + Date.now();

  await api.addPayment({
    id: 'PAY-' + Date.now(),
    customerId: party.id,
    customerName: party.name,
    shopName: party.shopName,
    amount: amt,
    paymentMode: mode,
    transactionRef: ref,
    date: '11 Oct 2026',
    collectedBy: 'Rohit Kumar',
    notes: 'Direct collection receipt'
  });

  closeModal();
  showToast(`Collection of ${formatCurrency(amt)} recorded & ledger updated!`, '💰');
  await renderCollections();
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
        <div class="search-dropdown-item" onclick="window.switchView('tracking'); window.focusOnEmployee('${s.id}', '${s.name}', 28.5708, 77.3271, 'Sector 18, Noida'); document.getElementById('search-results-dropdown').classList.add('hidden');">
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
          <div>Zone: <strong>Noida & NCR Handset Operations</strong></div>
          <div>Head Office: <strong>Sector 18, Noida - 201301</strong></div>
          <div>Contact: <strong>9300035900</strong></div>
          <div>Field Team: <strong>6 Active Field Sales Agents</strong></div>
        </div>
      </div>
    `);
  });

  document.getElementById('help-btn')?.addEventListener('click', () => {
    openModal('ℹ️ SAM MOBILE Help & User Guide', `
      <div style="font-size: 0.85rem; line-height: 1.5;">
        <h4 style="color: #2563eb; margin-bottom: 8px;">SAM MOBILE Field Sales & Distribution ERP</h4>
        <p style="color: #64748b; margin-bottom: 12px;">This platform manages on-ground sales executives, live GPS tracking, store visit verification, customer party biodata, handset billing with IMEI numbers, and collection reconciliation.</p>
        <ul style="padding-left: 20px; color: #334155;">
          <li><strong>Attendance:</strong> Quick punch in/out with live time & location.</li>
          <li><strong>Live Tracking:</strong> Real-time map with satellite layer and route paths.</li>
          <li><strong>Store Visits:</strong> Camera photo attachments and verified visit checkboxes.</li>
          <li><strong>Parties / CRM:</strong> 1-Click WhatsApp payment reminders with pre-filled UPI links.</li>
          <li><strong>Invoices:</strong> Billing engine with 15-digit IMEI tracking and GST 18%.</li>
          <li><strong>Collections:</strong> UPI vs Cash real-time registers.</li>
          <li><strong>Settings:</strong> Offline IndexedDB and Express Backend sync.</li>
        </ul>
      </div>
    `);
  });

  setupGlobalSearch();
  switchView('dashboard');
}

window.addEventListener('DOMContentLoaded', initApp);
