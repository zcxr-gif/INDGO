// =================================================================
// INDGO AIR VIRTUAL - CONFIGURATION FILE
// =================================================================
// This file centralizes all the important paths, URLs, and settings
// for the website based on the provided file structure.
// =================================================================

const config = {
    // API Endpoints for backend communication
    api: {
        baseUrl: 'http://localhost:5000', 
        endpoints: {
            login: '/api/login',
            users: '/api/users',
            staff: '/api/staff',
            events: '/api/community/events',
            highlights: '/api/community/highlights',
            logs: '/api/admin/logs'
        }
    },
    
    // --- NEW: Paths on the server for uploaded content ---
    serverPaths: {
        // The base path for all uploaded files served by the backend
        uploads: '/uploads/',
        // Sub-folder for staff and user profile pictures
        profiles: '/uploads/profiles/',
        // Sub-folder for community events and highlights images
        community: '/uploads/community/'
    },

    // Internal page paths for navigation and redirects
    pages: {
        home: '/html/index.html',
        login: '/html/login.html',
        apply: '/html/apply.html',
        dashboard: '/html/dashboard.html',
        staff: '/html/staff.html',
        fleet: '/html/fleet.html',
        hubs: '/html/hubs.html',
        ranks: '/html/curriculum.html',
        community: '/html/community.html'
    },

    // Paths to local frontend assets and default images
    assets: {
        logo: '/images/indgo.png',
        planeIcon: '/images/plane.png',
        operations: '/images/operations.png',
        community: '/images/community.png',
        defaultAvatar: '/images/default-avatar.png',
        heroVideo: '/planelanding.mp4',
        // Asset Sub-folders
        airportsFolder: '/images/airports/',
        badgesFolder: '/images/badges/',
        planesFolder: '/images/planes/'
    },
    
    // External links, such as application forms or social media
    externalLinks: {
        pilotApplication: 'https://forms.gle/sFny2qRQhdVuH4sbA',
        staffApplication: 'https://forms.gle/vq3NnQFpLZLhNRnm6',
        youtube: 'https://www.youtube.com/@INDAIR.N',
        discord: 'https://Discordapp.com/users/baigaatifulla',
        instagram: 'https://www.instagram.com/indair.co?igsh=cnZsazJhbXNrcjlm&utm_source=qr',
        infiniteFlightCommunity: 'https://community.infiniteflight.com'
    },

    // General site settings
    site: {
        virtualAirlineName: 'IndGo AIR Virtual',
        copyrightYear: 2025,
        developer: 'ServerNoob'
    }
};