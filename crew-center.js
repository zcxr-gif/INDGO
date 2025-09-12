document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- Notification Function (No change) ---
    function showNotification(message, type) {
        Toastify({ text: message, duration: 3000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: type === 'success' ? "#28a745" : type === 'error' ? "#dc3545" : "#001B94" } }).showToast();
    }

    // --- DOM Elements ---
    const pilotNameElem = document.getElementById('pilot-name');
    const pilotCallsignElem = document.getElementById('pilot-callsign');
    const pilotRankElem = document.getElementById('pilot-rank');
    const flightHoursElem = document.getElementById('flight-hours');
    const profilePictureElem = document.getElementById('profile-picture');
    const logoutButton = document.getElementById('logout-button');
    const mainContentContainer = document.querySelector('.main-content');
    const sidebarNav = document.querySelector('.sidebar-nav');

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
            
            // 1. Populate sidebar profile (always visible)
            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            pilotRankElem.textContent = pilot.rank || 'N/A';
            flightHoursElem.textContent = (pilot.flightHours || 0).toFixed(1);
            profilePictureElem.src = pilot.imageUrl || 'images/default-avatar.png';

            // 2. Render the content views based on duty status
            await renderAllViews(pilot);

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };

    // --- UI Rendering Logic ---
    const renderAllViews = async (pilot) => {
        // Render content for each view, which will be shown/hidden by the navigation logic
        if (pilot.dutyStatus === 'ON_DUTY') {
            await renderOnDutyViews(pilot);
        } else {
            await renderOnRestViews();
        }
        // Always render these
        await fetchAndDisplayRosters();
        await fetchPirepHistory();
    };

    const renderOnRestViews = async () => {
        const dutyStatusView = document.getElementById('view-duty-status');
        const filePirepView = document.getElementById('view-file-pirep');
        
        dutyStatusView.innerHTML = `
            <div class="content-card">
                <h2><i class="fa-solid fa-plane-departure"></i> Duty Status: 🔴 On Rest</h2>
                <p>You are currently on crew rest. To begin your next duty, please select an available flight roster from the Sector Ops page.</p>
            </div>`;

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
                fetch(`${API_BASE_URL}/api/rosters`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!rosterRes.ok || !pirepsRes.ok) throw new Error('Could not load duty details.');
            
            const [allRosters, allPireps] = await Promise.all([rosterRes.json(), pirepsRes.json()]);
            const currentRoster = allRosters.find(r => r._id === pilot.currentRoster);
            if (!currentRoster) throw new Error('Could not find your assigned roster.');

            const filedPirepsForRoster = allPireps.filter(p => p.rosterLeg?.rosterId === currentRoster._id);
            const filedFlightNumbers = new Set(filedPirepsForRoster.map(p => p.flightNumber));

            // Render Duty Status View
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
            
            // Render PIREP Form View
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
    
    // --- Helper Data Fetchers ---
    const fetchAndDisplayRosters = async () => {
        const container = document.getElementById('roster-list-container');
        try {
            const response = await fetch(`${API_BASE_URL}/api/rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch rosters for your location.');
            const rosters = await response.json();
            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available from your current location. Please check back later.</p>';
                return;
            }
            container.innerHTML = rosters.map(roster => `
                <div class="roster-item">
                    <div class="roster-info">
                        <strong>${roster.name}</strong>
                        <small>Hub: ${roster.hub} | Total Time: ${roster.totalFlightTime.toFixed(1)} hrs</small>
                        <div class="roster-path">${roster.legs.map(l => l.departure).join(' → ')} → ${roster.legs.slice(-1)[0].arrival}</div>
                    </div>
                    <button class="cta-button go-on-duty-btn" data-roster-id="${roster._id}">Go On Duty</button>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
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
    
    // Sidebar Navigation
    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;

        e.preventDefault();
        
        // Update active link
        sidebarNav.querySelector('.nav-link.active').classList.remove('active');
        link.classList.add('active');

        // Switch view
        const viewId = link.dataset.view;
        mainContentContainer.querySelector('.content-view.active').classList.remove('active');
        document.getElementById(viewId).classList.add('active');
    });

    // Delegated listeners for dynamic content (PIREP form, Duty buttons)
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
                fetchPilotData(); // Reload all data and views
                
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'File Report';
            }
        }
    });

    mainContentContainer.addEventListener('click', async (e) => {
        // Go On Duty
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
                await fetchPilotData(); // Reload to switch UI
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Go On Duty';
            }
        }

        // End Duty
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
                await fetchPilotData(); // Reload to switch UI
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Complete Duty Day';
            }
        }
    });
    
    // Logout
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'info');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    });

    // --- Initial Load ---
    fetchPilotData();
});