document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://indgo-backend.onrender.com';
    // --- START: CROPPER VARIABLES AND ELEMENTS ---
    const cropperModal = document.getElementById('cropper-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const cropAndSaveBtn = document.getElementById('crop-and-save-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const pictureInput = document.getElementById('profile-picture');
    let cropper;
    let croppedImageBlob = null; // This will hold the cropped image file

    // Page Elements
    const welcomeMessage = document.getElementById('welcome-message');
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const addMemberForm = document.getElementById('add-member-form');
    const adminTabLink = document.getElementById('admin-tab-link');
    const communityTabLink = document.getElementById('community-tab-link');
    const pilotManagementTabLink = document.getElementById('pilot-management-tab-link');
    const logoutBtn = document.getElementById('logout-btn');

    // Profile Card Elements
    const profileCardPicture = document.getElementById('profile-card-picture');
    const profileCardName = document.getElementById('profile-card-name');
    const profileCardRole = document.getElementById('profile-card-role');
    const profileCardBio = document.getElementById('profile-card-bio');

    // Tab Elements container (we will attach listeners dynamically)
    const tabsContainer = document.querySelector('.tabs'); // container for tab links; adjust selector to your markup
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const pilotManagementContainer = document.getElementById('pilot-management-container');

    // NEW: Admin Panel Containers
    const userListContainer = document.getElementById('user-list-container');
    const logContainer = document.getElementById('log-container');

    // NEW: Community Management Containers
    const manageEventsContainer = document.getElementById('manage-events-container');
    const manageHighlightsContainer = document.getElementById('manage-highlights-container');

    // NEW: Pilot Database container will be created if not present
    let pilotTabLink = document.getElementById('pilot-tab-link');
    let pilotTabContent = document.getElementById('tab-pilots');
    const token = localStorage.getItem('authToken');
    let currentUserId = null;

    // Define the roles centrally to avoid repetition
    const allRoles = {
        "General Roles": [
            "staff",
            "pilot",
            "admin"
        ],
        "Leadership & Management": [
            "Chief Executive Officer (CEO)",
            "Chief Operating Officer (COO)",
            "PIREP Manager (PM)",
            "Pilot Relations & Recruitment Manager (PR)",
            "Technology & Design Manager (TDM)",
            "Head of Training (COT)",
            "Chief Marketing Officer (CMO)",
            "Route Manager (RM)",
            "Events Manager (EM)"
        ],
        "Flight Operations": [
            "Flight Instructor (FI)"
        ]
    };

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const pilotRanks = [ // NEW
        'Cadet', 'Second Officer', 'First Officer', 
        'Senior First Officer', 'Captain', 'Senior Captain'
    ];

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --------------------------
    // SAFE FETCH WRAPPER
    // --------------------------
    async function safeFetch(url, options = {}) {
        // Ensure headers object exists
        options.headers = options.headers || {};
        // We'll not overwrite existing Authorization if present
        if (!options.headers.Authorization && token) {
            options.headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(url, options);
        let data = null;
        try {
            data = await res.json();
        } catch (err) {
            // Non-JSON response (rare) - keep data null
        }

        if (!res.ok) {
            const msg = (data && (data.message || data.error)) || `Server error: ${res.status} ${res.statusText}`;
            const err = new Error(msg);
            err.status = res.status;
            err.body = data;
            throw err;
        }
        return data;
    }

    // Small UI helper (existing in your codebase)
    function showNotification(message, type = 'info') {
        // Minimal implementation; replace with your actual notifier if present
        // type: 'success' | 'error' | 'info'
        console.log(`[${type.toUpperCase()}] ${message}`);
        // You can hook in a real UI toast here
        const el = document.createElement('div');
        el.className = `notif ${type}`;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    // --------------------------
    // Fetch User Data & Setup UI
    // --------------------------
    async function fetchUserData() {
        try {
            const user = await safeFetch(`${API_BASE_URL}/api/me`, {
                method: 'GET'
            });

            currentUserId = user._id;
            welcomeMessage.textContent = `Welcome, ${user.name || 'Pilot'}!`;
            if (document.getElementById('profile-name')) document.getElementById('profile-name').value = user.name;
            if (document.getElementById('profile-bio')) document.getElementById('profile-bio').value = user.bio || '';
            if (document.getElementById('profile-discord')) document.getElementById('profile-discord').value = user.discord || '';
            if (document.getElementById('profile-ifc')) document.getElementById('profile-ifc').value = user.ifc || '';
            if (document.getElementById('profile-youtube')) document.getElementById('profile-youtube').value = user.youtube || '';
            if (document.getElementById('profile-preferred')) document.getElementById('profile-preferred').value = user.preferredContact || 'none';

            profileCardName.textContent = user.name;
            profileCardBio.textContent = user.bio || 'Your bio will appear here once you\'ve set it.';
            profileCardRole.textContent = user.role ? user.role.toUpperCase() : 'USER';

            // Use S3 URL directly, or ui-avatars fallback
            profileCardPicture.src = user.imageUrl
                ? user.imageUrl
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=120`;

            // Show admin tab only for admins
            if (user.role === 'admin') {
                if (adminTabLink) adminTabLink.style.display = 'inline-block';
                populateAdminTools();
                // ensure pilot tab exists for admins
                ensurePilotTab();
                populatePilotDatabase();
            }

            // Community roles
            const authorizedRoles = ['Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'admin', 'Chief Marketing Officer (CMO)', 'Events Manager (EM)'];
            if (authorizedRoles.includes(user.role)) {
                if (communityTabLink) communityTabLink.style.display = 'inline-block';
                populateCommunityManagement();
            }

            const pilotManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'Head of Training (COT)'];
            if (pilotManagerRoles.includes(user.role)) {
                if (pilotManagementTabLink) pilotManagementTabLink.style.display = 'inline-block';
                populatePilotManagement();
            }

            document.querySelector('.fade-in')?.classList.add('visible');

        } catch (error) {
            console.error('Error fetching user data:', error);
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }

    // --------------------------
    // ADMIN: Populate Users & Logs
    // --------------------------
    async function populateAdminTools() {
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`, { method: 'GET' });
            renderUserList(users);

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
                        <div><small>Rank: ${user.rank || '—'} • Hours: ${user.flightHours ?? 0}</small></div>
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

    // --------------------------
    // COMMUNITY: events & highlights
    // --------------------------
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

    // --------------------------
    // TAB SWITCHING: ensure listeners (including dynamically created tabs)
    // --------------------------
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

                // If pilot tab activated, refresh pilots
                if (tab.dataset.tab === 'tab-pilots') {
                    populatePilotDatabase();
                }
            });
        });
    }
    attachTabListeners();

    // --------------------------
    // CROPPER LOGIC (unchanged)
    // --------------------------
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
                    responsive: true,
                    restore: true,
                    checkCrossOrigin: true,
                    checkOrientation: true,
                    modal: true,
                    guides: true,
                    highlight: true,
                    autoCrop: true,
                    autoCropArea: 0.9,
                    movable: true,
                    rotatable: true,
                    scalable: true,
                    zoomable: true,
                    zoomOnTouch: true,
                    zoomOnWheel: true,
                    cropBoxMovable: false,
                    cropBoxResizable: false,
                    toggleDragModeOnDblclick: false,
                });
            };
            reader.readAsDataURL(files[0]);
        }
    });

    cancelCropBtn?.addEventListener('click', () => {
        if (cropperModal) cropperModal.style.display = 'none';
        if (cropper) cropper.destroy();
        if (pictureInput) pictureInput.value = ''; // Reset the file input
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

    // --------------------------
    // PROFILE UPDATE
    // --------------------------
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
                // don't set Content-Type for FormData
                body: formData
            });

            showNotification('Profile updated successfully!', 'success');

            if (result.token) localStorage.setItem('authToken', result.token);

            // Update UI with returned user
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

    // --------------------------
    // PASSWORD UPDATE
    // --------------------------
    passwordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match.', 'error');
            return;
        }
        try {
            await safeFetch(`${API_BASE_URL}/api/me/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
            });
            showNotification('Password updated successfully!', 'success');
            passwordForm.reset();
        } catch (error) {
            showNotification(`Password update failed: ${error.message}`, 'error');
        }
    });

    // --------------------------
    // ADD MEMBER (ADMIN) - ensure callsign input exists
    // --------------------------
    if (addMemberForm) {
        // If the form doesn't already have a callsign input, add one
        if (!document.getElementById('new-member-callsign')) {
            const roleEl = document.getElementById('new-member-role');
            const callsignWrapper = document.createElement('div');
            callsignWrapper.innerHTML = `
                <label for="new-member-callsign">Callsign (optional)</label>
                <input id="new-member-callsign" name="callsign" placeholder="e.g. INDGO-01" />
            `;
            // insert callsign input before the submit button or after role if present
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
                const newUser = await safeFetch(`${API_BASE_URL}/api/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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

    // --------------------------
    // EVENT DELEGATION: Admin user actions (delete, role change, set callsign)
    // --------------------------
    if (userListContainer) {
        userListContainer.addEventListener('click', async (e) => {
            const target = e.target;
            // Delete user
            const deleteBtn = target.closest('.delete-user-btn');
            if (deleteBtn) {
                e.preventDefault();
                const userId = deleteBtn.dataset.userid;
                const userName = deleteBtn.dataset.username;
                if (!userId) return;
                if (!confirm(`WARNING: Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}`, {
                        method: 'DELETE'
                    });
                    showNotification('User deleted successfully.', 'success');
                    populateAdminTools();
                } catch (error) {
                    showNotification(`Failed to delete user: ${error.message}`, 'error');
                }
                return;
            }

            // Set callsign button
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
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ callsign })
                    });
                    showNotification(`Callsign ${callsign} assigned.`, 'success');
                    populateAdminTools();
                    populatePilotDatabase(); // keep pilot DB in sync
                } catch (error) {
                    showNotification(`Failed to set callsign: ${error.message}`, 'error');
                }
                return;
            }
        });

        // Role changes (select element change)
        userListContainer.addEventListener('change', async (e) => {
            if (e.target.classList.contains('role-select')) {
                const select = e.target;
                const userId = select.dataset.userid;
                const newRole = select.value;
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}/role`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
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

    // --------------------------
    // COMMUNITY: deletion (events/highlights)
    // --------------------------
    const communityTabContent = document.getElementById('tab-community');
    if (communityTabContent) {
        communityTabContent.addEventListener('click', async (e) => {
            const button = e.target.closest('.delete-user-btn[data-type]');
            if (!button) return;

            e.preventDefault();
            const postId = button.dataset.id;
            const postType = button.dataset.type; // 'event' or 'highlight'
            const postTitle = button.dataset.title;

            if (!confirm(`Are you sure you want to delete the ${postType}: "${postTitle}"?`)) return;

            try {
                await safeFetch(`${API_BASE_URL}/api/${postType}s/${postId}`, {
                    method: 'DELETE'
                });
                const successMessage = `${postType.charAt(0).toUpperCase() + postType.slice(1)} deleted successfully.`;
                showNotification(successMessage, 'success');
                populateCommunityManagement(); // Refresh the list
            } catch (error) {
                showNotification(`Failed to delete ${postType}: ${error.message}`, 'error');
            }
        });
    }

    // --------------------------
    // Community Content Forms (create)
    // --------------------------
    const createEventForm = document.getElementById('create-event-form');
    const createHighlightForm = document.getElementById('create-highlight-form');

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

    // --------------------------
    // LOGOUT
    // --------------------------
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    });

    // --------------------------
    // PILOT DATABASE TAB & UI
    // --------------------------
    function ensurePilotTab() {
        // If tab elements exist already, keep them. Otherwise create them.
        if (!pilotTabLink) {
            // create a tab link (adjust container placement as needed)
            pilotTabLink = document.createElement('button');
            pilotTabLink.id = 'pilot-tab-link';
            pilotTabLink.className = 'tab-link';
            pilotTabLink.dataset.tab = 'tab-pilots';
            pilotTabLink.textContent = 'Pilot Database';
            if (tabsContainer) tabsContainer.appendChild(pilotTabLink); // ensure there's a container in markup
        }

        if (!pilotTabContent) {
            pilotTabContent = document.createElement('div');
            pilotTabContent.id = 'tab-pilots';
            pilotTabContent.className = 'tab-content';
            pilotTabContent.innerHTML = `<div id="pilot-db-container"><p>Loading pilots...</p></div>`;
            // add to main content area (you may need to adjust insertion point)
            const contentWrapper = document.querySelector('.tab-contents') || document.body;
            contentWrapper.appendChild(pilotTabContent);
        }
        attachTabListeners();
    }

    async function populatePilotDatabase() {
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`, { method: 'GET' });
            // Filter for pilots OR anyone with callsign
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
                        <small>Rank: ${p.rank || '—'} • Hours: ${p.flightHours ?? 0}</small>
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newRank })
                });
                showNotification('Pilot rank updated successfully!', 'success');
            } catch (error) {
                showNotification(`Failed to update rank: ${error.message}`, 'error');
                populatePilotManagement();
            }
        }
    });

    // Delegate clicks in pilot DB (callsign update)
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callsign })
            });
            showNotification('Callsign updated successfully.', 'success');
            populateAdminTools();
            populatePilotDatabase();
        } catch (error) {
            showNotification(`Failed to update callsign: ${error.message}`, 'error');
        }
    });

    // --------------------------
    // INITIAL DATA FETCH
    // --------------------------
    fetchUserData();

    // --------------------------
    // Mobile menu logic
    // --------------------------
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
});
