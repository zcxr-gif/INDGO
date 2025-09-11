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
            gravity: "top", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
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
    const pirepHistoryListElem = document.getElementById('pirep-history-list'); // New

    // --- 1. Authentication and Data Fetching ---

    if (!token) {
        window.location.href = 'login.html'; 
        return;
    }

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
            
            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            pilotRankElem.textContent = pilot.rank || 'N/A';
            flightHoursElem.textContent = (pilot.flightHours || 0).toFixed(1);
            
            profilePictureElem.src = pilot.imageUrl || 'default-pfp.png';

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };

    // --- New: Fetch and Display PIREP History ---
    const fetchPirepHistory = async () => {
        if (!pirepHistoryListElem) return;
        pirepHistoryListElem.innerHTML = '<p>Loading history...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/me/pireps`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch PIREP history.');

            const pireps = await response.json();

            if (pireps.length === 0) {
                pirepHistoryListElem.innerHTML = '<p>You have not filed any flight reports yet.</p>';
                return;
            }

            pirepHistoryListElem.innerHTML = pireps.map(p => `
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
            pirepHistoryListElem.innerHTML = `<p class="error-text">${error.message}</p>`;
            console.error('Error fetching PIREP history:', error);
        }
    };
    
    // Initial data load
    fetchPilotData();
    fetchPirepHistory();

    // --- 2. PIREP Form Submission ---
    
    pirepForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = pirepForm.querySelector('.submit-btn');
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(flightData)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to file report.');
            }

            // Modified: Change notification and refresh history
            showNotification('Report submitted for review!', 'success'); 
            pirepForm.reset();
            fetchPirepHistory(); // Refresh the PIREP list
            
            // Removed: Do NOT update flight hours on the client side anymore.
            // This is now handled by the server upon PIREP approval.

        } catch (error) {
            console.error('PIREP submission error:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'File Report';
        }
    });

    // --- 3. Logout Functionality (No changes) ---
    
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500); 
    });
});