document.addEventListener('DOMContentLoaded', () => {
    // 1. INITIALIZE THE MAP
    const bounds = L.latLngBounds( L.latLng(-85, -180), L.latLng(85, 180) );

// Initialize the map with these solid boundaries
const map = L.map('map-container', {
    zoomControl: false,
    minZoom: 3,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0
}).setView([22.5937, 78.9629], 5);

    const infoPanel = document.getElementById('route-info-container');
    L.DomEvent.on(infoPanel, 'wheel touchstart touchmove', L.DomEvent.stopPropagation);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // 2. DEFINE DATA SOURCES
    const routesSheetURL = 'IndGo Air Virtual Routes - Indgo Air VA.csv';
    const airportsDataURL = 'airports.json';

    // Helper function to extract ICAO code from text
    function extractAirportCode(text) {
        if (!text) return null;
        const match = text.match(/^([A-Z]{4})/);
        return match ? match[1] : text.trim().toUpperCase();
    }

    // Promise to fetch and parse routes
    const fetchRoutes = fetch(routesSheetURL)
        .then(response => response.ok ? response.text() : Promise.reject('Network response was not ok'))
        .then(csvText => {
            const rows = csvText.split('\n').filter(row => {
                const trimmedRow = row.trim();
                if (trimmedRow === '' || trimmedRow.startsWith(',')) return false;
                const firstCol = trimmedRow.split(',')[0].toLowerCase();
                return !['callsign', 'flight number'].includes(firstCol);
            });
            
            return rows.map(row => {
                const cols = row.split(',');
                return {
                    callsign: cols[0]?.trim() || 'N/A',
                    origin: extractAirportCode(cols[1]),
                    destination: extractAirportCode(cols[2]),
                    aircraft: cols[3]?.trim() || 'N/A',
                    distance: cols[4]?.trim() || 'N/A',
                    flightTime: cols[5]?.trim() || 'N/A'
                };
            }).filter(flight => flight.origin && flight.destination);
        });


    // Promise to fetch airport coordinates
    const fetchAirports = fetch(airportsDataURL)
        .then(response => response.ok ? response.json() : Promise.reject('Network response was not ok'));

    // 3. PLOT DATA ONCE BOTH PROMISES RESOLVE
    Promise.all([fetchRoutes, fetchAirports])
        .then(([routes, airports]) => {
            
            const infoContainer = document.getElementById('route-info-container');
            const routeLinesGroup = L.layerGroup().addTo(map);

            // ---- UPDATED FUNCTION: Displays routes in the new accordion panel ----
            function showRoutesForAirport(icao) {
                // Clear any previously drawn routes
                routeLinesGroup.clearLayers();

                // Find all routes connected to this airport
                const relevantRoutes = routes.filter(
                    r => r.origin === icao || r.destination === icao
                );

                if (relevantRoutes.length === 0) {
                    infoContainer.classList.add('hidden');
                    return; // Exit if no routes are found
                }

                // Draw the new route lines on the map
                relevantRoutes.forEach(route => {
                    const departureAirport = airports[route.origin];
                    const arrivalAirport = airports[route.destination];
                    if (departureAirport && arrivalAirport) {
                        const depCoords = [departureAirport.lat, departureAirport.lon];
                        const arrCoords = [arrivalAirport.lat, arrivalAirport.lon];
                        L.polyline([depCoords, arrCoords], {
                            color: '#001B94', // Using the --accent-color from your CSS
                            weight: 2, 
                            opacity: 0.8
                        }).addTo(routeLinesGroup);
                    }
                });

                // A simple plane icon SVG to use in the list
                const planeIconSVG = `<svg class="route-plane-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;

                // ***MODIFIED: Build the HTML for the accordion panel***
                let panelHTML = `
                    <button id="toggle-routes-btn" title="Toggle panel">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
                    </button>
                    <button id="close-routes-btn" title="Close and clear routes">&times;</button>
                    <div class="panel-scroll-content">
                        <h3>Routes for ${icao}</h3>
                        <div class="routes-list-container">
                            <ul>
                                ${relevantRoutes.map(route => `
                                    <li class="route-item">
                                    <div class="route-summary">
                                        <span class="route-airport-code">${route.origin}</span>
                                        ${planeIconSVG}
                                        <span class="route-airport-code">${route.destination}</span>
                                        <span class="route-details-toggle">Details</span>
                                    </div>
                                    <div class="route-details">
                                        <p><span>Callsign:</span> <strong>${route.callsign}</strong></p>
                                        <p><span>Aircraft:</span> <strong>${route.aircraft}</strong></p>
                                        <p><span>Distance:</span> <strong>${route.distance} NM</strong></p>
                                        <p><span>Flight Time:</span> <strong>${route.flightTime}</strong></p>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
                
                infoContainer.innerHTML = panelHTML;
                infoContainer.classList.remove('hidden'); // Show the panel
                infoContainer.classList.remove('collapsed'); // Ensure it's not collapsed when new routes are shown

                // Add a click event to the close button
                document.getElementById('close-routes-btn').addEventListener('click', () => {
                    infoContainer.classList.add('hidden');
                    routeLinesGroup.clearLayers();
                });
                
                // ***NEW: Add a click event for the new toggle button***
                document.getElementById('toggle-routes-btn').addEventListener('click', () => {
                    infoContainer.classList.toggle('collapsed');
                });


                // Add click events to each route summary to toggle the details
                document.querySelectorAll('.route-summary').forEach(summary => {
                    summary.addEventListener('click', () => {
                        // Toggles the 'active' class on the parent '.route-item'
                        summary.closest('.route-item').classList.toggle('active');
                    });
                });
            }

            // ---- INITIAL MAP SETUP ----
            // Get all unique airports that have routes
            const uniqueAirports = new Set(routes.flatMap(r => [r.origin, r.destination]));

            // Draw only the airport markers on the map initially
            uniqueAirports.forEach(icao => {
                const airportData = airports[icao];
                if (airportData) {
                    const marker = L.circleMarker([airportData.lat, airportData.lon], {
                        radius: 5,
                        color: '#001B94',
                        fillColor: '#001B94',
                        fillOpacity: 0.8
                    }).addTo(map);

                    marker.bindPopup(`<div class="airport-popup-title">${icao}</div>${airportData.name}`);
                    
                    // Add the click event to each marker
                    marker.on('click', () => {
                        document.getElementById('map-hint').classList.add('hidden');
                        showRoutesForAirport(icao);
                    });
                }
            });

        })
        .catch(error => {
            console.error("Error loading map data:", error);
            const mapContainer = document.getElementById('map-container');
            mapContainer.innerHTML = '<p style="text-align:center; color:white; padding-top: 50px;">Could not load route map. Please try again later.</p>';
        });
});