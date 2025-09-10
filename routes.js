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
    const routesSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7l8lmvc8bUf9smp7qPktT4VZ-LKUQeH3Jvw0H3TpIviZ-oei01gwjLZ-R6ONGGOdtCy64wsYGVgDu/pub?output=csv';
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
            let activeRouteLine = null; // Variable to hold the currently highlighted route

            // ---- UPDATED FUNCTION: Displays routes in the new accordion panel ----
            function showRoutesForAirport(icao) {
                // Clear any previously drawn routes
                routeLinesGroup.clearLayers();
                // **NEW**: Clear the highlighted route line when a new airport is selected
                if (activeRouteLine) {
                    map.removeLayer(activeRouteLine);
                    activeRouteLine = null;
                }

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
                                    <li class="route-item" data-origin="${route.origin}" data-destination="${route.destination}">
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
                    // **NEW**: Also clear the highlighted route line when the panel is closed
                    if (activeRouteLine) {
                        map.removeLayer(activeRouteLine);
                        activeRouteLine = null;
                    }
                });
                
                // ***NEW: Add a click event for the new toggle button***
                document.getElementById('toggle-routes-btn').addEventListener('click', () => {
                    infoContainer.classList.toggle('collapsed');
                });

                // **MODIFIED**: Add click events to each route summary to toggle the details
                // and highlight the specific route on the map.
                document.querySelectorAll('.route-summary').forEach(summary => {
                    summary.addEventListener('click', () => {
                        const parentItem = summary.closest('.route-item');
                        const wasActive = parentItem.classList.contains('active');

                        // Clear any existing active elements and lines first
                        if (activeRouteLine) {
                            map.removeLayer(activeRouteLine);
                            activeRouteLine = null;
                        }
                        document.querySelectorAll('.route-item').forEach(item => item.classList.remove('active'));

                        // If the clicked item was not already active, make it active and draw its route
                        if (!wasActive) {
                            parentItem.classList.add('active');
                            
                            const originICAO = parentItem.dataset.origin;
                            const destinationICAO = parentItem.dataset.destination;
                            const departureAirport = airports[originICAO];
                            const arrivalAirport = airports[destinationICAO];

                            if (departureAirport && arrivalAirport) {
                                const depCoords = [departureAirport.lat, departureAirport.lon];
                                const arrCoords = [arrivalAirport.lat, arrivalAirport.lon];

                                // Create a new highlighted polyline
                                activeRouteLine = L.polyline([depCoords, arrCoords], {
                                    color: '#FF8C00', // A bright orange to stand out
                                    weight: 4,
                                    opacity: 1
                                }).addTo(map);
                            }
                        }
                    });
                });
            }

            // ---- INITIAL MAP SETUP ----
            // Get all unique airports that have routes
            const uniqueAirports = new Set(routes.flatMap(r => [r.origin, r.destination]));

            // Define the hub airports using their ICAO codes
            const hubICAOs = new Set(['VIDP', 'VABB', 'VOBL', 'VECC', 'VOMM', 'VAPO', 'VAGO', 'VIJU']);

            // Draw only the airport markers on the map initially
            uniqueAirports.forEach(icao => {
                const airportData = airports[icao];
                if (airportData) {
                    let markerOptions;

                    // Check if the current airport is a hub
                    if (hubICAOs.has(icao)) {
                        // Style for hubs: orange and slightly larger
                        markerOptions = {
                            radius: 6,
                            color: '#FF8C00',      // Orange outline
                            fillColor: '#FF8C00',   // Orange fill
                            fillOpacity: 1
                        };
                    } else {
                        // Style for regular airports: the original blue
                        markerOptions = {
                            radius: 5,
                            color: '#001B94',
                            fillColor: '#001B94',
                            fillOpacity: 0.8
                        };
                    }

                    const marker = L.circleMarker([airportData.lat, airportData.lon], markerOptions).addTo(map);

                    marker.bindPopup(`<div class="airport-popup-title">${icao}</div>${airportData.name}`);

                    // Add the click event to each marker
                    marker.on('click', () => {
                        document.getElementById('map-hint').classList.add('hidden');
                        showRoutesForAirport(icao);
                    });
                }
            });

            // --- NEW: CHECK FOR HUB IN URL ---
            // This code runs after the map and markers have been set up.
            const urlParams = new URLSearchParams(window.location.search);
            const hubICAOFromURL = urlParams.get('hub');

            if (hubICAOFromURL && airports[hubICAOFromURL]) {
                const hubData = airports[hubICAOFromURL];
                
                // Center the map on the specified hub with a closer zoom
                map.setView([hubData.lat, hubData.lon], 7); 

                // Automatically show the routes for this hub
                showRoutesForAirport(hubICAOFromURL);

                // Hide the initial "click an airport" hint
                document.getElementById('map-hint').classList.add('hidden');
            }
            // --- END OF NEW CODE ---

        })
        .catch(error => {
            console.error("Error loading map data:", error);
            const mapContainer = document.getElementById('map-container');
            mapContainer.innerHTML = '<p style="text-align:center; color:white; padding-top: 50px;">Could not load route map. Please try again later.</p>';
        });
});