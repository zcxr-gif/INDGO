// dashboard.js (Corrected for AWS S3 URLs)

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
    const logoutBtn = document.getElementById('logout-btn');

    // Profile Card Elements
    const profileCardPicture = document.getElementById('profile-card-picture');
    const profileCardName = document.getElementById('profile-card-name');
    const profileCardRole = document.getElementById('profile-card-role');
    const profileCardBio = document.getElementById('profile-card-bio');

    // Tab Elements
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // NEW: Admin Panel Containers
    const userListContainer = document.getElementById('user-list-container');
    const logContainer = document.getElementById('log-container');

    // NEW: Community Management Containers
    const manageEventsContainer = document.getElementById('manage-events-container');
    const manageHighlightsContainer = document.getElementById('manage-highlights-container');

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

    // --- Main Function to Fetch User Data ---
    async function fetchUserData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

            if (!response.ok) throw new Error('Could not fetch user data.');

            const user = await response.json();
            currentUserId = user._id;

            welcomeMessage.textContent = `Welcome, ${user.name}!`;
            document.getElementById('profile-name').value = user.name;
            document.getElementById('profile-bio').value = user.bio || '';

            document.getElementById('profile-discord').value = user.discord || '';
            document.getElementById('profile-ifc').value = user.ifc || '';
            document.getElementById('profile-youtube').value = user.youtube || '';
            document.getElementById('profile-preferred').value = user.preferredContact || 'none';

            profileCardName.textContent = user.name;
            profileCardBio.textContent = user.bio || 'Your bio will appear here once you\'ve set it.';
            profileCardRole.textContent = user.role.toUpperCase();
            
            // ## CHANGE 1: Use the S3 URL directly ##
            profileCardPicture.src = user.imageUrl
                ? user.imageUrl // No longer prepending http://localhost:5000
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=120`;

            // Show admin tools only if user has the base 'admin' role
            if (user.role === 'admin') {
                adminTabLink.style.display = 'inline-block';
                populateAdminTools();
            }

            const authorizedRoles = ['Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'admin', 'Chief Marketing Officer (CMO)', 'Events Manager (EM)'];
            if (authorizedRoles.includes(user.role)) {
                communityTabLink.style.display = 'inline-block';
                populateCommunityManagement();
            }

            document.querySelector('.fade-in').classList.add('visible');

        } catch (error) {

            console.error('Error fetching user data:', error);
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }

    // --- NEW: Admin Panel Functions ---
    async function populateAdminTools() {
        try {
            const usersResponse = await fetch(`${API_BASE_URL}/api/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await usersResponse.json();
            renderUserList(users);

            const logsResponse = await fetch(`${API_BASE_URL}/api/logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const logs = await logsResponse.json();
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
                <div class="user-manage-card">
                    <div class="user-info">
                        <strong>${user.name}</strong>
                        <small>${user.email}</small>
                    </div>
                    <div class="user-controls">
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

        if (logs.length === 0) {
            logContainer.innerHTML = '<p>No administrative actions have been logged yet.</p>';
            return;
        }

        const logEntries = logs.map(log => `
            <div class="log-entry">
                <p><strong>Action:</strong> ${log.action.replace('_', ' ')}</p>
                <p><strong>Admin:</strong> ${log.adminUser.name} (${log.adminUser.email})</p>
                <p><strong>Details:</strong> ${log.details}</p>
                <small>${new Date(log.timestamp).toLocaleString()}</small>
            </div>
        `).join('');

        logContainer.innerHTML = logEntries;
    }

    // --- NEW: Community Content Management Functions ---
    async function populateCommunityManagement() {
        if (!manageEventsContainer || !manageHighlightsContainer) return;

        try {
            // Fetch and render events
            const eventsRes = await fetch(`${API_BASE_URL}/api/events`);
            const events = await eventsRes.json();
            renderManagementList(events, manageEventsContainer, 'event');

            // Fetch and render highlights
            const highlightsRes = await fetch(`${API_BASE_URL}/api/highlights`);
            const highlights = await highlightsRes.json();
            renderManagementList(highlights, manageHighlightsContainer, 'highlight');

        } catch (error) {
            console.error('Failed to populate community management lists:', error);
            manageEventsContainer.innerHTML = '<p style="color:red;">Could not load events.</p>';
            manageHighlightsContainer.innerHTML = '<p style="color:red;">Could not load highlights.</p>';
        }
    }

    function renderManagementList(items, container, type) {
        if (items.length === 0) {
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

    // --- Tab Switching Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- Event Listeners for Forms and Admin Actions ---

    // --- START: NEW CROPPER LOGIC ---
    pictureInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const reader = new FileReader();
            reader.onload = () => {
                imageToCrop.src = reader.result;
                cropperModal.style.display = 'flex';

                if (cropper) {
                    cropper.destroy();
                }

                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1 / 1, // For a perfect circle/square
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

    cancelCropBtn.addEventListener('click', () => {
        cropperModal.style.display = 'none';
        if (cropper) {
            cropper.destroy();
        }
        pictureInput.value = ''; // Reset the file input
    });

    cropAndSaveBtn.addEventListener('click', () => {
        if (cropper) {
            // Get the cropped image as a Blob
            cropper.getCroppedCanvas({
                width: 250, // Define the output size
                height: 250
            }).toBlob((blob) => {
                croppedImageBlob = blob; // Store the blob

                // Optional: Show a preview of the cropped image
                const previewUrl = URL.createObjectURL(blob);
                profileCardPicture.src = previewUrl; // Update the side card immediately

                cropperModal.style.display = 'none';
                cropper.destroy();
                pictureInput.value = ''; // Reset file input
                showNotification('Picture ready to be saved.', 'info');
            }, 'image/jpeg');
        }
    });

    // Profile Update Form
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('name', document.getElementById('profile-name').value);
        formData.append('bio', document.getElementById('profile-bio').value);

        formData.append('discord', document.getElementById('profile-discord').value);
        formData.append('ifc', document.getElementById('profile-ifc').value);
        formData.append('youtube', document.getElementById('profile-youtube').value);
        formData.append('preferredContact', document.getElementById('profile-preferred').value);

        if (croppedImageBlob) {
            formData.append('profilePicture', croppedImageBlob, 'profile.jpg');
        }

        try {
            const response = await fetch('${API_BASE_URL}/api/me', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'An unknown error occurred.');
            }

            showNotification('Profile updated successfully!', 'success');

            if (result.token) {
                localStorage.setItem('authToken', result.token);
            }

            // Manually update the UI with the fresh user data from the response
            const user = result.user;
            welcomeMessage.textContent = `Welcome, ${user.name}!`;
            profileCardName.textContent = user.name;
            profileCardBio.textContent = user.bio || 'Your bio will appear here once you\'ve set it.';
            if (user.imageUrl) {
                // ## CHANGE 2: Use the S3 URL directly and add cache-busting ##
                profileCardPicture.src = `${user.imageUrl}?${new Date().getTime()}`;
            }

            croppedImageBlob = null; // Reset the blob after successful upload

        } catch (error) {
            showNotification(`Update failed: ${error.message}`, 'error');
        }
    });

    // Password Change Form
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/me/password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword })
            });

            if (!response.ok) throw new Error(await response.json().then(d => d.message));

            showNotification('Password updated successfully!', 'success');
            passwordForm.reset();
        } catch (error) {
            showNotification(`Password update failed: ${error.message}`, 'error');
        }
    });

    // Add New Member Form (Admin)
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('new-member-email').value;
            const password = document.getElementById('new-member-password').value;
            const role = document.getElementById('new-member-role').value;

            try {
                const response = await fetch(`${API_BASE_URL}/api/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ email, password, role })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                showNotification('User created successfully!', 'success');
                addMemberForm.reset();
                populateAdminTools();
            } catch (error) {
                showNotification(`Failed to create user: ${error.message}`, 'error');
            }
        });
    }

    // Event Delegation for User Role/Delete actions
    if (userListContainer) {
        userListContainer.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('delete-user-btn') || target.closest('.delete-user-btn')) {
                e.preventDefault();
                const button = target.closest('.delete-user-btn');
                const userId = button.dataset.userid;
                const userName = button.dataset.username;

                if (confirm(`WARNING: Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message);
                        showNotification('User deleted successfully.', 'success');
                        populateAdminTools();
                    } catch (error) {
                        showNotification(`Failed to delete user: ${error.message}`, 'error');
                    }
                }
            }
        });

        userListContainer.addEventListener('change', async (e) => {
            if (e.target.classList.contains('role-select')) {
                const select = e.target;
                const userId = select.dataset.userid;
                const newRole = select.value;
                try {
                    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/role`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ newRole })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);
                    showNotification('User role updated successfully.', 'success');
                    populateAdminTools();
                } catch (error) {
                    showNotification(`Failed to update role: ${error.message}`, 'error');
                    populateAdminTools();
                }
            }
        });
    }

    // NEW: Event Delegation for Community Post Deletion
    const communityTabContent = document.getElementById('tab-community');
    if (communityTabContent) {
        communityTabContent.addEventListener('click', async (e) => {
            const button = e.target.closest('.delete-user-btn[data-type]');
            if (!button) return;

            e.preventDefault();
            const postId = button.dataset.id;
            const postType = button.dataset.type; // 'event' or 'highlight'
            const postTitle = button.dataset.title;

            if (confirm(`Are you sure you want to delete the ${postType}: "${postTitle}"?`)) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/${postType}s/${postId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);

                    const successMessage = `${postType.charAt(0).toUpperCase() + postType.slice(1)} deleted successfully.`;
                    showNotification(successMessage, 'success');
                    populateCommunityManagement(); // Refresh the list
                } catch (error) {
                    showNotification(`Failed to delete ${postType}: ${error.message}`, 'error');
                }
            }
        });
    }

    // Logout Button
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    });

    // Community Content Forms
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
            if (eventImageInput.files[0]) {
                formData.append('eventImage', eventImageInput.files[0]);
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/events`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

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
            formData.append('highlightImage', document.getElementById('highlight-image').files[0]);

            try {
                const response = await fetch(`${API_BASE_URL}/api/highlights`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                showNotification('Highlight posted successfully!', 'success');
                createHighlightForm.reset();
                populateCommunityManagement();
            } catch (error) {
                showNotification(`Failed to post highlight: ${error.message}`, 'error');
            }
        });
    }

    // --- Initial data fetch ---
    fetchUserData();

    // Mobile menu logic
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
});