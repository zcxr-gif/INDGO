document.addEventListener('DOMContentLoaded', () => {
    let map;
    let airportsData;
    const rosterLayers = {}; // To store layers (polylines) for each roster
    
    // Define styles for the routes
    const defaultStyle = { color: '#8a93a2', weight: 2, opacity: 0.6, dashArray: '5, 10' };
    const highlightStyle = { color: '#0055ff', weight: 4, opacity: 1 };

    // Initialize the map once
    function initializeMap() {
        if (map) return;
        map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
    }

    // Load airport data from the API
    async function loadAirportsData() {
        if (airportsData) return;
        try {
            const response = await fetch('https://indgo-backend.onrender.com/api/airports');
            if (!response.ok) throw new Error('Failed to load airport data');
            airportsData = await response.json();
        } catch (error) {
            console.error('Error loading airport data:', error);
        }
    }

    // Function to clear all previously plotted routes
    function clearAllRosterLayers() {
        Object.values(rosterLayers).forEach(layers => {
            layers.forEach(layer => map.removeLayer(layer));
        });
        for (const key in rosterLayers) {
            delete rosterLayers[key];
        }
    }

    // Main function to plot all available rosters
    window.plotRosters = async function(pilotLocation, rosters) {
        initializeMap();
        clearAllRosterLayers();
        await loadAirportsData();

        if (!airportsData) {
            console.error("Airports data is not available.");
            return;
        }

        const plottedAirports = new Set(); // To avoid duplicate airport markers

        rosters.forEach(roster => {
            rosterLayers[roster._id] = [];
            roster.legs.forEach(leg => {
                const dep = airportsData[leg.departure];
                const arr = airportsData[leg.arrival];

                if (dep && arr) {
                    const latlngs = [[dep.lat, dep.lon], [arr.lat, arr.lon]];
                    const polyline = L.polyline(latlngs, defaultStyle).addTo(map);
                    rosterLayers[roster._id].push(polyline);

                    // Add markers for airports if not already added
                    [dep, arr].forEach(airport => {
                        if (!plottedAirports.has(airport.icao)) {
                            L.marker([airport.lat, airport.lon])
                                .addTo(map)
                                .bindPopup(`<b>${airport.icao}</b><br>${airport.name}`);
                            plottedAirports.add(airport.icao);
                        }
                    });
                }
            });
        });

        // Center the map on the pilot's location
        const pilotAirport = airportsData[pilotLocation];
        if (pilotAirport) {
            map.setView([pilotAirport.lat, pilotAirport.lon], 5);
        }
    };

    // Resets all routes to the default style
    window.resetHighlights = function() {
        Object.values(rosterLayers).forEach(layers => {
            layers.forEach(polyline => polyline.setStyle(defaultStyle));
        });
    };
    
    // Highlights a specific roster's route
    window.highlightRoster = function(rosterId) {
        resetHighlights(); // First, reset all other highlights

        const layersToHighlight = rosterLayers[rosterId];
        if (!layersToHighlight || layersToHighlight.length === 0) return;

        const featureGroup = L.featureGroup(layersToHighlight);
        layersToHighlight.forEach(polyline => {
            polyline.setStyle(highlightStyle).bringToFront();
        });

        // Zoom and pan the map to fit the highlighted route
        map.fitBounds(featureGroup.getBounds().pad(0.1));
    };

    // Initial load of airport data when script loads
    loadAirportsData();
});