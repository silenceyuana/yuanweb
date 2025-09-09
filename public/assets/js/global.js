// This is a self-invoking function to prevent polluting the global namespace.
(function() {
    // Wait for the DOM to be fully loaded before trying to find and manipulate elements.
    document.addEventListener('DOMContentLoaded', () => {

        // --- 1. Theme Switcher Logic ---
        const themeCheckbox = document.getElementById('theme-checkbox');
        const docElement = document.documentElement; // A more modern approach is to toggle a class on the <html> element.

        // Function to apply the chosen theme.
        const applyTheme = (theme) => {
            if (theme === 'light') {
                docElement.classList.add('light-mode');
                if (themeCheckbox) themeCheckbox.checked = false; // Light mode = unchecked
            } else {
                docElement.classList.remove('light-mode');
                if (themeCheckbox) themeCheckbox.checked = true; // Dark mode = checked
            }
        };

        // This relies on `theme-sync.js` for the initial flicker-free load.
        // This part ensures the checkbox toggle is in the correct state when the page loads.
        const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(currentTheme);

        // Add an event listener to the checkbox to handle theme changes.
        if (themeCheckbox) {
            themeCheckbox.addEventListener('change', () => {
                const newTheme = themeCheckbox.checked ? 'dark' : 'light';
                localStorage.setItem('theme', newTheme);
                applyTheme(newTheme);
            });
        }

        // --- 2. Mobile Navigation (Hamburger Menu) Logic ---
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const navItems = document.getElementById('nav-items');

        if (hamburgerMenu && navItems) {
            hamburgerMenu.addEventListener('click', () => {
                navItems.classList.toggle('active');
            });
        }

        // --- 3. Authentication UI Management ---
        const loginButton = document.getElementById('login-button');
        const userDropdown = document.getElementById('user-dropdown');
        const userDropdownToggle = document.getElementById('user-dropdown-toggle');
        const dropdownMenu = document.getElementById('dropdown-menu');
        const userEmailSpan = document.getElementById('user-email');
        const logoutButton = document.getElementById('logout-button');
        const ticketButton = document.getElementById('ticket-button');

        // Function to update the navigation bar based on login state.
        function updateNavUI(userInfo) {
            if (loginButton && userDropdown && userEmailSpan) {
                if (userInfo && userInfo.email) {
                    // --- Logged-in state ---
                    loginButton.style.display = 'none';
                    userDropdown.style.display = 'block';
                    // Prioritize showing the username, fall back to the email if it doesn't exist.
                    userEmailSpan.textContent = userInfo.username || userInfo.email; 
                    if (ticketButton) {
                        // The ticket button in the contact section should only be visible to logged-in users.
                        ticketButton.style.display = 'inline-block'; 
                    }
                } else {
                    // --- Logged-out state ---
                    loginButton.style.display = 'block';
                    userDropdown.style.display = 'none';
                    if (ticketButton) {
                        ticketButton.style.display = 'none'; 
                    }
                }
            }
        }

        // Function to handle user logout.
        function logout() {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userInfo');
            window.location.reload(); // Reload the page to reflect the logged-out state.
        }

        // Logic for toggling the user dropdown menu.
        if (userDropdownToggle && dropdownMenu) {
            userDropdownToggle.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent the window click listener from closing it immediately.
                dropdownMenu.classList.toggle('show');
            });
        }

        // Add click listener for the logout button.
        if (logoutButton) {
            logoutButton.addEventListener('click', (event) => {
                event.preventDefault();
                logout();
            });
        }
        
        // Add a global click listener to close the dropdown when clicking anywhere else on the page.
        window.addEventListener('click', (event) => {
            if (dropdownMenu && dropdownMenu.classList.contains('show')) {
                if (!userDropdown.contains(event.target)) {
                    dropdownMenu.classList.remove('show');
                }
            }
        });

        // Main function to check the login status when any page loads.
        function checkLoginStatus() {
            const userInfoStr = localStorage.getItem('userInfo');
            const userToken = localStorage.getItem('userToken');
            
            if (userInfoStr && userToken) {
                try {
                    const userInfo = JSON.parse(userInfoStr);
                    updateNavUI(userInfo);
                } catch (e) {
                    // If userInfo in localStorage is corrupted, log the user out.
                    console.error("Failed to parse user info from localStorage", e);
                    logout();
                }
            } else {
                updateNavUI(null); // Explicitly set the UI to the logged-out state.
            }
        }

        // Run the login check on every page that includes this script.
        checkLoginStatus();
    });
})();