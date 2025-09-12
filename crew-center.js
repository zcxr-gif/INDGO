document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- Notification Function ---
    function showNotification(message, type) {
        Toastify({ text: message, duration: 3000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "#28a745" : type === 'error' ? "#dc3545" : "#001B94" } }).showToast();
    }

    // --- DOM Elements ---
    const pilotNameElem = document.getElementById('pilot-name');
    const pilotCallsignElem = document.getElementById('pilot-callsign');
    const profilePictureElem = document.getElementById('profile-picture');
    const logoutButton = document.getElementById('logout-button');
    const mainContentContainer = document.querySelector('.main-content');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');

    // --- Sidebar Toggle Logic ---
    const sidebarState = localStorage.getItem('sidebarState');
    if (sidebarState === 'collapsed') {
        dashboardContainer.classList.add('sidebar-collapsed');
    }
    sidebarToggleBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-collapsed');
        if (dashboardContainer.classList.contains('sidebar-collapsed')) {
            localStorage.setItem('sidebarState', 'collapsed');
        } else {
            localStorage.setItem('sidebarState', 'expanded');
        }
    });

    // --- Authentication Check ---
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- Core Data Fetching ---
    const fetchPilotData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                throw new Error('Session invalid. Please log in again.');
            }
            const pilot = await response.json();
            
            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            profilePictureElem.src = pilot.imageUrl || 'images/default-avatar.png';

            await renderAllViews(pilot);
        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };

    // --- Helper function to create stats card ---
    const createStatsCardHTML = (pilot) => {
        return `
        <div class="content-card">
            <h2><i class="fa-solid fa-chart-line"></i> Pilot Stats</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <strong>Rank</strong>
                    <span>${pilot.rank || '---'}</span>
                </div>
                <div class="stat-item">
                    <strong>Flight Hours</strong>
                    <span>${(pilot.flightHours || 0).toFixed(1)}</span>
                </div>
            </div>
        </div>
        `;
    };

    // --- UI Rendering Logic ---
    const renderAllViews = async (pilot) => {
        if (pilot.dutyStatus === 'ON_DUTY') {
            await renderOnDutyViews(pilot);
        } else {
            await renderOnRestViews(pilot);
        }
        await fetchAndDisplayRosters(); // UPDATED to use the new personalized endpoint
        await fetchPirepHistory();
    };

    const renderOnRestViews = async (pilot) => {
        const dutyStatusView = document.getElementById('view-duty-status');
        const filePirepView = document.getElementById('view-file-pirep');
        
        dutyStatusView.innerHTML = `
            <div class="content-card">
                <h2><i class="fa-solid fa-plane-departure"></i> Duty Status: 🔴 On Rest</h2>
                <p>You are currently on crew rest. To begin your next duty, please select an available flight roster from the Sector Ops page.</p>
            </div>
            ${createStatsCardHTML(pilot)}`;

        filePirepView.innerHTML = `
            <div class="content-card">
                 <h2><i class="fa-solid fa-file-signature"></i> File PIREP</h2>
                 <p>You must be on duty and have completed a flight from your assigned roster to file a PIREP.</p>
            </div>`;
    };

    const renderOnDutyViews = async (pilot) => {
        const dutyStatusView = document.getElementById('view-duty-status');
        const filePirepView = document.getElementById('view-file-pirep');
        
        try {
            const [rosterRes, pirepsRes] = await Promise.all([
                // Fetching all rosters to find the current one is still okay here.
                fetch(`${API_BASE_URL}/api/rosters`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!rosterRes.ok || !pirepsRes.ok) throw new Error('Could not load duty details.');
            
            const [allRosters, allPireps] = await Promise.all([rosterRes.json(), pirepsRes.json()]);
            const currentRoster = allRosters.find(r => r._id === pilot.currentRoster);
            if (!currentRoster) throw new Error('Could not find your assigned roster.');

            const filedPirepsForRoster = allPireps.filter(p => p.rosterLeg?.rosterId === currentRoster._id);
            const filedFlightNumbers = new Set(filedPirepsForRoster.map(p => p.flightNumber));

            dutyStatusView.innerHTML = `
                <div class="content-card">
                    <div class="on-duty-header">
                        <h2>🟢 On Duty: ${currentRoster.name}</h2>
                        <button id="end-duty-btn" class="end-duty-btn">Complete Duty Day</button>
                    </div>
                    <div class="roster-checklist">
                        ${currentRoster.legs.map(leg => {
                            const isCompleted = filedFlightNumbers.has(leg.flightNumber);
                            return `<div class="roster-leg-item ${isCompleted ? 'completed' : ''}">
                                <span class="status-icon">${isCompleted ? '✅' : '➡️'}</span>
                                <strong class="flight-number">${leg.flightNumber}</strong>
                                <span class="route">${leg.departure} - ${leg.arrival}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            
            filePirepView.innerHTML = `
                <div class="content-card">
                    <h2><i class="fa-solid fa-file-signature"></i> File Next Flight Report (PIREP)</h2>
                    <form id="pirep-form">
                        <div class="form-group"><label for="flight-number">Flight Number</label><input type="text" id="flight-number" required></div>
                        <div class="form-group-row">
                            <div class="form-group"><label for="departure-icao">Departure (ICAO)</label><input type="text" id="departure-icao" required maxlength="4"></div>
                            <div class="form-group"><label for="arrival-icao">Arrival (ICAO)</label><input type="text" id="arrival-icao" required maxlength="4"></div>
                        </div>
                        <div class="form-group"><label for="aircraft-type">Aircraft Type</label><input type="text" id="aircraft-type" required></div>
                        <div class="form-group"><label for="flight-time">Flight Time (hours)</label><input type="number" id="flight-time" step="0.1" min="0.1" required></div>
                        <div class="form-group"><label for="remarks">Remarks (Optional)</label><textarea id="remarks" rows="3"></textarea></div>
                        <button type="submit" class="cta-button">File Report</button>
                    </form>
                </div>`;

        } catch (error) {
            dutyStatusView.innerHTML = `<div class="content-card"><p class="error-text">${error.message}</p></div>`;
        }
    };
    
    // --- *** UPDATED DATA FETCHER FOR ROSTERS *** ---
    const fetchAndDisplayRosters = async () => {
        const container = document.getElementById('roster-list-container');
        const header = document.getElementById('roster-list-header');
        try {
            // **CHANGE**: Call the new personalized endpoint
            const response = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch personalized rosters.');
            
            const data = await response.json();
            const rosters = data.rosters; // The rosters are now in a nested object
            const criteria = data.searchCriteria;

            // **NEW**: Dynamically update the header text
            if (criteria.searched.length > 0) {
                header.innerHTML = `Showing rosters based on your location at: <strong>${criteria.searched.join(' & ')}</strong>`;
            } else {
                 header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
            }

            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available from your current location(s). Please complete a flight or check back later.</p>';
                return;
            }

            // The rest of the rendering logic remains the same
            container.innerHTML = rosters.map(roster => `
                <div class="roster-item">
                    <div class="roster-info">
                        <strong>${roster.name}</strong>
                        <small>Hub: ${roster.hub} | Total Time: ${roster.totalFlightTime.toFixed(1)} hrs</small>
                        <div class="roster-path">${roster.legs.map(l => l.departure).join(' → ')} → ${roster.legs.slice(-1)[0].arrival}</div>
                    </div>
                    
                    <div class="roster-actions">
                        <button class="details-button" data-roster-id="${roster._id}">Details</button>
                        <button class="cta-button go-on-duty-btn" data-roster-id="${roster._id}">Go On Duty</button>
                    </div>
    
                    <div class="roster-leg-details" id="details-${roster._id}">
                        <ul>
                            ${roster.legs.map(leg => `
                                <li>
                                    <span class="leg-flight-number">${leg.flightNumber} (${leg.departure} → ${leg.arrival})</span>
                                    <span class="leg-aircraft">${leg.aircraft}</span>
                                    <span class="leg-time">${leg.flightTime.toFixed(1)} hrs</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
            header.innerHTML = 'Could not load roster data.';
        }
    };

    const fetchPirepHistory = async () => {
        const container = document.getElementById('pirep-history-list');
        container.innerHTML = '<p>Loading history...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch PIREP history.');
            const pireps = await response.json();
            if (pireps.length === 0) {
                container.innerHTML = '<p>You have not filed any flight reports yet.</p>';
                return;
            }
            container.innerHTML = pireps.map(p => `
                <div class="pirep-history-item status-${p.status.toLowerCase()}">
                    <div class="pirep-info">
                        <strong>${p.flightNumber}</strong> (${p.departure} - ${p.arrival})
                        <small>${new Date(p.createdAt).toLocaleDateString()}</small>
                    </div>
                    <div class="pirep-details">
                        <span>${p.aircraft}</span>
                        <span>${p.flightTime.toFixed(1)} hrs</span>
                        <span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    };
    
    // --- Event Listeners ---
    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();
        sidebarNav.querySelector('.nav-link.active').classList.remove('active');
        link.classList.add('active');
        const viewId = link.dataset.view;
        mainContentContainer.querySelector('.content-view.active').classList.remove('active');
        document.getElementById(viewId).classList.add('active');
    });

    mainContentContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'pirep-form') {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Filing...';
            const flightData = {
                flightNumber: document.getElementById('flight-number').value.toUpperCase(),
                departure: document.getElementById('departure-icao').value.toUpperCase(),
                arrival: document.getElementById('arrival-icao').value.toUpperCase(),
                aircraft: document.getElementById('aircraft-type').value,
                flightTime: document.getElementById('flight-time').value,
                remarks: document.getElementById('remarks').value,
            };
            try {
                const response = await fetch(`${API_BASE_URL}/api/pireps`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(flightData)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to file report.');
                showNotification('Report submitted successfully!', 'success');
                fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'File Report';
            }
        }
    });

    mainContentContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('details-button')) {
            const rosterId = e.target.dataset.rosterId;
            const detailsPanel = document.getElementById(`details-${rosterId}`);
            if (detailsPanel) {
                detailsPanel.classList.toggle('visible');
                e.target.textContent = detailsPanel.classList.contains('visible') ? 'Hide' : 'Details';
            }
        }
    
        if (e.target.classList.contains('go-on-duty-btn')) {
            const rosterId = e.target.dataset.rosterId;
            e.target.disabled = true;
            e.target.textContent = 'Starting...';
            try {
                const response = await fetch(`${API_BASE_URL}/api/duty/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ rosterId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to start duty.');
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                document.querySelectorAll(`.go-on-duty-btn[data-roster-id="${rosterId}"]`).forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = 'Go On Duty';
                });
            }
        }
        if (e.target.id === 'end-duty-btn') {
            e.target.disabled = true;
            e.target.textContent = 'Completing...';
            try {
                const response = await fetch(`${API_BASE_URL}/api/duty/end`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to end duty.');
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Complete Duty Day';
            }
        }
    });
    
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'info');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    });

    // --- Initial Load ---
    fetchPilotData();
});