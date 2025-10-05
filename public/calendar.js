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

    // Modais
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

    // --- 2. Variáveis Globais ---
    let allAppointments = [];
    let allTechnicians = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};
    let directionsService;
    let dayAppointments = [];
    let orderedClientStops = [];

    const SCHEDULE_DURATION_HOURS = 2;
    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- 3. Funções Auxiliares ---

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

    // --- 4. Lógica dos Modais ---

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

    // --- 5. Funções de API ---

    async function handleSaveAppointment() {
        modalSaveBtn.textContent = 'Saving...';
        modalSaveBtn.disabled = true;
        const appointmentDateLocal = document.getElementById('modal-date').value;
        const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
        if (hour < MIN_HOUR || hour >= MAX_HOUR) {
            alert(`Save Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR - 1}:59.`);
            modalSaveBtn.textContent = 'Save Changes';
            modalSaveBtn.disabled = false;
            return;
        }
        const [datePart, timePart] = appointmentDateLocal.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;
        const dataToUpdate = {
            rowIndex: parseInt(document.getElementById('modal-appt-id').value, 10),
            appointmentDate: apiFormattedDate,
            verification: document.getElementById('modal-verification').value,
            serviceShowed: document.getElementById('modal-service-value').value,
            tips: document.getElementById('modal-tips').value,
            technician: document.getElementById('modal-original-technician').value,
            petShowed: document.getElementById('modal-pet-showed').value || '',
            percentage: document.getElementById('modal-percentage').value || '',
            paymentMethod: document.getElementById('modal-payment-method').value || '',
        };
        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpdate)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            const localAppt = allAppointments.find(a => String(a.id) === String(dataToUpdate.rowIndex));
            if (localAppt) Object.assign(localAppt, { ...dataToUpdate, appointmentDate: apiFormattedDate });
            modalSaveBtn.textContent = 'Saved!';
            setTimeout(() => {
                closeEditModal();
                modalSaveBtn.textContent = 'Save Changes';
                modalSaveBtn.disabled = false;
                renderScheduler();
            }, 1000);
        } catch (error) {
            console.error('API Error on Save:', error);
            modalSaveBtn.textContent = 'Error!';
            setTimeout(() => {
                modalSaveBtn.textContent = 'Save Changes';
                modalSaveBtn.disabled = false;
            }, 2500);
        }
    }
    
    async function handleSaveTimeBlock() {
        const dateValue = document.getElementById('block-date').value;
        const startHourValue = document.getElementById('block-start-hour').value;
        const endHourValue = document.getElementById('block-end-hour').value;
        if (!dateValue || !startHourValue || !endHourValue) {
            alert('Date, Start Time, and End Time are required.');
            return;
        }
        const [year, month, day] = dateValue.split('-');
        const data = {
            technicianName: selectedTechnician,
            date: `${month}/${day}/${year}`,
            startHour: startHourValue,
            endHour: endHourValue,
            notes: document.getElementById('block-notes').value,
        };
        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
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

    async function handleUpdateTimeBlock() {
        const rowNumber = parseInt(editBlockRowNumberInput.value, 10);
        const [year, month, day] = editBlockDateInput.value.split('-');
        const dataToUpdate = {
            rowNumber,
            date: `${month}/${day}/${year}`,
            startHour: editBlockStartInput.value,
            endHour: editBlockEndInput.value,
            notes: editBlockNotesInput.value
        };
        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            const index = techAvailabilityBlocks.findIndex(b => b.rowNumber === rowNumber);
            if (index !== -1) {
                techAvailabilityBlocks[index] = { ...techAvailabilityBlocks[index], ...dataToUpdate };
            }
            renderScheduler();
            closeEditTimeBlockModal();
            alert('Time block updated!');
        } catch (error) {
            console.error('Error updating time block:', error);
            alert('Error: ' + error.message);
        }
    }

    async function handleDeleteTimeBlock() {
        if (!confirm('Are you sure you want to delete this time block?')) return;
        const rowNumber = parseInt(editBlockRowNumberInput.value, 10);
        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowNumber }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            techAvailabilityBlocks = techAvailabilityBlocks.filter(b => b.rowNumber !== rowNumber);
            renderScheduler();
            closeEditTimeBlockModal();
            alert('Time block deleted!');
        } catch (error) {
            console.error('Error deleting time block:', error);
            alert('Error: ' + error.message);
        }
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
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician === selectedTechnician);
        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;
            const dateKey = formatDateToYYYYMMDD(apptDate);
            const colIndex = columnMap[dateKey];
            if (!colIndex) return;
            const startHour = apptDate.getHours();
            if (startHour < MIN_HOUR || startHour >= MAX_HOUR) return;
            const topOffset = (startHour - MIN_HOUR) * SLOT_HEIGHT_PX + apptDate.getMinutes();
            const block = document.createElement('div');
            let bgColor = 'bg-custom-primary';
            if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
            else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
            block.className = `appointment-block ${bgColor} text-white rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.style.gridColumnStart = colIndex;
            block.style.top = `${topOffset}px`;
            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);
            block.innerHTML = `<div>
                <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                <p class="text-sm font-bold truncate">${appt.customers}</p>
                <p class="text-xs font-medium text-white/80">${appt.verification}</p>
            </div>`;
            block.addEventListener('click', () => openEditModal(appt));
            schedulerBody.appendChild(block);
        });
    }

    function renderTimeBlocks(columnMap) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        techAvailabilityBlocks.forEach(block => {
            if (!block || typeof block.date !== 'string' || block.date.trim() === '') return;
            const parts = block.date.split('/');
            if (parts.length !== 3) return;
            const [M, D, Y] = parts;
            const blockDate = new Date(`${Y}-${M}-${D}T00:00:00`);
            if (isNaN(blockDate.getTime()) || blockDate < currentWeekStart || blockDate >= weekEnd) return;
            const dateKey = formatDateToYYYYMMDD(blockDate);
            const colIndex = columnMap[dateKey];
            if (!colIndex) return;
            const [startH, startM] = block.startHour.split(':').map(Number);
            const [endH, endM] = block.endHour.split(':').map(Number);
            const topOffset = ((startH - MIN_HOUR) * SLOT_HEIGHT_PX) + (startM / 60 * SLOT_HEIGHT_PX);
            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            const height = (durationMinutes / 60) * SLOT_HEIGHT_PX;
            const blockEl = document.createElement('div');
            blockEl.className = 'appointment-block';
            blockEl.style.height = `${height}px`;
            blockEl.style.backgroundColor = 'rgba(107, 114, 128, 0.7)';
            blockEl.style.zIndex = '5';
            blockEl.style.cursor = 'pointer';
            blockEl.style.gridColumnStart = colIndex;
            blockEl.style.top = `${topOffset}px`;
            blockEl.innerHTML = `
                <p class="text-xs font-semibold text-white truncate">${block.notes || 'Blocked'}</p>
                <p class="text-xs text-white/80">${block.startHour} - ${block.endHour}</p>
            `;
            blockEl.addEventListener('click', () => openEditTimeBlockModal(block));
            schedulerBody.appendChild(blockEl);
        });
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

    async function runItineraryOptimization(isReversed = false) {
        // ... (código de otimização de rota, se necessário)
    }

    // --- 7. Inicialização ---
    async function handleOptimizeItinerary() { await runItineraryOptimization(false); }
    async function handleItineraryReverser() { await runItineraryOptimization(true); }
    function handleDayFilterChange() { renderDayItineraryTable(); }

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

    // --- Carga Inicial ---
    loadInitialData();
});
