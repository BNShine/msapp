// public/calendar.js

// Define initMap globalmente para ser usada como callback pelo script do Google Maps.
window.initMap = function() {
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
        directionsService = new google.maps.DirectionsService();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores de Elementos ---
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

    // --- Variáveis Globais e Constantes ---
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

    // --- Funções Auxiliares (Datas, Geo, etc.) ---

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
        const timeParts = timePart.split(':');
        if (dateParts.length !== 3 || timeParts.length < 2) return null;
        const month = Number(dateParts[0]);
        const day = Number(dateParts[1]);
        const year = Number(dateParts[2]);
        const hour = Number(timeParts[0]);
        const minute = Number(timeParts[1]);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function getTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const [datePart, timePart] = dateTimeStr.split(' ');
        if (!datePart || !timePart) return '';
        const [month, day, year] = datePart.split('/');
        const [hour, minute] = timePart.split(':').map(Number);
        if (year && month && day) {
             const paddedHour = String(hour).padStart(2, '0');
             const paddedMinute = String(minute).padStart(2, '0');
            return `${year}-${month}-${day}T${paddedHour}:${paddedMinute}`; 
        }
        return '';
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

    // --- Lógica dos Modais ---

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
        editBlockDateInput.value = `${year}-${month}-${day}`;
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
    
    // --- Funções de Manipulação de Dados (API) ---

    async function handleSaveAppointment(event) {
        event.stopPropagation();
        modalSaveBtn.textContent = 'Salvando...';
        modalSaveBtn.disabled = true;
        
        const appointmentDateLocal = document.getElementById('modal-date').value;
        const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
        const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);

        if (hour < MIN_HOUR || hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) {
            alert(`Save Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
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
            if(localAppt) {
                Object.assign(localAppt, { ...dataToUpdate, appointmentDate: apiFormattedDate });
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

    // --- Funções de Renderização ---

    function renderScheduler() {
        // ... (código para renderizar o grid, cabeçalhos, etc.)
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        const columnMap = {};
        
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((dayName, dayIndex) => {
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
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        updateWeekDisplay();
        renderDayItineraryTable();
    }
    
    function renderAppointments(columnMap) {
        // ... (código para renderizar agendamentos, sem alterações)
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
            if (startHour < MIN_HOUR || startHour > MAX_HOUR) return;
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
    
    // ... (restante das funções, incluindo a renderShowedAppointmentsTable, renderDayItineraryTable, runItineraryOptimization, etc. permanecem aqui)
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
                        ${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" placeholder="$0.00" data-key="tips"></td>
                <td class="p-4">
                    <select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="percentage">
                        <option value="">%</option>
                        ${["20%", "25%"].map(option => `<option value="${option}" ${appointment.percentage === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2" data-key="paymentMethod">
                        <option value="">Select...</option>
                        ${["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"].map(option => `<option value="${option}" ${appointment.paymentMethod === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification">
                        <option value="">Select...</option>
                        ${["Scheduled", "Showed", "Canceled"].map(option => `<option value="${option}" ${appointment.verification === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
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
        if (dayAppointments.some(appt => appt.zipCode && appt.zipCode.length > 0)) {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
        populateFirstScheduleDropdown();
    }
    
    function populateFirstScheduleDropdown() {
        firstScheduleSelect.innerHTML = '';
        for (let h = MIN_HOUR; h <= MAX_HOUR; h++) {
            const time = `${String(h).padStart(2, '0')}:00`;
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            firstScheduleSelect.appendChild(option);
        }
    }

    async function runItineraryOptimization(appointments, isReversed = false) {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined' || typeof google.maps.DirectionsService === 'undefined') {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Google Maps Service is not initialized. Não é possível calcular tempo/distância. Verifique a chave API.</p>';
            return;
        } else {
             directionsService = new google.maps.DirectionsService();
        }
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
        const originCoords = await getLatLon(originZip);
        const [originLat, originLon] = originCoords;
        if (originLat === null) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Error: Could not get coordinates for technician origin Zip Code.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }
        let currentLat = originLat;
        let currentLon = originLon;
        let unvisited = [...validAppointments];
        let optimizedItinerary = [];
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
            currentLat = closestClient.lat;
            currentLon = closestClient.lon;
            unvisited = unvisited.filter(c => c !== closestClient);
        }
        let shouldOptimizeWaypoints = true;
        let stopsForGoogleMaps = [...optimizedItinerary];
        if (isReversed) {
            stopsForGoogleMaps.reverse(); 
            shouldOptimizeWaypoints = false; 
        }
        const origin = originZip;
        const destination = originZip;
        const waypoints = stopsForGoogleMaps.map(c => ({
            location: c.zipCode,
            stopover: true
        }));
        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints.slice(0, 23), 
            optimizeWaypoints: shouldOptimizeWaypoints,
            travelMode: google.maps.TravelMode.DRIVING
        };
        directionsService.route(request, (response, status) => {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            if (status === 'OK' && response && response.routes && response.routes.length > 0) {
                const route = response.routes[0];
                let totalDistance = 0;
                let totalDuration = 0;
                itineraryResultsList.innerHTML = `<p class="font-bold text-lg">Optimized Route (Starting from ${isReversed ? 'Farthest' : 'Nearest'}):</p>`;
                const finalOrderedStops = (shouldOptimizeWaypoints && route.waypoint_order && route.waypoint_order.length > 0)
                    ? route.waypoint_order.map((i) => optimizedItinerary[i])
                    : stopsForGoogleMaps;
                const fullSequence = [
                    { name: 'HOME (Start)', zipCode: originZip, apptTime: 'N/A' },
                    ...finalOrderedStops.map(appt => ({ 
                        name: appt.customers, 
                        zipCode: appt.zipCode, 
                        lat: appt.lat, 
                        lng: appt.lon, 
                        apptTime: getTimeHHMM(parseSheetDate(appt.appointmentDate)) 
                    })),
                    { name: 'HOME (End)', zipCode: originZip, lat: originLat, lng: originLon, apptTime: 'N/A' }
                ];
                orderedClientStops = finalOrderedStops;
                const legs = route.legs;
                legs.forEach((leg, i) => {
                    totalDistance += leg.distance.value;
                    totalDuration += leg.duration.value;
                    const destinationName = fullSequence[i + 1].name;
                    const destinationTime = fullSequence[i + 1].apptTime;
                    const destinationIndex = i + 1;
                    itineraryResultsList.innerHTML += `
                        <div class="border-b border-muted py-2">
                            <p class="font-bold text-base">${destinationIndex}. Go to: ${destinationName}</p>
                            <p class="ml-4 text-sm">Target Appt Time: ${destinationTime} | Travel Time: ${leg.duration.text} | Distance: ${leg.distance.text}</p>
                        </div>
                    `;
                });
                itineraryResultsList.innerHTML += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Round Trip: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1000).toFixed(2)} km</div>`;
                schedulingControls.classList.remove('hidden');
            } else {
                itineraryResultsList.innerHTML = `<p class="text-red-600">Google Maps Route Request Failed. Status: ${status}. Motivo: O Google Maps não conseguiu traçar a rota com os Zips fornecidos, ou o Zip de Origem é inválido.</p>`;
                schedulingControls.classList.add('hidden');
            }
        });
    }

    async function handleApplyRoute() {
        const selectedTime = firstScheduleSelect.value;
        const selectedDayOfWeek = dayFilter.value;
        if (orderedClientStops.length === 0 || !selectedTime || !selectedDayOfWeek || !selectedTechnician) {
            alert("Erro: Selecione o técnico, o dia e calcule uma rota antes de aplicar.");
            return;
        }
        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDayOfWeek, 10));
        const initialHour = parseInt(selectedTime.split(':')[0], 10);
        const initialMinute = parseInt(selectedTime.split(':')[1], 10);
        let currentAppointmentDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), initialHour, initialMinute);
        applyRouteBtn.disabled = true;
        applyRouteBtn.textContent = 'Applying...';
        itineraryResultsList.innerHTML += `<div class="text-brand-primary mt-4 font-bold">Applying changes...</div>`;
        let successCount = 0;
        for (const appt of orderedClientStops) {
            const newTimeString = `${String(currentAppointmentDate.getHours()).padStart(2, '0')}:${String(currentAppointmentDate.getMinutes()).padStart(2, '0')}`;
            const apiFormattedDate = `${String(currentAppointmentDate.getMonth() + 1).padStart(2, '0')}/${String(currentAppointmentDate.getDate()).padStart(2, '0')}/${currentAppointmentDate.getFullYear()} ${newTimeString}`;
            const fullApptDetails = allAppointments.find(a => a.id === appt.id);
            if (fullApptDetails) {
                 const dataToUpdate = {
                    rowIndex: fullApptDetails.id, appointmentDate: apiFormattedDate, ...fullApptDetails
                 };
                 try {
                     const response = await fetch('/api/update-appointment-showed-data', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpdate),
                    });
                    const result = await response.json();
                    if (result.success) {
                        successCount++;
                        fullApptDetails.appointmentDate = apiFormattedDate;
                    } else {
                        console.error(`Failed to update ${fullApptDetails.customers}: ${result.message}`);
                    }
                 } catch (e) {
                      console.error(`Network error updating ${fullApptDetails.customers}.`);
                 }
            }
            currentAppointmentDate = new Date(currentAppointmentDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);
        }
        renderScheduler();
        itineraryResultsList.innerHTML += `<div class="mt-4 font-bold text-green-600">✅ ${successCount} appointments updated!</div>`;
        applyRouteBtn.disabled = false;
        applyRouteBtn.textContent = 'Apply Route';
    }

    function handleDayFilterChange() {
        renderDayItineraryTable();
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
            //await fetchGoogleMapsApiKey();
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
    
    async function handleOptimizeItinerary() { await runItineraryOptimization(dayAppointments, false); }
    async function handleItineraryReverser() { await runItineraryOptimization(dayAppointments, true); }
    
    // --- Adição de Todos os Event Listeners no Final ---
    
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
    
    // Listeners dos Modais
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal); 
    modalCloseXBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    // Listeners da Otimização de Rota
    if (dayFilter) dayFilter.addEventListener('change', handleDayFilterChange);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', handleOptimizeItinerary);
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', handleItineraryReverser);
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', handleApplyRoute);
    
    // Listener da Tabela de Agendamentos (Showed Appointments)
    if (showedAppointmentsTableBody) {
        showedAppointmentsTableBody.addEventListener('change', async (event) => {
            const target = event.target;
            if (target.matches('input, select')) {
                const row = target.closest('tr');
                const apptId = row.dataset.rowId;
                if (isSaving[apptId]) return;
                isSaving[apptId] = true;
                row.classList.add('is-saving');
                
                const appointmentDateLocal = row.querySelector('[data-key="appointmentDate"]').value;
                const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
                const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);

                if (hour < MIN_HOUR || hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) {
                    alert(`Save Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
                    row.classList.remove('is-saving');
                    isSaving[apptId] = false;
                    renderScheduler(); 
                    return;
                }
                
                const [datePart, timePart] = appointmentDateLocal.split('T');
                const [year, month, day] = datePart.split('-');
                const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;

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
                
                try {
                    const response = await fetch('/api/update-appointment-showed-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToUpdate),
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);
                    
                    const localAppt = allAppointments.find(a => String(a.id) === String(apptId));
                    if(localAppt) Object.assign(localAppt, dataToUpdate, { appointmentDate: apiFormattedDate });

                    renderScheduler();
                } catch (error) {
                    console.error('Error saving from table:', error);
                } finally {
                    isSaving[apptId] = false;
                }
            }
        });
    }

    // --- Carga Inicial ---
    loadInitialData();
});
