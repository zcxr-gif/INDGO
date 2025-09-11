document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- Notification Function (to match staff dashboard) ---
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
    
    // --- 1. Authentication and Data Fetching ---

    if (!token) {
        window.location.href = 'login.html'; 
        return;
    }

    const fetchPilotData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
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
            
            if (pilot.imageUrl) {
                profilePictureElem.src = pilot.imageUrl;
            } else {
                profilePictureElem.src = 'default-pfp.png'; 
            }

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };
    
    fetchPilotData();

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

            showNotification('Flight report filed successfully!', 'success'); 
            pirepForm.reset();
            
            const currentHours = parseFloat(flightHoursElem.textContent);
            const newHours = currentHours + parseFloat(flightData.flightTime);
            flightHoursElem.textContent = newHours.toFixed(1);

        } catch (error) {
            console.error('PIREP submission error:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'File Report';
        }
    });

    // --- 3. Logout Functionality ---
    
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'info');
        
        // Delay redirect to allow notification to be seen
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500); 
    });
});