// public/calendar/itinerary.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores de Elementos ---
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');
    const techSelectDropdown = document.getElementById('tech-select-dropdown');

    // --- Variáveis Globais ---
    let allAppointments = [];
    let dayAppointments = [];
    let orderedClientStops = [];
    let directionsService;
    let googleMapsPromise = null;
    let currentWeekStart = getStartOfWeek(new Date());

    // --- Funções Auxiliares (reutilizadas) ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }
    
    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    function parseSheetDate(dateStr) {
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const dateParts = datePart.split('/');
        if (dateParts.length !== 3) return null;
        const [month, day, year] = dateParts.map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    function getTimeHHMM(date) {
        if (!date) return '';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
        const date = new Date(startOfWeekDate);
        date.setDate(startOfWeekDate.getDate() + dayOfWeek);
        return date;
    }

    async function getLatLon(zipCode) {
        if (!zipCode) return [null, null];
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return [null, null];
            const data = await response.json();
            const place = data.places[0];
            return [parseFloat(place.latitude), parseFloat(place.longitude)];
        } catch (error) {
            console.error('Erro ao buscar dados de zip code:', error);
            return [null, null];
        }
    }
    
    function calculateDistance(lat1, lon1, lat2, lon2) {
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    }

    // --- Lógica do Google Maps (CORRIGIDA) ---
    window.initMap = function() {
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            directionsService = new google.maps.DirectionsService();
            if (googleMapsPromise && typeof googleMapsPromise.resolve === 'function') {
                googleMapsPromise.resolve();
            }
        }
    }

    function fetchGoogleMapsApi() {
        if (googleMapsPromise) return googleMapsPromise;

        googleMapsPromise = new Promise(async (resolve, reject) => {
            if (typeof google !== 'undefined' && typeof google.maps !== 'undefined' && google.maps.DirectionsService) {
                directionsService = new google.maps.DirectionsService();
                return resolve();
            }

            // Atribui a função de resolução à promise para que o callback a chame
            googleMapsPromise.resolve = resolve;

            // **NOVA VERIFICAÇÃO DE ERRO**
            // Adiciona um timeout para verificar se a API foi bloqueada
            setTimeout(() => {
                if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                    reject(new Error('Google Maps API failed to load. It might be blocked by an ad-blocker or network issue.'));
                }
            }, 3000); // Espera 3 segundos

            try {
                const response = await fetch('/api/get-google-maps-api-key');
                if (!response.ok) return reject(new Error('Failed to fetch Google Maps API key.'));
                
                const data = await response.json();
                const GOOGLE_MAPS_API_KEY = data.apiKey;

                if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
                    script.onerror = () => reject(new Error('Failed to load the Google Maps script.'));
                    document.head.appendChild(script);
                }
            } catch (error) {
                reject(error);
            }
        });
        return googleMapsPromise;
    }

    // --- Renderização e Lógica da Rota ---
    function renderDayItineraryTable() {
        if (!dayItineraryTableBody) return;
        dayItineraryTableBody.innerHTML = '';
        itineraryResultsList.innerHTML = 'No route calculated.';
        schedulingControls.classList.add('hidden');

        const selectedDayOfWeek = dayFilter.value;
        const selectedTechName = techSelectDropdown.value;

        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        if (!selectedTechName || selectedDayOfWeek === '') {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">Select a day and a technician to view appointments.</td></tr>';
            return;
        }

        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDayOfWeek, 10));
        const dateKey = formatDateToYYYYMMDD(targetDate);

        dayAppointments = allAppointments
            .filter(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const apptDateKey = apptDate ? formatDateToYYYYMMDD(apptDate) : null;
                return appt.technician === selectedTechName && apptDateKey === dateKey;
            })
            .sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));

        if (dayAppointments.length === 0) {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">No appointments found for the selected day.</td></tr>';
            return;
        }

        dayAppointments.forEach(appt => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50';
            const apptDate = parseSheetDate(appt.appointmentDate);
            row.innerHTML = `
                <td class="p-4 font-bold">${getTimeHHMM(apptDate)}</td>
                <td class="p-4">${appt.customers}</td>
                <td class="p-4">${appt.phone || ''}</td>
                <td class="p-4">${appt.zipCode || 'N/A'}</td>
                <td class="p-4">${appt.code || ''}</td>
                <td class="p-4">${appt.verification || ''}</td>
                <td class="p-4">${appt.technician || ''}</td>
            `;
            dayItineraryTableBody.appendChild(row);
        });

        if (dayAppointments.some(appt => appt.zipCode)) {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
    }
    
    async function runItineraryOptimization(isReversed = false) {
        itineraryResultsList.innerHTML = 'Loading Google Maps API...';
        try {
            await fetchGoogleMapsApi();
        } catch (error) {
            itineraryResultsList.innerHTML = `<p class="text-red-600 font-bold">${error.message}</p>`;
            // Habilita os botões novamente em caso de erro
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        if (!directionsService) {
            itineraryResultsList.innerHTML = '<p class="text-red-600 font-bold">Google Maps Service could not be initialized. Please check your internet connection and disable any ad-blockers.</p>';
            return;
        }

        const selectedTechnician = techSelectDropdown.value;
        const techCoverageResponse = await fetch('/api/get-tech-coverage');
        const techCoverageData = techCoverageResponse.ok ? await techCoverageResponse.json() : [];
        const selectedTechObj = techCoverageData.find(t => t.nome === selectedTechnician);
        const originZip = selectedTechObj?.zip_code;

        if (!originZip) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Technician origin Zip Code not found.</p>';
            return;
        }

        itineraryResultsList.innerHTML = 'Calculating route...';
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        const validAppointments = [];
        for (const appt of dayAppointments) {
            if (appt.zipCode) {
                const [lat, lon] = await getLatLon(appt.zipCode);
                if (lat !== null) validAppointments.push({ ...appt, lat, lon });
            }
        }

        if (validAppointments.length < 1) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">No appointments with valid Zip Codes to optimize.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }
        
        const [originLat, originLon] = await getLatLon(originZip);
        if (originLat === null) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Could not get coordinates for technician origin Zip Code.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        let currentLat = originLat, currentLon = originLon;
        let unvisited = [...validAppointments];
        let nearestPath = [];
        while (unvisited.length > 0) {
            let closest = unvisited.reduce((closest, current) => {
                const dist = calculateDistance(currentLat, currentLon, current.lat, current.lon);
                if (dist < closest.minDistance) return { minDistance: dist, client: current };
                return closest;
            }, { minDistance: Infinity, client: null });
            
            nearestPath.push(closest.client);
            currentLat = closest.client.lat;
            currentLon = closest.client.lon;
            unvisited = unvisited.filter(c => c.id !== closest.client.id);
        }

        const stopsForGoogle = isReversed ? [...nearestPath].reverse() : nearestPath;
        orderedClientStops = stopsForGoogle;

        const request = {
            origin: { query: originZip },
            destination: { query: originZip },
            waypoints: stopsForGoogle.map(c => ({ location: { query: c.zipCode } })),
            travelMode: 'DRIVING',
            optimizeWaypoints: !isReversed,
        };

        directionsService.route(request, (response, status) => {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            if (status === 'OK') {
                const route = response.routes[0];
                itineraryResultsList.innerHTML = `<p class="font-bold text-lg">Optimized Route (${isReversed ? 'Farthest First' : 'Nearest First'}):</p>`;
                let totalDuration = 0, totalDistance = 0;
                
                const finalOrder = route.waypoint_order ? route.waypoint_order.map(i => stopsForGoogle[i]) : stopsForGoogle;
                orderedClientStops = finalOrder;

                route.legs.forEach((leg, i) => {
                    const clientName = (finalOrder[i] || {}).customers || 'Destination';
                    itineraryResultsList.innerHTML += `
                        <div class="border-b border-muted py-2">
                            <p class="font-bold text-base">${i + 1}. Go to: ${leg.end_address} (${clientName})</p>
                            <p class="ml-4 text-sm">Travel: ${leg.duration.text} | ${leg.distance.text}</p>
                        </div>
                    `;
                    totalDuration += leg.duration.value;
                    totalDistance += leg.distance.value;
                });
                itineraryResultsList.innerHTML += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Travel: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1000 * 0.621371).toFixed(1)} mi</div>`;
                schedulingControls.classList.remove('hidden');
            } else {
                itineraryResultsList.innerHTML = `<p class="text-red-600">Google Maps Route Request Failed. Status: ${status}.</p>`;
                schedulingControls.classList.add('hidden');
            }
        });
    }


    // --- Inicialização e Event Listeners ---
    async function loadAppointmentData() {
        try {
            const response = await fetch('/api/get-technician-appointments');
            if (!response.ok) throw new Error('Failed to load appointments for itinerary.');
            const data = await response.json();
            allAppointments = (data.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            renderDayItineraryTable();
        } catch (error) {
            console.error('Error loading appointment data for itinerary:', error);
        }
    }
    
    document.addEventListener('technicianChanged', (e) => {
        renderDayItineraryTable();
    });

    document.addEventListener('weekChanged', (e) => {
        currentWeekStart = e.detail.weekStart;
        renderDayItineraryTable();
    });

    if (dayFilter) dayFilter.addEventListener('change', renderDayItineraryTable);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', () => runItineraryOptimization(false));
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', () => runItineraryOptimization(true));
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', () => { /* Lógica para aplicar a rota */ });
    
    loadAppointmentData();
});
