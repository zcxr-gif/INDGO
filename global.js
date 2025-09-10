// global.js (Revised with Notification Helper)

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

    // Function to reveal the default login/join buttons.
    const showLoggedOutButtons = () => {
        const authLinks = document.querySelectorAll('.auth-link');
        authLinks.forEach(link => {
            if (link) {
                link.style.display = 'list-item';
            }
        });
    };

    if (token) {
        fetchUserData(token);
    } else {
        showLoggedOutButtons();
    }

    async function fetchUserData(token) {
        try {
            const response = await fetch('https://indgo-backend.onrender.com/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                localStorage.removeItem('authToken');
                showLoggedOutButtons();
                return;
            }

            const user = await response.json();
            updateNavbarForLoggedInUser(user);

        } catch (error) {
            console.error('Error fetching user data for navbar:', error);
            showLoggedOutButtons();
        }
    }

    function updateNavbarForLoggedInUser(user) {
    const navMenu = document.querySelector('.nav-menu');

    // 1. Find the <a> link elements directly.
    const loginLink = navMenu.querySelector('a[href="login.html"]');
    const joinLink = navMenu.querySelector('a[href="apply.html"]');

    // 2. Find their parent <li> elements using .closest(). This is more reliable.
    const loginLi = loginLink ? loginLink.closest('li.auth-link') : null;
    const joinLi = joinLink ? joinLink.closest('li.auth-link') : null;

    // This 'if' check will now pass, and the rest of your code will execute.
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
    } else {
        // This error should no longer appear.
        console.error('Failed to find loginLi or joinLi. Check HTML structure and JS selectors.');
    }
}
});