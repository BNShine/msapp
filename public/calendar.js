// public/calendar.js

// Define initMap globalmente para ser usada como callback pelo script do Google Maps.
window.initMap = function() {
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
        directionsService = new google.maps.DirectionsService();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Seletores de Elementos ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const techConfigSelect = document.getElementById('tech-config-select');
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');

    // Modais e seus botões
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');
    const timeBlockModal = document.getElementById('time-block-modal');
    const blockSaveBtn = document.getElementById('block-save-btn');
    const blockCancelBtn = document.getElementById('block-cancel-btn');
    const editTimeBlockModal = document.getElementById('edit-time-block-modal');
    const editBlockSaveBtn = document.getElementById('edit-block-save-btn');
    const editBlockCancelBtn = document.getElementById('edit-block-cancel-btn');
    const editBlockDeleteBtn = document.getElementById('edit-block-delete-btn');
    const editBlockRowNumberInput = document.getElementById('edit-block-row-number');
    const editBlockDateInput = document.getElementById('edit-block-date');
    const editBlockStartInput = document.getElementById('edit-block-start-hour');
    const editBlockEndInput = document.getElementById('edit-block-end-hour');
    const editBlockNotesInput = document.getElementById('edit-block-notes');

    // --- 2. Variáveis Globais e Constantes ---
    let allAppointments = [];
    let allTechnicians = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};
    let directionsService; 
    let dayAppointments = []; 
    let orderedClientStops = []; 
    let googleMapsPromise = null;

    const SCHEDULE_DURATION_HOURS = 2;
    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- 3. Funções Auxiliares (Datas, Geo, Formatação) ---

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
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
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

    function fetchGoogleMapsApi() {
        if (googleMapsPromise) return googleMapsPromise;

        googleMapsPromise = new Promise(async (resolve, reject) => {
            if (typeof google !== 'undefined' && typeof google.maps !== 'undefined' && google.maps.DirectionsService) {
                directionsService = new google.maps.DirectionsService();
                return resolve();
            }

            window.initMap = () => {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    directionsService = new google.maps.DirectionsService();
                    resolve();
                } else {
                    reject(new Error('Google Maps API failed to load.'));
                }
            };

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
    
    // --- 4. Funções de Manipulação dos Modais ---

    function openEditModal(appt) {
        const { id, technician, petShowed, percentage, paymentMethod, appointmentDate, serviceShowed, tips, verification } = appt;
        document.getElementById('modal-appt-id').value = id;
        document.getElementById('modal-original-technician').value = technician;
        document.getElementById('modal-pet-showed').value = petShowed || '';
        document.getElementById('modal-percentage').value = percentage || '';
        document.getElementById('modal-payment-method').value = paymentMethod || '';
        document.getElementById('modal-date').value = formatDateTimeForInput(appointmentDate);
        document.getElementById('modal-service-value').value = serviceShowed || '';
        document.getElementById('modal-tips').value = tips || '';
        const verificationSelect = document.getElementById('modal-verification');
        verificationSelect.innerHTML = ["Scheduled", "Showed", "Canceled"].map(opt => 
            `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
    
    function openTimeBlockModal() {
        if (!selectedTechnician) {
            alert('Please select a technician first.');
            return;
        }
        document.getElementById('time-block-form').reset();
        timeBlockModal.classList.remove('hidden');
    }

    function closeTimeBlockModal() {
        timeBlockModal.classList.add('hidden');
    }

    function openEditTimeBlockModal(blockData) {
        editBlockRowNumberInput.value = blockData.rowNumber;
        const [month, day, year] = blockData.date.split('/');
        editBlockDateInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        editBlockStartInput.value = blockData.startHour;
        editBlockEndInput.value = blockData.endHour;
        editBlockNotesInput.value = blockData.notes;
        editTimeBlockModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditTimeBlockModal() {
        if (editTimeBlockModal) editTimeBlockModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    // --- 5. Funções de Manipulação de Dados (API Calls) ---
    
    async function handleSaveAppointment() {
        // ... (código para salvar agendamento)
    }
    
    async function handleSaveTimeBlock() {
        // ... (código para criar time block)
    }

    async function handleUpdateTimeBlock() {
        // ... (código para atualizar time block)
    }

    async function handleDeleteTimeBlock() {
        // ... (código para deletar time block)
    }

    async function fetchAvailabilityForSelectedTech() {
        if (!selectedTechnician) {
            techAvailabilityBlocks = [];
            return;
        }
        try {
            const response = await fetch(`/api/manage-technician-availability?technicianName=${encodeURIComponent(selectedTechnician)}`);
            if (!response.ok) throw new Error('Could not fetch availability.');
            const data = await response.json();
            techAvailabilityBlocks = data.availability || [];
        } catch (error) {
            console.error('Error fetching availability:', error);
            techAvailabilityBlocks = [];
        }
    }

    // --- 6. Funções de Renderização ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        const columnMap = {};
        DAY_NAMES.forEach((dayName, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateKey = formatDateToYYYYMMDD(date);
            columnMap[dateKey] = dayIndex + 2;
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[dateKey];
            header.textContent = `${dayName} ${date.getDate()}`;
            schedulerHeader.appendChild(header);
        });
        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = rowIndex + 1;
            schedulerBody.appendChild(timeDiv);
            Object.keys(columnMap).forEach(dateKey => {
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                emptySlot.style.gridRow = rowIndex + 1;
                emptySlot.style.gridColumn = columnMap[dateKey];
                schedulerBody.appendChild(emptySlot);
            });
        });
        renderAppointments(columnMap);
        renderTimeBlocks(columnMap);
        renderShowedAppointmentsTable();
        updateWeekDisplay();
        renderDayItineraryTable();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }

    function renderAppointments(columnMap) {
        // ... (código para renderizar agendamentos)
    }

    function renderTimeBlocks(columnMap) {
        // ... (código para renderizar time blocks)
    }

    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }
    
    function renderShowedAppointmentsTable() {
        if (!showedAppointmentsTableBody) return;
        showedAppointmentsTableBody.innerHTML = '';
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const appointmentsForWeek = allAppointments.filter(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            return appt.technician === selectedTechnician && apptDate >= currentWeekStart && apptDate < weekEnd;
        }).sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));
        
        if (appointmentsForWeek.length === 0) {
            showedAppointmentsTableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-muted-foreground">No appointments for this technician in the selected week.</td></tr>';
            return;
        }
        
        appointmentsForWeek.forEach(appointment => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50';
            row.dataset.rowId = appointment.id;
            row.innerHTML = `
                <td class="p-4"><input type="datetime-local" value="${formatDateTimeForInput(appointment.appointmentDate)}" style="width: 160px;" class="bg-transparent border border-border rounded-md px-2" data-key="appointmentDate"></td>
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0, 15) + '...' : appointment.customers}</td>
                <td class="p-4">${appointment.code}</td>
                <td class="p-4"><input type="text" value="${appointment.technician}" class="bg-transparent border border-border rounded-md px-2" data-key="technician" disabled></td>
                <td class="p-4"><select style="width: 60px;" class="bg-transparent border border-border rounded-md px-2" data-key="petShowed"><option value="">Pets</option>${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}</select></td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="tips"></td>
                <td class="p-4"><select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="percentage"><option value="">%</option>${["20%", "25%"].map(opt => `<option value="${opt}" ${appointment.percentage === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2" data-key="paymentMethod"><option value="">Select...</option>${["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"].map(opt => `<option value="${opt}" ${appointment.paymentMethod === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification"><option value="">Select...</option>${["Scheduled", "Showed", "Canceled"].map(opt => `<option value="${opt}" ${appointment.verification === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }

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
    
    // --- 7. Lógica de Otimização de Rota (RESTAURADA) ---
    async function runItineraryOptimization(isReversed = false) {
        try {
            await fetchGoogleMapsApi(); // Garante que a API esteja carregada
        } catch (error) {
            itineraryResultsList.innerHTML = `<p class="text-red-600">${error.message}</p>`;
            return;
        }

        if (!directionsService) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Google Maps Service could not be initialized.</p>';
            return;
        }

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

    // --- 8. Inicialização e Event Listeners ---
    async function handleOptimizeItinerary() { await runItineraryOptimization(false); }
    async function handleItineraryReverser() { await runItineraryOptimization(true); }
    function handleDayFilterChange() { renderDayItineraryTable(); }
    async function handleApplyRoute() { /* Placeholder */ }

    async function loadInitialData() {
        try {
            await fetchGoogleMapsApi();
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);
            if (!techDataResponse.ok || !appointmentsResponse.ok) throw new Error('Failed to load initial data.');
            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();
            allTechnicians = techData.technicians || [];
            allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            populateTechSelects(); 
            renderScheduler(); 
        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
        }
    }
    
    function populateTechSelects() {
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techSelectDropdown.appendChild(option.cloneNode(true));
        });
    }
    
    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        selectedTechDisplay.textContent = selectedTechnician || 'No Technician Selected';
        await fetchAvailabilityForSelectedTech();
        renderScheduler(); 
    }

    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
        handleDayFilterChange();
    });
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
        handleDayFilterChange();
    });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal); 
    modalCloseXBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);
    if (dayFilter) dayFilter.addEventListener('change', handleDayFilterChange);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', handleOptimizeItinerary);
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', handleItineraryReverser);
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', handleApplyRoute);

    // Carga Inicial
    loadInitialData();
});
