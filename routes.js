document.addEventListener('DOMContentLoaded', () => {
    // 1. INITIALIZE THE MAP
const map = L.map('map-container', {
    zoomControl: false // This disables the default zoom buttons in the top-left
}).setView([22.5937, 78.9629], 5);


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
            const rows = csvText.split('\n').filter(row => row.trim() !== '' && !row.startsWith(','));
            return rows.slice(1).map(row => {
                const cols = row.split(',');
                return {
                    origin: extractAirportCode(cols[1]),
                    destination: extractAirportCode(cols[2])
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

            // ---- NEW FUNCTION: Displays routes and info for a clicked airport ----
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
                            color: '#001B94',
                            weight: 2, // Slightly thicker for better visibility
                            opacity: 0.8
                        }).addTo(routeLinesGroup);
                    }
                });

                // Build the HTML table for the info panel
                let tableHTML = `
                    <button id="close-routes-btn">&times;</button>
                    <h3>Routes for ${icao}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Origin</th>
                                <th>Destination</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${relevantRoutes.map(route => `
                                <tr>
                                    <td>${route.origin} (${airports[route.origin]?.name || 'N/A'})</td>
                                    <td>${route.destination} (${airports[route.destination]?.name || 'N/A'})</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                
                infoContainer.innerHTML = tableHTML;
                infoContainer.classList.remove('hidden');

                // Add a click event to the new close button
                document.getElementById('close-routes-btn').addEventListener('click', () => {
                    infoContainer.classList.add('hidden');
                    routeLinesGroup.clearLayers();
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
                        // **FIX ADDED HERE**
                        // Hide the hint when an airport is clicked
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