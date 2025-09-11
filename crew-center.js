document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- Notification Function (No changes) ---
    function showNotification(message, type) {
        let backgroundColor;
        switch (type) {
            case 'success':
                backgroundColor = "linear-gradient(to right, #00b09b, #96c93d)";
                break;
            case 'error':
                backgroundColor = "linear-gradient(to right, #ff5f6d, #ffc371)";
                break;
            default: // for 'info' or other types
                backgroundColor = "linear-gradient(to right, #4facfe, #00f2fe)";
                break;
        }

        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: backgroundColor,
            },
        }).showToast();
    }

    // DOM Elements
    const pilotNameElem = document.getElementById('pilot-name');
    const pilotCallsignElem = document.getElementById('pilot-callsign');
    const pilotRankElem = document.getElementById('pilot-rank');
    const flightHoursElem = document.getElementById('flight-hours');
    const profilePictureElem = document.getElementById('profile-picture');
    const pirepForm = document.getElementById('pirep-form');
    const logoutButton = document.getElementById('logout-button');
    const pirepHistoryListElem = document.getElementById('pirep-history-list');
    
    // NEW: Main content container for switching UI states
    const pilotActionsContainer = document.querySelector('.pilot-actions-container');

    // --- 1. Authentication Check ---
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- 2. Core Data Fetching & UI Rendering ---

    const fetchPilotData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                throw new Error('Session invalid. Please log in again.');
            }

            const pilot = await response.json();
            
            // Populate profile card (this is always visible)
            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            pilotRankElem.textContent = pilot.rank || 'N/A';
            flightHoursElem.textContent = (pilot.flightHours || 0).toFixed(1);
            profilePictureElem.src = pilot.imageUrl || 'default-pfp.png';

            // MODIFIED: Render UI based on pilot's duty status
            if (pilot.dutyStatus === 'ON_DUTY') {
                await renderOnDutyUI(pilot);
            } else {
                await renderOnRestUI();
            }

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };
    
    // --- 3. UI Rendering Functions ---

    // NEW: Renders the UI for a pilot who is on rest
    const renderOnRestUI = async () => {
        // NOTE: Add a new container in your crew-center.html for this content.
        pilotActionsContainer.innerHTML = `
            <section class="content-card">
                <h2>Sector Ops - Available Rosters</h2>
                <p>Select a roster to begin your duty day. You must complete all legs of a roster to finish your duty.</p>
                <div id="roster-list-container">
                    <p>Loading available rosters...</p>
                </div>
            </section>
            <section class="content-card">
                <h2>PIREP History</h2>
                <div id="pirep-history-list"></div>
            </section>
        `;
        
        await fetchAndDisplayRosters();
        await fetchPirepHistory(); // This now needs to be called after the innerHTML is set
    };

    // NEW: Renders the UI for a pilot who is currently on duty
    const renderOnDutyUI = async (pilot) => {
        // Fetch full roster details and pilot's PIREPs for this duty
        const [rosterRes, pirepsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/rosters`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (!rosterRes.ok || !pirepsRes.ok) throw new Error('Could not load duty details.');
        
        const allRosters = await rosterRes.json();
        const allPireps = await pirepsRes.json();
        
        const currentRoster = allRosters.find(r => r._id === pilot.currentRoster);
        if (!currentRoster) {
            showNotification('Error: Could not find your assigned roster.', 'error');
            return;
        }
        
        // Find PIREPs filed for the current roster
        const filedPirepsForRoster = allPireps.filter(p => p.rosterLeg && p.rosterLeg.rosterId === currentRoster._id);
        const filedFlightNumbers = new Set(filedPirepsForRoster.map(p => p.flightNumber));

        // NOTE: Add this new UI to your crew-center.html.
        pilotActionsContainer.innerHTML = `
            <section class="content-card">
                <div class="on-duty-header">
                    <h2>🟢 On Duty: ${currentRoster.name}</h2>
                    <button id="end-duty-btn" class="submit-btn end-duty">Complete Duty Day</button>
                </div>
                <div class="roster-checklist">
                    ${currentRoster.legs.map(leg => {
                        const isCompleted = filedFlightNumbers.has(leg.flightNumber);
                        return `
                        <div class="roster-leg-item ${isCompleted ? 'completed' : ''}">
                            <span class="status-icon">${isCompleted ? '✅' : '➡️'}</span>
                            <strong class="flight-number">${leg.flightNumber}</strong>
                            <span class="route">${leg.departure} - ${leg.arrival}</span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </section>
            <section class="content-card">
                <h2>File Next Flight Report (PIREP)</h2>
                <form id="pirep-form">
                    <div class="form-group">
                        <label for="flight-number">Flight Number</label>
                        <input type="text" id="flight-number" name="flightNumber" placeholder="e.g., 6E2024" required>
                    </div>
                    <div class="form-group-row">
                        <div class="form-group">
                            <label for="departure-icao">Departure (ICAO)</label>
                            <input type="text" id="departure-icao" name="departure" placeholder="e.g., VOHS" required maxlength="4" pattern="[A-Za-z]{4}">
                        </div>
                        <div class="form-group">
                            <label for="arrival-icao">Arrival (ICAO)</label>
                            <input type="text" id="arrival-icao" name="arrival" placeholder="e.g., VECC" required maxlength="4" pattern="[A-Za-z]{4}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="aircraft-type">Aircraft Type</label>
                        <input type="text" id="aircraft-type" name="aircraft" placeholder="e.g., A320" required>
                    </div>
                    <div class="form-group">
                        <label for="flight-time">Flight Time (in hours)</label>
                        <input type="number" id="flight-time" name="flightTime" placeholder="e.g., 2.5" step="0.1" min="0.1" required>
                    </div>
                    <div class="form-group">
                        <label for="remarks">Remarks (Optional)</label>
                        <textarea id="remarks" name="remarks" rows="3" placeholder="Any additional notes about the flight..."></textarea>
                    </div>
                    <button type="submit" class="submit-btn">File Report</button>
                </form>
            </section>
        `;
    };
    
    // --- 4. Helper & Event Functions ---

    // NEW: Fetches and displays available rosters in the list
    const fetchAndDisplayRosters = async () => {
        const container = document.getElementById('roster-list-container');
        try {
            const response = await fetch(`${API_BASE_URL}/api/rosters`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch rosters.');

            const rosters = await response.json();

            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available for duty today. Please check back later.</p>';
                return;
            }

            container.innerHTML = rosters.map(roster => `
                <div class="roster-item">
                    <div class="roster-info">
                        <strong>${roster.name}</strong>
                        <small>Hub: ${roster.hub} | Total Time: ${roster.totalFlightTime.toFixed(1)} hrs</small>
                        <div class="roster-path">${roster.legs.map(l => l.departure).join(' → ')} → ${roster.legs[roster.legs.length-1].arrival}</div>
                    </div>
                    <button class="submit-btn go-on-duty-btn" data-roster-id="${roster._id}">Go On Duty</button>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    };

    // MODIFIED: This function is now called after UI is rendered.
    const fetchPirepHistory = async () => {
        const historyContainer = document.getElementById('pirep-history-list');
        if (!historyContainer) return;
        historyContainer.innerHTML = '<p>Loading history...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/me/pireps`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch PIREP history.');

            const pireps = await response.json();

            if (pireps.length === 0) {
                historyContainer.innerHTML = '<p>You have not filed any flight reports yet.</p>';
                return;
            }

            historyContainer.innerHTML = pireps.map(p => `
                <div class="pirep-history-item">
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
            historyContainer.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    };
    
    // --- 5. Event Listeners using Delegation ---
    
    // MODIFIED: Use event delegation on the main container
    pilotActionsContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'pirep-form') {
            e.preventDefault();
            const submitButton = e.target.querySelector('.submit-btn');
            submitButton.disabled = true;
            submitButton.textContent = 'Filing...';

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
                
                showNotification('Report submitted for review!', 'success');
                fetchPilotData(); // Reload all data to update the UI state
                
            } catch (error) {
                console.error('PIREP submission error:', error);
                showNotification(`Error: ${error.message}`, 'error');
                submitButton.disabled = false;
                submitButton.textContent = 'File Report';
            }
        }
    });

    // NEW: Event listener for clicks on "Go On Duty" and "End Duty"
    pilotActionsContainer.addEventListener('click', async (e) => {
        // Handle "Go On Duty" button clicks
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
                await fetchPilotData(); // Reload everything to switch to "On Duty" UI

            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Go On Duty';
            }
        }

        // Handle "End Duty Day" button clicks
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
                await fetchPilotData(); // Reload everything to switch to "On Rest" UI

            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Complete Duty Day';
            }
        }
    });
    
    // Logout Functionality (No changes)
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    });

    // Initial data load
    fetchPilotData();
});