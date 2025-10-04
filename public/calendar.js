// public/calendar.js

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
    const itineraryMapContainer = document.getElementById('itinerary-map');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    // END NEW SELECTORS

    let allAppointments = [];
    let allTechnicians = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};
    let GOOGLE_MAPS_API_KEY = null;
    let map, directionsService, directionsRenderer;
    let dayAppointments = []; // Appointments for the selected day/tech

    const SCHEDULE_DURATION_HOURS = 2;
    const SLOT_HEIGHT_PX = 60;

    // MODIFICATION 1: Change TIME_SLOTS to 07:00 - 21:00 (15 slots: 7, 8, ..., 21)
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

    // --- Google Maps API Key Fetching (FROM quick-routes.js) ---
    async function fetchGoogleMapsApiKey() {
        if (GOOGLE_MAPS_API_KEY) return;
        try {
            const response = await fetch('/api/get-google-maps-api-key');
            if (response.ok) {
                const data = await response.json();
                GOOGLE_MAPS_API_KEY = data.apiKey;
                // Carrega o script do Google Maps dinamicamente
                if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
                    document.head.appendChild(script);
                } else {
                    window.initMap(); // Call it manually if API is already loaded
                }
            } else {
                console.error('Falha ao buscar a chave da API do Google Maps.');
                alert('Erro: Chave da Google Maps API não carregada. A otimização de rotas não funcionará.');
            }
        } catch (error) {
            console.error('Erro ao buscar a chave da API do Google Maps:', error);
        }
    }
    
    // --- Global Map Initialization ---
    window.initMap = function() {
        if (itineraryMapContainer) {
            map = new google.maps.Map(itineraryMapContainer, {
                center: { lat: 39.8283, lng: -98.5795 }, // Centro dos EUA
                zoom: 4,
                streetViewControl: false,
                fullscreenControl: false,
            });
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({ map: map });
        }
    }
    // --- End Google Maps Logic ---

    // --- Date/Time Helpers ---

    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
        const date = new Date(startOfWeekDate);
        date.setDate(startOfWeekDate.getDate() + dayOfWeek);
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
        if (!dateStr) return null; // <-- Removed length check
        const [datePart, timePart] = dateStr.split(' ');
        
        if (!datePart || !timePart) return null; // Fails if no space/time part

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
    
    // MODIFICATION 3: Correct formatting from MM/DD/YYYY HH:MM to YYYY-MM-DDTHH:MM for input fields
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        // Input: MM/DD/YYYY HH:MM (from API/Sheet)
        // Output: YYYY-MM-DDTHH:MM (for HTML input)

        const [datePart, timePart] = dateTimeStr.split(' ');
        if (!datePart || !timePart) return '';

        const [month, day, year] = datePart.split('/');
        
        if (year && month && day) {
             // Convert MM/DD/YYYY to YYYY-MM-DD and combine with time
            return `${year}-${month}-${day}T${timePart}`; 
        }
        return '';
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
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0, 15) + '...' : appointment.customers}</td>
                <td class="p-4 code-cell">${appointment.code}</td>
                <td class="p-4"><input type="text" value="${appointment.technician}" class="bg-transparent border border-border rounded-md px-2" data-key="technician" disabled></td>
                <td class="p-4">
                    <select style="width: 60px;" class="bg-transparent border border-border rounded-md px-2" data-key="petShowed">
                        <option value="">Pets</option>
                        ${petOptions.map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" placeholder="$0.00" data-key="tips"></td>
                <td class="p-4">
                    <select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="percentage">
                        <option value="">%</option>
                        ${percentageOptions.map(option => `<option value="${option}" ${appointment.percentage === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2" data-key="paymentMethod">
                        <option value="">Select...</option>
                        ${paymentOptions.map(option => `<option value="${option}" ${appointment.paymentMethod === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification">
                        <option value="">Select...</option>
                        ${VERIFICATION_OPTIONS.map(option => `<option value="${option}" ${appointment.verification === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }
    
    // --- NEW: Daily Itinerary Rendering ---

    function renderDayItineraryTable() {
        if (!dayItineraryTableBody) return;
        dayItineraryTableBody.innerHTML = '';
        itineraryResultsList.innerHTML = 'No route calculated.';
        
        // Clear previous map route
        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
        if (map) {
             // Center map to US default view
            map.setCenter({ lat: 39.8283, lng: -98.5795 });
            map.setZoom(4);
        }

        const selectedDayOfWeek = dayFilter.value;
        // MODIFICATION 8: Read selectedTechName directly from DOM for robustness
        const selectedTechName = techSelectDropdown.value; 

        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;
        
        // The condition for displaying the fallback message
        if (!selectedTechName || selectedDayOfWeek === '') {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">Select a day and a technician to view appointments.</td></tr>';
            return;
        }

        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDayOfWeek, 10));
        // MODIFICATION 9: Comparing internal YYYY/MM/DD date keys (correct for filtering by date)
        const dateKey = formatDateToYYYYMMDD(targetDate); 

        // Filter appointments for the selected day and technician
        dayAppointments = allAppointments
            .filter(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const apptDateKey = apptDate ? formatDateToYYYYMMDD(apptDate) : null;
                return appt.technician === selectedTechName && apptDateKey === dateKey; 
            })
            // Sort by appointment time
            .sort((a, b) => {
                const dateA = parseSheetDate(a.appointmentDate);
                const dateB = parseSheetDate(b.appointmentDate);
                return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
            });

        if (dayAppointments.length === 0) {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">No appointments found for the selected day.</td></tr>';
            return;
        }

        dayAppointments.forEach(appt => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            
            const apptDate = parseSheetDate(appt.appointmentDate);
            const apptTime = apptDate ? getTimeHHMM(apptDate) : '';

            row.innerHTML = `
                <td class="p-4 font-bold">${apptTime}</td>
                <td class="p-4">${appt.customers}</td>
                <td class="p-4">${appt.phone || ''}</td>
                <td class="p-4 zip-code-cell">${appt.zipCode || 'N/A'}</td>
                <td class="p-4">${appt.code || ''}</td>
                <td class="p-4">${appt.verification || ''}</td>
                <td class="p-4">${appt.technician || ''}</td>
            `;
            dayItineraryTableBody.appendChild(row);
        });

        // Enable buttons if there are appointments with zip codes
        if (dayAppointments.some(appt => appt.zipCode && appt.zipCode.length > 0)) {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
    }

    // --- NEW: Itinerary Optimization Logic ---

    async function runItineraryOptimization(appointments, isReversed = false) {
        if (!directionsService || !directionsRenderer) {
            // Se o serviço não estiver pronto, a API Key ou o script do Maps não carregaram
            itineraryResultsList.innerHTML = '<p class="text-red-600">Google Maps Service is not initialized. Please ensure the API key is loaded and check console errors.</p>';
            return;
        }
        
        // Fetch tech coverage data (needs technician's origin zip)
        const techCoverageResponse = await fetch('/api/get-tech-coverage');
        const techCoverageData = techCoverageResponse.ok ? await techCoverageResponse.json() : [];
        const selectedTechObj = techCoverageData.find(t => t.nome === selectedTechnician);
        const originZip = selectedTechObj?.zip_code;

        if (!originZip) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Technician origin Zip Code not found. Please register it in the Technician Registration section.</p>';
            return;
        }

        itineraryResultsList.innerHTML = 'Calculating route...';
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        // 1. Filter appointments with valid Zip Code
        const validAppointments = [];
        for (const appt of appointments) {
            if (appt.zipCode) {
                const [lat, lon] = await getLatLon(appt.zipCode);
                if (lat !== null) {
                    validAppointments.push({ ...appt, lat, lon });
                } else {
                    console.warn(`Ignoring appointment with invalid zip: ${appt.zipCode}`);
                }
            }
        }

        if (validAppointments.length < 1) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">No appointments with valid Zip Codes to optimize.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }
        
        // 2. Get Origin Coords
        const [originLat, originLon] = await getLatLon(originZip);
        if (originLat === null) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Error: Could not get coordinates for technician origin Zip Code.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        // 3. Nearest Neighbor Approximation Algorithm (Correctly sets starting point)
        let currentLat = originLat;
        let currentLon = originLon;

        let unvisited = [...validAppointments];
        let optimizedItinerary = [];
        
        // Start the Nearest Neighbor search from the Technician's origin.
        while (unvisited.length > 0) {
            let closestClient = null;
            let minDistance = Infinity;

            for (const client of unvisited) {
                const distance = calculateDistance(currentLat, currentLon, client.lat, client.lon);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestClient = client;
                }
            }
            optimizedItinerary.push(closestClient);
            // Move current position to the new client's location
            currentLat = closestClient.lat;
            currentLon = closestClient.lon;
            unvisited = unvisited.filter(c => c !== closestClient);
        }
        
        // 4. Reverse the route if needed (Farthest First - still an approximation)
        if (isReversed) {
            optimizedItinerary.reverse();
        }

        // 5. Google Maps Directions Request
        const origin = originZip;
        const destination = originZip; // Technician's zip is the final destination (round trip)
        const waypoints = optimizedItinerary.map(c => ({
            location: c.zipCode,
            stopover: true
        }));
        
        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints.slice(0, 23), 
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING
        };
        
        // 6. Display Route
        directionsService.route(request, (response, status) => {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;

            if (status === 'OK') {
                directionsRenderer.setDirections(response);

                let totalDistance = 0;
                let totalDuration = 0;

                const route = response.routes[0];
                
                itineraryResultsList.innerHTML = `<p class="font-bold text-lg">Optimized Route (Starting from ${isReversed ? 'Farthest' : 'Nearest'}):</p>`;
                
                // Map the Directions API order back to our optimized list for correct time display
                const orderedSequence = [
                    ...route.waypoints.map((wp, i) => optimizedItinerary[route.waypoint_order[i]]),
                ];
                
                // The full sequence: Tech Base -> Waypoints (Ordered) -> Tech Base
                const fullSequence = [
                    { name: 'Start (Tech Base)', zipCode: originZip, apptTime: 'N/A' },
                    ...orderedSequence.map(appt => ({ 
                        name: appt.customers, 
                        zipCode: appt.zipCode, 
                        apptTime: getTimeHHMM(parseSheetDate(appt.appointmentDate)) 
                    }))
                ];

                const legs = route.legs;

                legs.forEach((leg, i) => {
                    totalDistance += leg.distance.value;
                    totalDuration += leg.duration.value;
                    
                    const destinationName = (i === legs.length - 1) ? 'End (Tech Base)' : fullSequence[i + 1].name;
                    const destinationTime = (i === legs.length - 1) ? 'N/A' : fullSequence[i + 1].apptTime;
                    const destinationIndex = i + 1;


                    itineraryResultsList.innerHTML += `
                        <div class="border-b border-muted py-2">
                            <p class="font-bold text-base">${destinationIndex}. Go to: ${destinationName}</p>
                            <p class="ml-4 text-sm">Target Appt Time: ${destinationTime} | Travel Time: ${leg.duration.text} | Distance: ${leg.distance.text}</p>
                        </div>
                    `;
                });
                
                // Final Summary
                itineraryResultsList.innerHTML += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Round Trip: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1000).toFixed(2)} km</div>`;
                
            } else {
                itineraryResultsList.innerHTML = `<p class="text-red-600">Google Maps Route Request Failed. Status: ${status}. Verifique o console para mais detalhes.</p>`;
            }
        });
    }


    function handleOptimizeItinerary() {
        runItineraryOptimization(dayAppointments, false);
    }
    
    function handleItineraryReverser() {
        runItineraryOptimization(dayAppointments, true);
    }


    function handleDayFilterChange() {
        // Clear previous route data whenever day or technician changes
        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
        if (map) {
             // Center map to US default view
            map.setCenter({ lat: 39.8283, lng: -98.5795 });
            map.setZoom(4);
        }
        renderDayItineraryTable();
    }

    // --- Data Fetching and Initialization ---

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

    async function loadInitialData() {
        try {
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
            await fetchAvailabilityForSelectedTech();
            renderScheduler(); 
            
            // NEW: Fetch and initialize Google Maps
            await fetchGoogleMapsApiKey();
            
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
            if (techConfigSelect) techConfigSelect.appendChild(option.cloneNode(true));
        });
    }
    
    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        selectedTechDisplay.textContent = selectedTechnician || 'No Technician Selected';
        
        await fetchAvailabilityForSelectedTech();
        renderScheduler(); 
        handleDayFilterChange();
    }
    
    // --- Event Listeners ---
    // Remove existing listener before adding the comprehensive one
    techSelectDropdown.removeEventListener('change', handleTechSelectionChange);
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);

    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
        handleDayFilterChange(); // Update itinerary view when week changes
    });
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
        handleDayFilterChange(); // Update itinerary view when week changes
    });
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal); 
    modalCloseXBtn.addEventListener('click', closeEditModal);

    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    
    // NEW Event Listeners
    if (dayFilter) dayFilter.addEventListener('change', handleDayFilterChange);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', handleOptimizeItinerary);
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', handleItineraryReverser);
    
    if (showedAppointmentsTableBody) {
        // ... (Existing table change listener, kept for completeness) ...
        showedAppointmentsTableBody.addEventListener('change', async (event) => {
            const target = event.target;
            if (target.matches('input, select')) {
                const row = target.closest('tr');
                const apptId = row.dataset.rowId;

                if (isSaving[apptId]) return;
                
                isSaving[apptId] = true;
                row.classList.add('is-saving');
                
                const appointmentDateLocal = row.querySelector('[data-key="appointmentDate"]').value; // YYYY-MM-DDTHH:MM
                const [datePart, timePart] = appointmentDateLocal.split('T');
                const [year, month, day] = datePart.split('-');
                const apiFormattedDate = `${month}/${day}/${year} ${timePart}`; // MM/DD/YYYY HH:MM

                const dataToUpdate = {
                    rowIndex: parseInt(apptId, 10),
                    appointmentDate: apiFormattedDate, 
                    technician: row.querySelector('[data-key="technician"]').value,
                    petShowed: row.querySelector('[data-key="petShowed"]').value,
                    serviceShowed: row.querySelector('[data-key="serviceShowed"]').value,
                    tips: row.querySelector('[data-key="tips"]').value,
                    percentage: row.querySelector('[data-key="percentage"]').value,
                    paymentMethod: row.querySelector('[data-key="paymentMethod"]').value,
                    verification: row.querySelector('[data-key="verification"]').value,
                };
                
                // MODIFICATION 5: Add Hour Validation to Table Change
                const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
                const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);
                
                if (hour < MIN_HOUR || hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) {
                    alert(`Save Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
                    row.classList.remove('is-saving');
                    row.classList.add('is-error');
                    setTimeout(() => {
                        row.classList.remove('is-error');
                        isSaving[apptId] = false;
                    }, 2000);
                    // Re-render the row/table to show original value
                    renderScheduler(); 
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
                    
                    const localAppt = allAppointments.find(a => String(a.id) === String(apptId));
                    if(localAppt) Object.assign(localAppt, dataToUpdate, {
                        appointmentDate: apiFormattedDate
                    });

                    renderScheduler();
                    row.classList.add('is-success');
                } catch (error) {
                    console.error('Error saving from table:', error);
                    row.classList.add('is-error');
                } finally {
                    setTimeout(() => {
                        row.classList.remove('is-saving', 'is-success', 'is-error');
                        isSaving[apptId] = false;
                    }, 2000);
                }
            }
        });
    }

    loadInitialData();
});
