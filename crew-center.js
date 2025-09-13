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
    
    // --- NEW: MODAL DOM ELEMENTS ---
    const promotionModal = document.getElementById('promotion-modal');
    const promoRankName = document.getElementById('promo-rank-name');
    const promoHoursRequired = document.getElementById('promo-hours-required');
    const promoPerksList = document.getElementById('promo-perks-list');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');


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
    
    // --- NEW: PROMOTION MODAL LOGIC ---
    function showPromotionModal(details) {
        promoRankName.textContent = details.newRank;
        promoHoursRequired.textContent = `${details.flightHoursRequired} hrs`;
        promoPerksList.innerHTML = details.perks.map(perk => `<li>${perk}</li>`).join('');
        promotionModal.classList.add('visible');
    }
    
    function hidePromotionModal() {
        promotionModal.classList.remove('visible');
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

    // --- MODIFICATION: Helper function to generate PIREP form HTML ---
    const getPirepFormHTML = () => {
        return `
            <div class="content-card">
                <h2><i class="fa-solid fa-file-signature"></i> File Flight Report (PIREP)</h2>
                <p>File a report for any completed flight. A verification image is required. If you are on duty, the flight will be automatically matched to your current roster.</p>
                <form id="pirep-form">
                    <div class="form-group"><label for="flight-number">Flight Number</label><input type="text" id="flight-number" required></div>
                    <div class="form-group-row">
                        <div class="form-group"><label for="departure-icao">Departure (ICAO)</label><input type="text" id="departure-icao" required maxlength="4"></div>
                        <div class="form-group"><label for="arrival-icao">Arrival (ICAO)</label><input type="text" id="arrival-icao" required maxlength="4"></div>
                    </div>
                    <div class="form-group"><label for="aircraft-type">Aircraft Type</label><input type="text" id="aircraft-type" required></div>
                    <div class="form-group"><label for="flight-time">Flight Time (hours)</label><input type="number" id="flight-time" step="0.1" min="0.1" required></div>
                    <div class="form-group">
                        <label for="verification-image">Verification Image (e.g., flight summary screenshot)</label>
                        <input type="file" id="verification-image" class="file-input" accept="image/*" required>
                    </div>
                    <div class="form-group"><label for="remarks">Remarks (Optional)</label><textarea id="remarks" rows="3"></textarea></div>
                    <button type="submit" class="cta-button">File Report</button>
                </form>
            </div>`;
    };

    // --- UI Rendering Logic ---
    const renderAllViews = async (pilot) => {
        if (pilot.dutyStatus === 'ON_DUTY') {
            await renderOnDutyViews(pilot);
        } else {
            await renderOnRestViews(pilot);
        }
        await fetchAndDisplayRosters();
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

        // MODIFICATION: Always show the PIREP form
        filePirepView.innerHTML = getPirepFormHTML();
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
            
            // MODIFICATION: Always show the PIREP form
            filePirepView.innerHTML = getPirepFormHTML();

        } catch (error) {
            dutyStatusView.innerHTML = `<div class="content-card"><p class="error-text">${error.message}</p></div>`;
        }
    };
    
    const fetchAndDisplayRosters = async () => {
        const container = document.getElementById('roster-list-container');
        const header = document.getElementById('roster-list-header');
        try {
            const response = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch personalized rosters.');
            
            const data = await response.json();
            const rosters = data.rosters;
            const criteria = data.searchCriteria;

            if (criteria.searched.length > 0) {
                header.innerHTML = `Showing rosters based on your location at: <strong>${criteria.searched.join(' & ')}</strong>`;
                 // --- MAP INTEGRATION (ADDED) ---
                if (window.plotRosters) {
                    window.plotRosters(criteria.searched[0], rosters);
                }
            } else {
                 header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
            }

            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available from your current location(s). Please complete a flight or check back later.</p>';
                return;
            }

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

    // --- MODIFICATION: Updated PIREP submission to handle FormData for image upload ---
    mainContentContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'pirep-form') {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Filing...';

            const formData = new FormData();
            formData.append('flightNumber', document.getElementById('flight-number').value.toUpperCase());
            formData.append('departure', document.getElementById('departure-icao').value.toUpperCase());
            formData.append('arrival', document.getElementById('arrival-icao').value.toUpperCase());
            formData.append('aircraft', document.getElementById('aircraft-type').value);
            formData.append('flightTime', document.getElementById('flight-time').value);
            formData.append('remarks', document.getElementById('remarks').value);
            
            const imageInput = document.getElementById('verification-image');
            if (imageInput.files.length > 0) {
                formData.append('verificationImage', imageInput.files[0]);
            } else {
                showNotification('Error: You must upload a verification image.', 'error');
                btn.disabled = false;
                btn.textContent = 'File Report';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/pireps`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }, // NO Content-Type header
                    body: formData
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
                const isVisible = detailsPanel.classList.contains('visible');
                e.target.textContent = isVisible ? 'Hide' : 'Details';
                
                // --- MAP INTEGRATION (ADDED) ---
                if (isVisible) {
                    window.highlightRoster(rosterId);
                } else {
                    window.resetHighlights();
                }
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
                
                if (result.promotionDetails) {
                    showPromotionModal(result.promotionDetails);
                } else {
                    showNotification(result.message, 'success');
                }
                
                await fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Complete Duty Day';
            }
        }
    });
    
    // --- NEW: MODAL CLOSE EVENT LISTENERS ---
    modalCloseBtn.addEventListener('click', hidePromotionModal);
    modalConfirmBtn.addEventListener('click', hidePromotionModal);
    promotionModal.addEventListener('click', (e) => {
        if (e.target === promotionModal) {
            hidePromotionModal();
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