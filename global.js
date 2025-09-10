// global.js (Fixed and Simplified)

/**
 * Displays a toast notification using Toastify.js.
 * @param {string} message The message to display.
 * @param {string} type The type of notification ('success' or 'error').
 */
function showNotification(message, type = 'success') {
    const backgroundColor = type === 'success' 
        ? 'linear-gradient(to right, #00b09b, #96c93d)' 
        : 'linear-gradient(to right, #ff5f6d, #ffc371)';

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

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const navMenu = document.querySelector('.nav-menu');

    // If a token exists, try to fetch user data and update the navbar.
    // If no token exists, the default "Login" and "Join Us" buttons will remain visible.
    if (token) {
        fetchUserData(token);
    }

    async function fetchUserData(token) {
        try {
            const response = await fetch('https://indgo-backend.onrender.com/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // If the token is invalid or expired, remove it. The default login buttons will show.
            if (!response.ok) {
                localStorage.removeItem('authToken');
                return;
            }

            const user = await response.json();
            updateNavbarForLoggedInUser(user);

        } catch (error) {
            console.error('Error fetching user data for navbar:', error);
            // On error, the default login buttons will remain, which is the desired fallback.
        }
    }

    function updateNavbarForLoggedInUser(user) {
        const loginLi = navMenu.querySelector('.auth-link a[href="login.html"]')?.parentElement;
        const joinLi = navMenu.querySelector('.auth-link a[href="apply.html"]')?.parentElement;

        if (loginLi && joinLi) {
            const welcomeLi = document.createElement('li');
            welcomeLi.className = 'nav-item';
            welcomeLi.innerHTML = `<a href="dashboard.html" class="nav-link">Hello, ${user.name}</a>`;

            const logoutLi = document.createElement('li');
            logoutLi.className = 'nav-item';
            const logoutButton = document.createElement('a');
            logoutButton.href = '#';
            logoutButton.className = 'nav-link nav-button';
            logoutButton.textContent = 'Logout';
            logoutButton.onclick = () => {
                localStorage.removeItem('authToken');
                window.location.href = 'index.html';
            };
            logoutLi.appendChild(logoutButton);

            navMenu.replaceChild(welcomeLi, loginLi);
            navMenu.replaceChild(logoutLi, joinLi);
        }
    }
});