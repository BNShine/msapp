// public/calendar.js

// Define initMap globalmente para ser usada como callback pelo script do Google Maps.
window.initMap = function() {
    // A visualização do mapa foi removida, mas o DirectionsService precisa ser inicializado
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
        directionsService = new google.maps.DirectionsService();
        console.log('[MAP LOG 4/4 SUCESSO] Google Directions Service initialized.');
    } else {
        console.error('[MAP LOG 4/4 FALHA] Google object not available in initMap. Check network status for script.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const techConfigSelect = document.getElementById('tech-config-select');
    const availabilityFormContainer = document.getElementById('availability-form-container');
    const saveAvailabilityBtn = document.getElementById('save-availability-btn');
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');

    // Modal de Edição de Agendamento
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalVerificationSelect = document.getElementById('modal-verification');
    const modalApptId = document.getElementById('modal-appt-id');
    const modalDate = document.getElementById('modal-date');
    const modalServiceValue = document.getElementById('modal-service-value');
    const modalTips = document.getElementById('modal-tips');
    const modalOriginalTechnician = document.getElementById('modal-original-technician');
    const modalPetShowed = document.getElementById('modal-pet-showed');
    const modalPercentage = document.getElementById('modal-percentage');
    const modalPaymentMethod = document.getElementById('modal-payment-method');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');

    // Modal de Bloco de Tempo
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');
    const timeBlockModal = document.getElementById('time-block-modal');
    const blockSaveBtn = document.getElementById('block-save-btn');
    const blockCancelBtn = document.getElementById('block-cancel-btn');

    // START NEW SELECTORS
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');
    // END NEW SELECTORS

    let allAppointments = [];
    let allTechnicians = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};
    let GOOGLE_MAPS_API_KEY = null;
    let directionsService; 
    let dayAppointments = []; 
    let orderedClientStops = []; 

    const SCHEDULE_DURATION_HOURS = 2; // CORRECT CONSTANT NAME
    const SLOT_HEIGHT_PX = 60;

    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`); // 07:00 to 21:00
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [0, 1, 2, 3, 4, 5, 6];
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];
    
    const petOptions = Array.from({ length: 10 }, (_, i) => i + 1);
    const percentageOptions = ["20%", "25%"];
    const paymentOptions = ["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"];
    
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- Geocoding and Distance Helpers (FROM quick-routes.js) ---
    async function getLatLon(zipCode) {
        if (!zipCode) return [null, null];
        try {
            // API pública para consulta de Zip Codes dos EUA
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

    // --- Google Maps API Key/Script Injection ---
    async function fetchGoogleMapsApiKey() {
        if (GOOGLE_MAPS_API_KEY) return;
        try {
            const response = await fetch('/api/get-google-maps-api-key');
            if (response.ok) {
                const data = await response.json();
                GOOGLE_MAPS_API_KEY = data.apiKey;
                
                // Inject script only if it's not present (CRITICAL FIX FOR DIRECTIONS SERVICE)
                if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                    const script = document.createElement('script');
                    // Injeta APENAS a API Maps JavaScript para usar o DirectionsService
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
                    script.async = true;
                    script.defer = true;
                    document.head.appendChild(script);
                    console.log('[MAP LOG 3/4] Script injected. Waiting for callback (initMap)...');
                } else {
                    window.initMap(); // Call it immediately if API is already loaded
                    console.log('[MAP LOG 3/4] Script already loaded. Calling initMap directly.');
                }
            } else {
                console.error('Falha ao buscar a chave da API do Google Maps.');
                alert('Erro CRÍTICO: Não foi possível carregar a chave GOOGLE_MAPS_API_KEY. Verifique as variáveis de ambiente.');
            }
        } catch (error) {
            console.error('Erro ao buscar a chave da API do Google Maps:', error);
        }
    }
    // --- End Google Maps Logic ---

    // --- Date/Time Helpers ---

    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
        const date = new Date(startOfWeekDate);
        date.setDate(startOfWeekStart.getDate() + dayOfWeek);
        return date;
    }

    // --- Funções Auxiliares (Existentes e Reutilizadas) ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    function formatDateToYYYYMMDD(date) {
        // Output for internal grid mapping: YYYY/MM/DD
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    // MODIFICATION 2: Correct parsing for MM/DD/YYYY HH:MM format from API (now tolerates unpadded strings)
    function parseSheetDate(dateStr) {
        if (!dateStr) return null; 
        const [datePart, timePart] = dateStr.split(' ');
        
        if (!datePart || !timePart) return null; 

        // Expected Input: MM/DD/YYYY HH:MM (or M/D/YYYY H:MM)
        const dateParts = datePart.split('/');
        const timeParts = timePart.split(':');

        if (dateParts.length !== 3 || timeParts.length < 2) return null;
        
        const month = Number(dateParts[0]);
        const day = Number(dateParts[1]);
        const year = Number(dateParts[2]);
        const hour = Number(timeParts[0]);
        const minute = Number(timeParts[1]);
        
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;

        // Note: Month is 0-indexed in Date constructor (month - 1)
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function getTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    // MODIFICATION 3 (CRITICAL FIX): Format from MM/DD/YYYY HH:MM to YYYY-MM-DDTHH:MM (ensuring 2 digits for hours/minutes)
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        // Input: MM/DD/YYYY HH:MM (from API/Sheet)
        // Output: YYYY-MM-DDThh:mm (for HTML input)

        const [datePart, timePart] = dateTimeStr.split(' ');
        if (!datePart || !timePart) return '';

        const [month, day, year] = datePart.split('/');
        const [hour, minute] = timePart.split(':').map(Number);
        
        if (year && month && day) {
             const paddedHour = String(hour).padStart(2, '0'); // CRITICAL: Pad hour
             const paddedMinute = String(minute).padStart(2, '0'); // CRITICAL: Pad minute
             
             // Convert MM/DD/YYYY to YYYY-MM-DD and combine with padded time
            return `${year}-${month}-${day}T${paddedHour}:${paddedMinute}`; 
        }
        return '';
    }

    // --- Marker Management Helper ---
    function clearCustomMarkers() {
        // Marcadores customizados removidos, esta função fica vazia
    }

    // --- Funções do Modal de Edição de Agendamento ---
    function openEditModal(appt) {
        modalApptId.value = appt.id;
        modalOriginalTechnician.value = appt.technician;
        modalPetShowed.value = appt.petShowed || '';
        modalPercentage.value = appt.percentage || '';
        modalPaymentMethod.value = appt.paymentMethod || '';
        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';
        modalTips.value = appt.tips || '';
        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${appt.verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    function handleEditAppointmentClick(event) {
        const block = event.currentTarget;
        const apptId = block.dataset.id;
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        if (localAppt) openEditModal(localAppt);
    }
    
    async function handleSaveAppointment(event) {
        event.stopPropagation();
        modalSaveBtn.textContent = 'Salvando...';
        modalSaveBtn.disabled = true;
        
        const appointmentDateLocal = modalDate.value; // YYYY-MM-DDTHH:MM
        // MODIFICATION 4: Convert HTML input to API target format (MM/DD/YYYY HH:MM)
        const [datePart, timePart] = appointmentDateLocal.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`; 

        const dataToUpdate = {
            rowIndex: parseInt(modalApptId.value, 10),
            appointmentDate: apiFormattedDate,
            verification: modalVerificationSelect.value,
            serviceShowed: modalServiceValue.value,
            tips: modalTips.value,
            technician: modalOriginalTechnician.value,
            petShowed: modalPetShowed.value || '',
            percentage: modalPercentage.value || '',
            paymentMethod: modalPaymentMethod.value || '',
        };
        
        // MODIFICATION 5: Add Hour Validation to Modal Save
        const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
        const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);
        
        const MIN_HOUR = 7; // REPETIDO PARA SEGURANÇA
        const MAX_HOUR = 21; // REPETIDO PARA SEGURANÇA

        if (hour < MIN_HOUR || hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) {
            alert(`Save Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
            modalSaveBtn.textContent = 'Save Changes';
            modalSaveBtn.disabled = false;
            return;
        }
        // END MODIFICATION 5

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const localAppt = allAppointments.find(a => String(a.id) === modalApptId.value);
            if(localAppt) {
                localAppt.appointmentDate = apiFormattedDate;
                localAppt.verification = dataToUpdate.verification;
                localAppt.serviceShowed = dataToUpdate.serviceShowed;
                localAppt.tips = dataToUpdate.tips;
            }

            modalSaveBtn.textContent = 'Salvo!';
            setTimeout(() => {
                closeEditModal();
                modalSaveBtn.textContent = 'Save Changes';
                modalSaveBtn.disabled = false;
                renderScheduler();
            }, 1000);

        } catch (error) {
            console.error('Erro na API ao salvar:', error);
            modalSaveBtn.textContent = 'Erro!';
            modalSaveBtn.style.backgroundColor = 'hsl(0 84.2% 60.2%)';
            setTimeout(() => {
                modalSaveBtn.textContent = 'Save Changes';
                modalSaveBtn.disabled = false;
                modalSaveBtn.style.backgroundColor = '';
            }, 2500);
        }
    }

    // --- Funções do Modal de Bloco de Tempo ---
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

    async function handleSaveTimeBlock() {
        const dateValue = document.getElementById('block-date').value;
        const startHourValue = document.getElementById('block-start-hour').value;
        const endHourValue = document.getElementById('block-end-hour').value;

        if (!dateValue || !startHourValue || !endHourValue) {
            alert('Date, Start Time, and End Time are required.');
            return;
        }

        const data = {
            technicianName: selectedTechnician,
            date: dateValue.replace(/-/g, '/'),
            startHour: startHourValue,
            endHour: endHourValue,
            notes: document.getElementById('block-notes').value,
        };
        
        // MODIFICATION 6: Convert YYYY/MM/DD (from date input) to MM/DD/YYYY for API/Sheets
        const [year, month, day] = data.date.split('/');
        data.date = `${month}/${day}/${year}`;

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            await fetchAvailabilityForSelectedTech();
            renderScheduler();
            closeTimeBlockModal();
            alert('Time block saved!');

        } catch (error) {
            console.error('Error saving time block:', error);
            alert(`Error: ${error.message}`);
        }
    }
    
    // --- Lógica Principal de Renderização ---
    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        const columnMap = {};
        
        VISIBLE_DAY_INDICES.forEach((dayIndex, colIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateKey = formatDateToYYYYMMDD(date);
            columnMap[dateKey] = colIndex + 2;
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[dateKey];
            header.textContent = `${DAY_NAMES[dayIndex]} ${date.getDate()}`;
            schedulerHeader.appendChild(header);
        });
        
        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = rowIndex + 1;
            schedulerBody.appendChild(timeDiv);
            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + dayIndex);
                const dateKey = formatDateToYYYYMMDD(date);
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
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        updateWeekDisplay();
        
        // New feature: Render the day itinerary table after scheduler load
        renderDayItineraryTable();
    }
    
    function renderAppointments(columnMap) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician === selectedTechnician);

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;
            const dateKey = formatDateToYYYYMMDD(apptDate);
            const colIndex = columnMap[dateKey];
            if (!colIndex) return;

            // MODIFICATION 3: Change start hour check and offset
            const startHour = apptDate.getHours();
            const MIN_HOUR = 7;
            const MAX_HOUR = 21;
            if (startHour < MIN_HOUR || startHour > MAX_HOUR) return;
            
            const topOffset = (startHour - MIN_HOUR) * SLOT_HEIGHT_PX + apptDate.getMinutes(); 
            // END MODIFICATION 3

            const block = document.createElement('div');
            let bgColor = 'bg-custom-primary';
            if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
            else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
            
            block.className = `appointment-block ${bgColor} text-white rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.style.gridColumnStart = colIndex;
            block.style.top = `${topOffset}px`;

            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000); 
            block.innerHTML = `<div data-view-content>
                <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                <p class="text-sm font-bold truncate">${appt.customers}</p>
                <p class="text-xs font-medium text-white/80">${appt.verification}</p>
                <p class="text-xs font-medium text-white/80">Service: $${appt.serviceShowed || '0.00'}</p>
                <p class="text-xs font-medium text-white/80">Tips: $${appt.tips || '0.00'}</p>
            </div>`;
            
            schedulerBody.appendChild(block);
            block.addEventListener('click', handleEditAppointmentClick);
        });
    }

    function renderTimeBlocks(columnMap) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const MIN_HOUR = 7; // REPETIDO PARA SEGURANÇA

        techAvailabilityBlocks.forEach(block => {
            if (!block || typeof block.date !== 'string' || block.date.trim() === '') {
                return;
            }
            
            // MODIFICATION 7: Ensure block.date is parsed as MM/DD/YYYY
            const parts = block.date.split('/');
            if (parts.length !== 3) return; 
            const [M, D, Y] = parts;
            const blockDate = new Date(`${Y}-${M}-${D}T00:00:00`); // YYYY-MM-DD for constructor

            if (isNaN(blockDate.getTime())) return; // Ignora datas inválidas

            if (blockDate < currentWeekStart || blockDate >= weekEnd) return;

            const dateKey = formatDateToYYYYMMDD(blockDate);
            const colIndex = columnMap[dateKey];
            if (!colIndex) return;

            const [startH, startM] = block.startHour.split(':').map(Number);
            const [endH, endM] = block.endHour.split(':').map(Number);
            
            // MODIFICATION 4: Change offset for Time Blocks
            const topOffset = ((startH - MIN_HOUR) * SLOT_HEIGHT_PX) + (startM / 60 * SLOT_HEIGHT_PX);
            // END MODIFICATION 4

            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            const height = (durationMinutes / 60) * SLOT_HEIGHT_PX;

            const blockEl = document.createElement('div');
            blockEl.className = 'absolute w-full p-2 box-border rounded-md';
            blockEl.style.gridColumnStart = colIndex;
            blockEl.style.top = `${topOffset}px`;
            blockEl.style.height = `${height}px`;
            blockEl.style.backgroundColor = 'rgba(107, 114, 128, 0.7)';
            blockEl.style.zIndex = '5';
            blockEl.innerHTML = `
                <p class="text-xs font-semibold text-white truncate">${block.notes || 'Blocked'}</p>
                <p class="text-xs text-white/80">${block.startHour} - ${block.endHour}</p>
            `;
            schedulerBody.appendChild(blockEl);
        });
    }

    function renderShowedAppointmentsTable() {
        if (!showedAppointmentsTableBody) return;
        showedAppointmentsTableBody.innerHTML = '';
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsForWeek = allAppointments
            .filter(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                return appt.technician === selectedTechnician && apptDate >= currentWeekStart && apptDate < weekEnd;
            })
            .sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));

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
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0,
