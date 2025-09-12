document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- CROPPER VARIABLES AND ELEMENTS ---
    const cropperModal = document.getElementById('cropper-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const cropAndSaveBtn = document.getElementById('crop-and-save-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const pictureInput = document.getElementById('profile-picture');
    let cropper;
    let croppedImageBlob = null; // This will hold the cropped image file

    // --- PAGE ELEMENTS ---
    const welcomeMessage = document.getElementById('welcome-message');
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const addMemberForm = document.getElementById('add-member-form');
    const logoutBtn = document.getElementById('logout-btn');

    // --- TAB LINKS ---
    const adminTabLink = document.getElementById('admin-tab-link');
    const communityTabLink = document.getElementById('community-tab-link');
    const pilotManagementTabLink = document.getElementById('pilot-management-tab-link');
    const pirepTabLink = document.getElementById('pirep-tab-link');
    const rosterTabLink = document.getElementById('roster-tab-link');

    // --- PROFILE CARD ELEMENTS ---
    const profileCardPicture = document.getElementById('profile-card-picture');
    const profileCardName = document.getElementById('profile-card-name');
    const profileCardRole = document.getElementById('profile-card-role');
    const profileCardBio = document.getElementById('profile-card-bio');

    // --- CONTAINERS & DYNAMIC ELEMENTS ---
    const tabsContainer = document.querySelector('.tabs');
    const pilotManagementContainer = document.getElementById('pilot-management-container');
    const userListContainer = document.getElementById('user-list-container');
    const logContainer = document.getElementById('log-container');
    const manageEventsContainer = document.getElementById('manage-events-container');
    const manageHighlightsContainer = document.getElementById('manage-highlights-container');
    const pendingPirepsContainer = document.getElementById('pending-pireps-container');
    const rosterManagementContainer = document.getElementById('tab-roster-management');
    let pilotTabLink = document.getElementById('pilot-tab-link');
    let pilotTabContent = document.getElementById('tab-pilots');
    
    // --- APP STATE & CONFIG ---
    const token = localStorage.getItem('authToken');
    let currentUserId = null;
    const allRoles = {
        "General Roles": ["staff", "pilot", "admin"],
        "Leadership & Management": ["Chief Executive Officer (CEO)", "Chief Operating Officer (COO)", "PIREP Manager (PM)", "Pilot Relations & Recruitment Manager (PR)", "Technology & Design Manager (TDM)", "Head of Training (COT)", "Chief Marketing Officer (CMO)", "Route Manager (RM)", "Events Manager (EM)"],
        "Flight Operations": ["Flight Instructor (FI)"]
    };
    const pilotRanks = ['Cadet', 'Second Officer', 'First Officer', 'Senior First Officer', 'Captain', 'Senior Captain'];

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- SAFE FETCH WRAPPER (UPDATED) ---
    async function safeFetch(url, options = {}) {
        options.headers = options.headers || {};
        if (!options.headers.Authorization && token) {
            options.headers.Authorization = `Bearer ${token}`;
        }
        
        if (!(options.body instanceof FormData) && !options.headers['Content-Type']) {
            options.headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, options);
        let data = null;
        const contentType = res.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            const text = await res.text();
            data = { message: text }; 
        }

        if (!res.ok) {
            const msg = (data && (data.message || data.error)) || `Server error: ${res.status}`;
            const err = new Error(msg);
            err.status = res.status;
            err.body = data;
            throw err;
        }
        return data;
    }

    // --- UI NOTIFICATION HELPER ---
    function showNotification(message, type = 'info') {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: type === 'success' ? "linear-gradient(to right, #00b09b, #96c93d)" :
                            type === 'error' ? "linear-gradient(to right, #ff5f6d, #ffc371)" :
                            "linear-gradient(to right, #4facfe, #00f2fe)",
            },
        }).showToast();
    }

    // --- FETCH USER DATA & SETUP UI (UPDATED)---
    async function fetchUserData() {
        try {
            const user = await safeFetch(`${API_BASE_URL}/api/me`);
            currentUserId = user._id;

            welcomeMessage.textContent = `Welcome, ${user.name || 'Pilot'}!`;
            profileCardName.textContent = user.name;
            profileCardBio.textContent = user.bio || 'Your bio will appear here once you\'ve set it.';
            profileCardRole.textContent = user.role ? user.role.toUpperCase() : 'USER';
            profileCardPicture.src = user.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=120`;

            // Populate form fields
            if (document.getElementById('profile-name')) document.getElementById('profile-name').value = user.name;
            if (document.getElementById('profile-bio')) document.getElementById('profile-bio').value = user.bio || '';
            if (document.getElementById('profile-discord')) document.getElementById('profile-discord').value = user.discord || '';
            if (document.getElementById('profile-ifc')) document.getElementById('profile-ifc').value = user.ifc || '';
            if (document.getElementById('profile-youtube')) document.getElementById('profile-youtube').value = user.youtube || '';
            if (document.getElementById('profile-preferred')) document.getElementById('profile-preferred').value = user.preferredContact || 'none';

            // --- ROLE-BASED TAB VISIBILITY ---
            if (user.role === 'admin') {
                if (adminTabLink) adminTabLink.style.display = 'inline-block';
                populateAdminTools();
                ensurePilotTab();
                populatePilotDatabase();
            }

            const communityRoles = ['Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'admin', 'Chief Marketing Officer (CMO)', 'Events Manager (EM)'];
            if (communityRoles.includes(user.role)) {
                if (communityTabLink) communityTabLink.style.display = 'inline-block';
                populateCommunityManagement();
            }

            const pilotManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'Head of Training (COT)'];
            if (pilotManagerRoles.includes(user.role)) {
                if (pilotManagementTabLink) pilotManagementTabLink.style.display = 'inline-block';
                populatePilotManagement();
            }
            
            const pirepManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'PIREP Manager (PM)'];
            if (pirepManagerRoles.includes(user.role)) {
                if (pirepTabLink) pirepTabLink.style.display = 'inline-block';
                loadPendingPireps();
            }

            const routeManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'Route Manager (RM)'];
            if (routeManagerRoles.includes(user.role)) {
                if (rosterTabLink) rosterTabLink.style.display = 'inline-block';
                populateRosterManagement();
            }

            document.querySelector('.fade-in')?.classList.add('visible');
        } catch (error) {
            console.error('Error fetching user data:', error);
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }
    
    // --- PIREP MANAGEMENT ---
    async function loadPendingPireps() {
        if (!pendingPirepsContainer) return;
        pendingPirepsContainer.innerHTML = '<p>Loading pending reports...</p>';
        try {
            const pireps = await safeFetch(`${API_BASE_URL}/api/pireps/pending`);
            renderPireps(pireps);
        } catch (error) {
            pendingPirepsContainer.innerHTML = `<p style="color: #ff5f6d;">Error: ${error.message}</p>`;
        }
    }

    function renderPireps(pireps) {
        if (!pendingPirepsContainer) return;
        if (!pireps || pireps.length === 0) {
            pendingPirepsContainer.innerHTML = '<p>There are no pending PIREPs to review. 🎉</p>';
            return;
        }
        pendingPirepsContainer.innerHTML = pireps.map(p => `
            <div class="pirep-review-card" id="pirep-${p._id}">
                <div class="card-header">
                    <h4>${p.flightNumber} (${p.departure} → ${p.arrival})</h4>
                    <div class="pilot-info">
                        <strong>Pilot:</strong> ${p.pilot.name} (${p.pilot.callsign || 'N/A'})
                    </div>
                </div>
                <div class="card-body">
                    <p><strong>Aircraft:</strong> ${p.aircraft}</p>
                    <p><strong>Flight Time:</strong> ${p.flightTime.toFixed(1)} hours</p>
                    <p><strong>Remarks:</strong> ${p.remarks || 'None'}</p>
                    <p><small>Filed on: ${new Date(p.createdAt).toLocaleString()}</small></p>
                </div>
                <div class="card-actions">
                    <button class="btn-approve" data-id="${p._id}">Approve</button>
                    <button class="btn-reject" data-id="${p._id}">Reject</button>
                </div>
            </div>
        `).join('');
    }

    pendingPirepsContainer?.addEventListener('click', async (e) => {
        const pirepId = e.target.dataset.id;
        if (!pirepId) return;

        if (e.target.classList.contains('btn-approve')) {
            e.target.disabled = true;
            e.target.textContent = 'Approving...';
            try {
                const result = await safeFetch(`${API_BASE_URL}/api/pireps/${pirepId}/approve`, { method: 'PUT' });
                showNotification(result.message, 'success');
                document.getElementById(`pirep-${pirepId}`).remove();
                if (pendingPirepsContainer.children.length === 0) {
                    renderPireps([]); 
                }
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Approve';
            }
        }

        if (e.target.classList.contains('btn-reject')) {
            const reason = prompt('Please provide a reason for rejecting this PIREP:');
            if (!reason || reason.trim() === '') {
                showNotification('Rejection cancelled. A reason is required.', 'info');
                return;
            }
            e.target.disabled = true;
            e.target.textContent = 'Rejecting...';
            try {
                const result = await safeFetch(`${API_BASE_URL}/api/pireps/${pirepId}/reject`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason })
                });
                showNotification(result.message, 'success');
                document.getElementById(`pirep-${pirepId}`).remove();
                if (pendingPirepsContainer.children.length === 0) {
                    renderPireps([]); 
                }
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Reject';
            }
        }
    });

    // --- ROSTER MANAGEMENT (UPDATED) ---
    function populateRosterManagement() {
        if (!rosterManagementContainer) return;
        
        rosterManagementContainer.innerHTML = `
            <h2>Roster Management ✈️</h2>
            <p>Create and manage daily rosters for the Sector Ops system.</p>
            
            <div id="roster-automation-panel" style="padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 2rem; background-color: #f9f9f9;">
                <h3>Automated Roster Generation</h3>
                <p>Automatically generate a new set of daily rosters from the master Google Sheet. This will delete all previously auto-generated rosters.</p>
                <button id="generate-rosters-btn" class="cta-button">Generate Rosters from Sheet</button>
            </div>
            
            <div id="create-roster-panel">
                <h3>Create New Roster (Manual)</h3>
                <form id="create-roster-form" class="dashboard-form">
                    <div class="form-group"><label for="roster-name">Roster Name</label><input type="text" id="roster-name" required></div>
                    <div class="form-group"><label for="roster-hub">Hub ICAO</label><input type="text" id="roster-hub" required maxlength="4"></div>
                    <div class="form-group"><label for="roster-time">Total Estimated Flight Time (Hours)</label><input type="number" id="roster-time" step="0.1" min="0" required></div>
                    <h4>Roster Legs</h4>
                    <div id="roster-legs-container">
                        <div class="roster-leg-input">
                            <input type="text" placeholder="Flight #" required><input type="text" placeholder="Departure ICAO" required maxlength="4"><input type="text" placeholder="Arrival ICAO" required maxlength="4">
                        </div>
                    </div>
                    <button type="button" id="add-leg-btn" class="cta-button secondary">Add Leg</button>
                    <hr style="margin: 1rem 0;">
                    <button type="submit" class="cta-button">Create Roster</button>
                </form>
            </div>
            <hr style="margin: 2rem 0;">
            <div id="manage-rosters-panel">
                <h3>Existing Rosters</h3>
                <div id="manage-rosters-container"><p>Loading rosters...</p></div>
            </div>
        `;

        loadAndRenderRosters();

        document.getElementById('add-leg-btn').addEventListener('click', () => {
            const legContainer = document.getElementById('roster-legs-container');
            const newLeg = document.createElement('div');
            newLeg.className = 'roster-leg-input';
            newLeg.innerHTML = `<input type="text" placeholder="Flight #" required><input type="text" placeholder="Departure ICAO" required maxlength="4"><input type="text" placeholder="Arrival ICAO" required maxlength="4"><button type="button" class="remove-leg-btn">&times;</button>`;
            legContainer.appendChild(newLeg);
        });

        document.getElementById('roster-legs-container').addEventListener('click', e => {
            if (e.target.classList.contains('remove-leg-btn')) {
                e.target.parentElement.remove();
            }
        });

        document.getElementById('create-roster-form').addEventListener('submit', async e => {
            e.preventDefault();
            const legs = Array.from(document.querySelectorAll('.roster-leg-input')).map(legDiv => {
                const inputs = legDiv.querySelectorAll('input');
                return {
                    flightNumber: inputs[0].value.toUpperCase(),
                    departure: inputs[1].value.toUpperCase(),
                    arrival: inputs[2].value.toUpperCase(),
                    flightTime: 0 // Note: Backend doesn't use leg flightTime for manual creation yet, but good to have
                };
            });

            const rosterData = {
                name: document.getElementById('roster-name').value,
                hub: document.getElementById('roster-hub').value.toUpperCase(),
                totalFlightTime: parseFloat(document.getElementById('roster-time').value),
                legs: legs,
            };

            try {
                await safeFetch(`${API_BASE_URL}/api/rosters`, { method: 'POST', body: JSON.stringify(rosterData) });
                showNotification('Roster created successfully!', 'success');
                e.target.reset();
                document.getElementById('roster-legs-container').innerHTML = `<div class="roster-leg-input"><input type="text" placeholder="Flight #" required><input type="text" placeholder="Departure ICAO" required maxlength="4"><input type="text" placeholder="Arrival ICAO" required maxlength="4"></div>`;
                loadAndRenderRosters();
            } catch (error) {
                showNotification(`Error creating roster: ${error.message}`, 'error');
            }
        });
    }

    async function loadAndRenderRosters() {
        const container = document.getElementById('manage-rosters-container');
        if (!container) return;
        try {
            const rosters = await safeFetch(`${API_BASE_URL}/api/rosters`);
            if (!rosters || rosters.length === 0) {
                container.innerHTML = '<p>No rosters have been created yet.</p>';
                return;
            }
            container.innerHTML = rosters.map(roster => `
                <div class="user-manage-card">
                    <div class="user-info">
                        <strong>${roster.name} ${roster.isGenerated ? ' <small>(Auto)</small>' : ''}</strong> (${roster.hub})
                        <small>${roster.legs.length} legs, ${roster.totalFlightTime.toFixed(1)} hrs</small>
                    </div>
                    <div class="user-controls">
                        <button class="delete-user-btn delete-roster-btn" data-id="${roster._id}" data-name="${roster.name}"><i class="fas fa-trash-alt"></i> Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p style="color:red;">Could not load rosters: ${error.message}</p>`;
        }
    }

    rosterManagementContainer?.addEventListener('click', async e => {
        const deleteButton = e.target.closest('.delete-roster-btn');
        const generateButton = e.target.closest('#generate-rosters-btn');

        if (deleteButton) {
            const rosterId = deleteButton.dataset.id;
            const rosterName = deleteButton.dataset.name;
            if (confirm(`Are you sure you want to delete the roster "${rosterName}"?`)) {
                try {
                    await safeFetch(`${API_BASE_URL}/api/rosters/${rosterId}`, { method: 'DELETE' });
                    showNotification('Roster deleted successfully.', 'success');
                    loadAndRenderRosters();
                } catch (error) {
                    showNotification(`Error deleting roster: ${error.message}`, 'error');
                }
            }
        }

        if (generateButton) {
            if (!confirm('Are you sure? This will replace all existing auto-generated rosters.')) return;
            
            generateButton.disabled = true;
            generateButton.textContent = 'Generating...';
            try {
                const result = await safeFetch(`${API_BASE_URL}/api/rosters/generate`, { method: 'POST' });
                showNotification(result.message, 'success');
                loadAndRenderRosters(); 
            } catch (error) {
                showNotification(`Generation failed: ${error.message}`, 'error');
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Generate Rosters from Sheet';
            }
        }
    });

    // --- TAB SWITCHING LOGIC ---
    function attachTabListeners() {
        const tabLinks = document.querySelectorAll('.tab-link');
        const tabContents = document.querySelectorAll('.tab-content');

        tabLinks.forEach(tab => {
            tab.addEventListener('click', () => {
                tabLinks.forEach(item => item.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                tab.classList.add('active');
                const target = document.getElementById(tab.dataset.tab);
                if (target) target.classList.add('active');

                const tabId = tab.dataset.tab;
                if (tabId === 'tab-pilots') populatePilotDatabase();
                if (tabId === 'tab-admin') populateAdminTools();
                if (tabId === 'tab-pirep-management') loadPendingPireps();
                if (tabId === 'tab-roster-management') loadAndRenderRosters();
            });
        });
    }

    // --- ADMIN: POPULATE USERS & LOGS ---
    async function populateAdminTools() {
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`, { method: 'GET' });
            renderUserList(users);
            renderLiveOperations(users); 

            const logs = await safeFetch(`${API_BASE_URL}/api/logs`, { method: 'GET' });
            renderLogList(logs);
        } catch (error) {
            console.error('Failed to populate admin tools:', error);
            if (userListContainer) userListContainer.innerHTML = '<p style="color: red;">Could not load users.</p>';
            if (logContainer) logContainer.innerHTML = '<p style="color: red;">Could not load logs.</p>';
        }
    }

    function renderUserList(users) {
        if (!userListContainer) return;
        userListContainer.innerHTML = '';

        const createRoleOptions = (selectedRole) => {
            let optionsHtml = '';
            for (const group in allRoles) {
                optionsHtml += `<optgroup label="${group}">`;
                allRoles[group].forEach(role => {
                    const selected = role === selectedRole ? 'selected' : '';
                    optionsHtml += `<option value="${role}" ${selected}>${role}</option>`;
                });
                optionsHtml += `</optgroup>`;
            }
            return optionsHtml;
        };

        const userCards = users.map(user => {
            const isCurrentUser = user._id === currentUserId;
            const controlsDisabled = isCurrentUser ? 'disabled' : '';

            return `
                <div class="user-manage-card" data-userid="${user._id}">
                    <div class="user-info">
                        <strong>${user.name}</strong>
                        <small>${user.email}</small>
                        <div><small>Rank: ${user.rank || '—'} • Hours: ${user.flightHours?.toFixed(1) ?? 0}</small></div>
                    </div>
                    <div class="user-controls">
                        <label style="display:block;font-size:0.8rem;margin-bottom:6px;">
                            Callsign:
                            <input type="text" class="callsign-input" data-userid="${user._id}" value="${user.callsign || ''}" ${isCurrentUser ? 'readonly' : ''} placeholder="e.g. INDGO-01" style="margin-left:6px"/>
                            <button type="button" class="set-callsign-btn" data-userid="${user._id}" ${controlsDisabled}>Set</button>
                        </label>
                        <select class="role-select" data-userid="${user._id}" ${controlsDisabled}>
                            ${createRoleOptions(user.role)}
                        </select>
                        <button type="button" class="delete-user-btn" data-userid="${user._id}" data-username="${user.name}" ${controlsDisabled}>
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        userListContainer.innerHTML = userCards;
    }

    function renderLogList(logs) {
        if (!logContainer) return;
        logContainer.innerHTML = '';

        if (!logs || logs.length === 0) {
            logContainer.innerHTML = '<p>No administrative actions have been logged yet.</p>';
            return;
        }

        const logEntries = logs.map(log => `
            <div class="log-entry">
                <p><strong>Action:</strong> ${log.action.replace('_', ' ')}</p>
                <p><strong>Admin:</strong> ${log.adminUser?.name || 'Unknown'} (${log.adminUser?.email || '—'})</p>
                <p><strong>Details:</strong> ${log.details}</p>
                <small>${new Date(log.timestamp).toLocaleString()}</small>
            </div>
        `).join('');

        logContainer.innerHTML = logEntries;
    }

    // --- RENDER LIVE OPERATIONS ---
    function renderLiveOperations(users) {
        const container = document.getElementById('live-ops-container');
        if (!container) return;

        const onDutyPilots = users.filter(u => u.dutyStatus === 'ON_DUTY');
        
        if (onDutyPilots.length === 0) {
            container.innerHTML = '<p>No pilots are currently on duty.</p>';
            return;
        }

        safeFetch(`${API_BASE_URL}/api/rosters`).then(rosters => {
            const rosterMap = new Map(rosters.map(r => [r._id, r.name]));
            container.innerHTML = onDutyPilots.map(pilot => `
                <div class="live-ops-item" style="padding: 0.5rem; border-bottom: 1px solid #eee;">
                    <strong>${pilot.name} (${pilot.callsign || 'N/A'})</strong> is ON DUTY.
                    <small style="display: block; color: #555;">Roster: ${rosterMap.get(pilot.currentRoster) || 'N/A'}</small>
                </div>
            `).join('');
        }).catch(err => {
            container.innerHTML = '<p style="color: red;">Could not load roster data for live ops.</p>';
        });
    }

    // ... (The rest of the file remains the same) ...

    // --- COMMUNITY: EVENTS & HIGHLIGHTS ---
    async function populateCommunityManagement() {
        if (!manageEventsContainer || !manageHighlightsContainer) return;
        try {
            const events = await safeFetch(`${API_BASE_URL}/api/events`, { method: 'GET' });
            renderManagementList(events, manageEventsContainer, 'event');

            const highlights = await safeFetch(`${API_BASE_URL}/api/highlights`, { method: 'GET' });
            renderManagementList(highlights, manageHighlightsContainer, 'highlight');
        } catch (error) {
            console.error('Failed to populate community management lists:', error);
            manageEventsContainer.innerHTML = '<p style="color:red;">Could not load events.</p>';
            manageHighlightsContainer.innerHTML = '<p style="color:red;">Could not load highlights.</p>';
        }
    }

    function renderManagementList(items, container, type) {
        if (!items || items.length === 0) {
            container.innerHTML = `<p>No ${type}s found.</p>`;
            return;
        }

        const itemsHtml = items.map(item => `
            <div class="user-manage-card">
                <div class="user-info">
                    <strong>${item.title}</strong>
                    <small>${type === 'event' ? new Date(item.date).toLocaleDateString() : `Winner: ${item.winnerName}`}</small>
                </div>
                <div class="user-controls">
                    <button type="button" class="delete-user-btn" data-id="${item._id}" data-type="${type}" data-title="${item.title}">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = itemsHtml;
    }
    
    // --- PILOT DATABASE & MANAGEMENT ---
    function ensurePilotTab() {
        if (!pilotTabLink) {
            pilotTabLink = document.createElement('button');
            pilotTabLink.id = 'pilot-tab-link';
            pilotTabLink.className = 'tab-link';
            pilotTabLink.dataset.tab = 'tab-pilots';
            pilotTabLink.textContent = 'Pilot Database';
            if (tabsContainer) tabsContainer.appendChild(pilotTabLink);
        }

        if (!pilotTabContent) {
            pilotTabContent = document.createElement('div');
            pilotTabContent.id = 'tab-pilots';
            pilotTabContent.className = 'tab-content';
            pilotTabContent.innerHTML = `<div id="pilot-db-container"><p>Loading pilots...</p></div>`;
            const contentWrapper = document.querySelector('.tab-contents') || document.body;
            contentWrapper.appendChild(pilotTabContent);
        }
        attachTabListeners();
    }

    async function populatePilotDatabase() {
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`, { method: 'GET' });
            const pilots = (users || []).filter(u => u.role === 'pilot' || Boolean(u.callsign));
            const container = document.getElementById('pilot-db-container');
            if (!container) return;

            if (pilots.length === 0) {
                container.innerHTML = '<p>No pilots found.</p>';
                return;
            }

            const rows = pilots.map(p => `
                <div class="pilot-row" data-userid="${p._id}">
                    <div class="pilot-info">
                        <strong>${p.name}</strong> <small>(${p.email})</small><br/>
                        <small>Rank: ${p.rank || '—'} • Hours: ${p.flightHours?.toFixed(1) ?? 0}</small>
                    </div>
                    <div class="pilot-controls">
                        <label>Callsign:
                            <input class="pilot-callsign-input" data-userid="${p._id}" value="${p.callsign || ''}" placeholder="e.g. INDGO-01" />
                        </label>
                        <button class="pilot-set-callsign-btn" data-userid="${p._id}">Update Callsign</button>
                    </div>
                </div>
            `).join('');
            container.innerHTML = rows;
        } catch (error) {
            console.error('Failed to load pilot database:', error);
            const container = document.getElementById('pilot-db-container');
            if (container) container.innerHTML = `<p style="color:red;">Could not load pilots: ${error.message}</p>`;
        }
    }

    async function populatePilotManagement() {
        if (!pilotManagementContainer) return;
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`);
            const pilots = users.filter(u => u.role === 'pilot');
            renderPilotList(pilots);
        } catch (error) {
            pilotManagementContainer.innerHTML = `<p style="color:red;">Could not load pilot roster: ${error.message}</p>`;
        }
    }

    function renderPilotList(pilots) {
        if (pilots.length === 0) {
            pilotManagementContainer.innerHTML = '<p>No pilots found in the roster.</p>';
            return;
        }

        const createRankOptions = (currentRank) => {
            return pilotRanks.map(rank =>
                `<option value="${rank}" ${rank === currentRank ? 'selected' : ''}>${rank}</option>`
            ).join('');
        };

        pilotManagementContainer.innerHTML = pilots.map(pilot => `
            <div class="user-manage-card" data-userid="${pilot._id}">
                <div class="user-info">
                    <strong>${pilot.name}</strong> (${pilot.callsign || 'No Callsign'})
                    <small>${pilot.email}</small>
                </div>
                <div class="user-controls">
                    <label>
                        Rank:
                        <select class="rank-select" data-userid="${pilot._id}">
                            ${createRankOptions(pilot.rank)}
                        </select>
                    </label>
                </div>
            </div>
        `).join('');
    }
    
    // --- CROPPER LOGIC ---
    pictureInput?.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const reader = new FileReader();
            reader.onload = () => {
                imageToCrop.src = reader.result;
                if (cropperModal) cropperModal.style.display = 'flex';
                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1 / 1,
                    viewMode: 1,
                    background: false,
                });
            };
            reader.readAsDataURL(files[0]);
        }
    });

    cancelCropBtn?.addEventListener('click', () => {
        if (cropperModal) cropperModal.style.display = 'none';
        if (cropper) cropper.destroy();
        if (pictureInput) pictureInput.value = '';
    });

    cropAndSaveBtn?.addEventListener('click', () => {
        if (cropper) {
            cropper.getCroppedCanvas({ width: 250, height: 250 }).toBlob((blob) => {
                croppedImageBlob = blob;
                const previewUrl = URL.createObjectURL(blob);
                if (profileCardPicture) profileCardPicture.src = previewUrl;
                if (cropperModal) cropperModal.style.display = 'none';
                cropper.destroy();
                if (pictureInput) pictureInput.value = '';
                showNotification('Picture ready to be saved.', 'info');
            }, 'image/jpeg');
        }
    });

    // --- PROFILE UPDATE ---
    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', document.getElementById('profile-name').value);
        formData.append('bio', document.getElementById('profile-bio').value || '');
        formData.append('discord', document.getElementById('profile-discord').value || '');
        formData.append('ifc', document.getElementById('profile-ifc').value || '');
        formData.append('youtube', document.getElementById('profile-youtube').value || '');
        formData.append('preferredContact', document.getElementById('profile-preferred').value || 'none');

        if (croppedImageBlob) {
            formData.append('profilePicture', croppedImageBlob, 'profile.jpg');
        }

        try {
            const result = await safeFetch(`${API_BASE_URL}/api/me`, {
                method: 'PUT',
                body: formData
            });
            showNotification('Profile updated successfully!', 'success');
            if (result.token) localStorage.setItem('authToken', result.token);
            const user = result.user;
            welcomeMessage.textContent = `Welcome, ${user.name}!`;
            profileCardName.textContent = user.name;
            profileCardBio.textContent = user.bio || 'Your bio will appear here once you\'ve set it.';
            if (user.imageUrl) {
                profileCardPicture.src = `${user.imageUrl}?${new Date().getTime()}`;
            }
            croppedImageBlob = null;
        } catch (error) {
            showNotification(`Update failed: ${error.message}`, 'error');
        }
    });

    // --- PASSWORD UPDATE ---
    passwordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match.', 'error');
            return;
        }
        
        try {
            await safeFetch(`${API_BASE_URL}/api/me/password`, {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            showNotification('Password updated successfully!', 'success');
            passwordForm.reset();
        } catch (error) {
            showNotification(`Password update failed: ${error.message}`, 'error');
        }
    });

    // --- ADD MEMBER (ADMIN) ---
    if (addMemberForm) {
        if (!document.getElementById('new-member-callsign')) {
            const roleEl = document.getElementById('new-member-role');
            const callsignWrapper = document.createElement('div');
            callsignWrapper.innerHTML = `
                <label for="new-member-callsign">Callsign (optional)</label>
                <input id="new-member-callsign" name="callsign" placeholder="e.g. INDGO-01" />
            `;
            if (roleEl && roleEl.parentNode) {
                roleEl.parentNode.insertBefore(callsignWrapper, roleEl.nextSibling);
            } else {
                addMemberForm.appendChild(callsignWrapper);
            }
        }
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('new-member-email').value;
            const password = document.getElementById('new-member-password').value;
            const role = document.getElementById('new-member-role').value;
            const callsignInput = document.getElementById('new-member-callsign');
            let callsign = callsignInput ? callsignInput.value.trim().toUpperCase() : null;
            if (callsign === '') callsign = null;

            try {
                await safeFetch(`${API_BASE_URL}/api/users`, {
                    method: 'POST',
                    body: JSON.stringify({ email, password, role, callsign })
                });
                showNotification('User created successfully!', 'success');
                addMemberForm.reset();
                populateAdminTools();
            } catch (error) {
                showNotification(`Failed to create user: ${error.message}`, 'error');
            }
        });
    }

    // --- EVENT DELEGATION: ADMIN USER ACTIONS ---
    if (userListContainer) {
        userListContainer.addEventListener('click', async (e) => {
            const target = e.target;
            const deleteBtn = target.closest('.delete-user-btn');
            if (deleteBtn) {
                e.preventDefault();
                const userId = deleteBtn.dataset.userid;
                const userName = deleteBtn.dataset.username;
                if (!userId) return;
                if (!confirm(`WARNING: Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}`, { method: 'DELETE' });
                    showNotification('User deleted successfully.', 'success');
                    populateAdminTools();
                } catch (error) {
                    showNotification(`Failed to delete user: ${error.message}`, 'error');
                }
                return;
            }

            const setCsBtn = target.closest('.set-callsign-btn');
            if (setCsBtn) {
                e.preventDefault();
                const userId = setCsBtn.dataset.userid;
                const input = document.querySelector(`.callsign-input[data-userid="${userId}"]`);
                if (!input) return;
                let callsign = input.value.trim().toUpperCase();
                if (!callsign) {
                    showNotification('Please enter a non-empty callsign to set.', 'error');
                    return;
                }
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}/callsign`, {
                        method: 'PUT',
                        body: JSON.stringify({ callsign })
                    });
                    showNotification(`Callsign ${callsign} assigned.`, 'success');
                    populateAdminTools();
                    populatePilotDatabase();
                } catch (error) {
                    showNotification(`Failed to set callsign: ${error.message}`, 'error');
                }
                return;
            }
        });

        userListContainer.addEventListener('change', async (e) => {
            if (e.target.classList.contains('role-select')) {
                const select = e.target;
                const userId = select.dataset.userid;
                const newRole = select.value;
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}/role`, {
                        method: 'PUT',
                        body: JSON.stringify({ newRole })
                    });
                    showNotification('User role updated successfully.', 'success');
                    populateAdminTools();
                    populatePilotDatabase();
                } catch (error) {
                    showNotification(`Failed to update role: ${error.message}`, 'error');
                    populateAdminTools();
                }
            }
        });
    }

    // --- EVENT DELEGATION: COMMUNITY DELETION ---
    const communityTabContent = document.getElementById('tab-community');
    if (communityTabContent) {
        communityTabContent.addEventListener('click', async (e) => {
            const button = e.target.closest('.delete-user-btn[data-type]');
            if (!button) return;
            e.preventDefault();
            const postId = button.dataset.id;
            const postType = button.dataset.type;
            const postTitle = button.dataset.title;
            if (!confirm(`Are you sure you want to delete the ${postType}: "${postTitle}"?`)) return;
            try {
                await safeFetch(`${API_BASE_URL}/api/${postType}s/${postId}`, { method: 'DELETE' });
                const successMessage = `${postType.charAt(0).toUpperCase() + postType.slice(1)} deleted successfully.`;
                showNotification(successMessage, 'success');
                populateCommunityManagement();
            } catch (error) {
                showNotification(`Failed to delete ${postType}: ${error.message}`, 'error');
            }
        });
    }

    // --- EVENT DELEGATION: PILOT MANAGEMENT ---
    pilotManagementContainer?.addEventListener('change', async (e) => {
        if (e.target.classList.contains('rank-select')) {
            const selectElement = e.target;
            const userId = selectElement.dataset.userid;
            const newRank = selectElement.value;
            if (!confirm(`Are you sure you want to change this pilot's rank to ${newRank}?`)) {
                populatePilotManagement();
                return;
            }
            try {
                await safeFetch(`${API_BASE_URL}/api/users/${userId}/rank`, {
                    method: 'PUT',
                    body: JSON.stringify({ newRank })
                });
                showNotification('Pilot rank updated successfully!', 'success');
            } catch (error) {
                showNotification(`Failed to update rank: ${error.message}`, 'error');
                populatePilotManagement();
            }
        }
    });

    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('.pilot-set-callsign-btn');
        if (!btn) return;
        const userId = btn.dataset.userid;
        const input = document.querySelector(`.pilot-callsign-input[data-userid="${userId}"]`);
        if (!input) return;
        const callsign = input.value.trim().toUpperCase();
        if (!callsign) {
            showNotification('Please enter a callsign before updating.', 'error');
            return;
        }
        try {
            await safeFetch(`${API_BASE_URL}/api/users/${userId}/callsign`, {
                method: 'PUT',
                body: JSON.stringify({ callsign })
            });
            showNotification('Callsign updated successfully.', 'success');
            populateAdminTools();
            populatePilotDatabase();
        } catch (error) {
            showNotification(`Failed to update callsign: ${error.message}`, 'error');
        }
    });

    // --- COMMUNITY CONTENT FORMS (CREATE) ---
    const createEventForm = document.getElementById('create-event-form');
    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('title', document.getElementById('event-title').value);
            formData.append('date', document.getElementById('event-date').value);
            formData.append('description', document.getElementById('event-description').value);
            const eventImageInput = document.getElementById('event-image');
            if (eventImageInput?.files[0]) formData.append('eventImage', eventImageInput.files[0]);
            try {
                await safeFetch(`${API_BASE_URL}/api/events`, {
                    method: 'POST',
                    body: formData
                });
                showNotification('Event posted successfully!', 'success');
                createEventForm.reset();
                populateCommunityManagement();
            } catch (error) {
                showNotification(`Failed to post event: ${error.message}`, 'error');
            }
        });
    }
    
    const createHighlightForm = document.getElementById('create-highlight-form');
    if (createHighlightForm) {
        createHighlightForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('title', document.getElementById('highlight-title').value);
            formData.append('winnerName', document.getElementById('highlight-winner').value);
            formData.append('description', document.getElementById('highlight-description').value);
            const hi = document.getElementById('highlight-image')?.files[0];
            if (hi) formData.append('highlightImage', hi);
            try {
                await safeFetch(`${API_BASE_URL}/api/highlights`, {
                    method: 'POST',
                    body: formData
                });
                showNotification('Highlight posted successfully!', 'success');
                createHighlightForm.reset();
                populateCommunityManagement();
            } catch (error) {
                showNotification(`Failed to post highlight: ${error.message}`, 'error');
            }
        });
    }
    
    // --- LOGOUT ---
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    });
    
    // --- MOBILE MENU ---
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // --- INITIALIZATION ---
    attachTabListeners();
    fetchUserData();
});