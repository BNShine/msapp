// public/calendar/schedule.js

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
    const todayBtn = document.getElementById('today-btn');
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');
    const miniCalendarContainer = document.getElementById('mini-calendar-container'); // NOVO SELETOR

    // Modais e seus botões
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
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
    let miniCalDate = new Date(); // NOVO: Data para o mini calendário

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

    // --- 4. Lógica do Mini Calendário ---

    function renderMiniCalendar() {
        if (!miniCalendarContainer) return;

        const month = miniCalDate.getMonth();
        const year = miniCalDate.getFullYear();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDayOfMonth.getDay();

        let datesHtml = '';
        // Preenche os dias do mês anterior
        for (let i = 0; i < firstDayOfWeek; i++) {
            datesHtml += `<div class="date-cell other-month"></div>`;
        }

        // Preenche os dias do mês atual
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const currentDate = new Date(year, month, i);
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const isSelected = currentDate.toDateString() === currentWeekStart.toDateString() || (currentDate > currentWeekStart && currentDate <= new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000));
            
            let cellClass = 'date-cell';
            if (isToday) cellClass += ' today';
            if (isSelected) cellClass += ' selected';

            datesHtml += `<div class="${cellClass}" data-date="${currentDate.toISOString()}">${i}</div>`;
        }

        const monthName = miniCalDate.toLocaleString('default', { month: 'long' });
        miniCalendarContainer.innerHTML = `
            <div id="mini-calendar">
                <div class="header">
                    <button class="nav-btn" id="mini-cal-prev-month"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                    <span class="font-semibold">${monthName} ${year}</span>
                    <button class="nav-btn" id="mini-cal-next-month"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
                <div class="days-grid">
                    ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="day-name">${d}</div>`).join('')}
                </div>
                <div class="dates-grid">${datesHtml}</div>
            </div>
        `;

        // Adiciona event listeners
        document.getElementById('mini-cal-prev-month').addEventListener('click', () => {
            miniCalDate.setMonth(miniCalDate.getMonth() - 1);
            renderMiniCalendar();
        });
        document.getElementById('mini-cal-next-month').addEventListener('click', () => {
            miniCalDate.setMonth(miniCalDate.getMonth() + 1);
            renderMiniCalendar();
        });
        miniCalendarContainer.querySelectorAll('.date-cell[data-date]').forEach(cell => {
            cell.addEventListener('click', (e) => {
                currentWeekStart = getStartOfWeek(new Date(e.currentTarget.dataset.date));
                renderScheduler();
                renderMiniCalendar();
                document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
            });
        });
    }


    // --- 5. Funções de Manipulação dos Modais ---

    function openEditModal(appt) {
        const { id, appointmentDate, verification } = appt;
        document.getElementById('modal-appt-id').value = id;
        document.getElementById('modal-date').value = formatDateTimeForInput(appointmentDate);
        const verificationSelect = document.getElementById('modal-verification');
        
        const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        verificationSelect.innerHTML = statusOptions.map(opt =>
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

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    
    async function handleSaveAppointment() {
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';

        const apptId = document.getElementById('modal-appt-id').value;
        const appointmentToUpdate = allAppointments.find(a => a.id.toString() === apptId);
        
        if (!appointmentToUpdate) {
            alert("Error: Could not find the appointment to update.");
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
            return;
        }

        const newDate = document.getElementById('modal-date').value;
        const newVerification = document.getElementById('modal-verification').value;

        const [datePart, timePart] = newDate.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;

        const dataToUpdate = {
            rowIndex: parseInt(apptId),
            appointmentDate: apiFormattedDate,
            verification: newVerification,
            technician: appointmentToUpdate.technician,
            petShowed: appointmentToUpdate.petShowed,
            serviceShowed: appointmentToUpdate.serviceShowed,
            tips: appointmentToUpdate.tips,
            percentage: appointmentToUpdate.percentage,
            paymentMethod: appointmentToUpdate.paymentMethod,
        };

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            document.dispatchEvent(new CustomEvent('appointmentUpdated'));
            closeEditModal();

        } catch (error) {
            alert(`Error saving appointment: ${error.message}`);
        } finally {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
        }
    }

    async function handleSaveTimeBlock() {
        const techName = selectedTechnician;
        const date = document.getElementById('block-date').value;
        const startHour = document.getElementById('block-start-hour').value;
        const endHour = document.getElementById('block-end-hour').value;
        const notes = document.getElementById('block-notes').value;

        if (!date || !startHour || !endHour) {
            alert('Date, Start Time, and End Time are required.');
            return;
        }
        
        const [year, month, day] = date.split('-');
        const formattedDate = `${month}/${day}/${year}`;

        const data = { technicianName: techName, date: formattedDate, startHour, endHour, notes };

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
            alert('Time block saved successfully!');
        } catch (error) {
            console.error('Error saving time block:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async function handleUpdateTimeBlock() {
        const rowNumber = parseInt(editBlockRowNumberInput.value, 10);
        const dateValue = editBlockDateInput.value;
        const [year, month, day] = dateValue.split('-');
        const formattedDate = `${month}/${day}/${year}`;

        const dataToUpdate = {
            rowNumber,
            date: formattedDate,
            startHour: editBlockStartInput.value,
            endHour: editBlockEndInput.value,
            notes: editBlockNotesInput.value,
        };

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            await fetchAvailabilityForSelectedTech();
            renderScheduler();
            closeEditTimeBlockModal();
            alert('Time block updated successfully!');
        } catch (error) {
            console.error('Error updating time block:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async function handleDeleteTimeBlock() {
        if (!confirm('Are you sure you want to delete this time block?')) {
            return;
        }

        const rowNumber = parseInt(editBlockRowNumberInput.value, 10);

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowNumber }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            await fetchAvailabilityForSelectedTech();
            renderScheduler();
            closeEditTimeBlockModal();
            alert('Time block deleted successfully!');
        } catch (error) {
            console.error('Error deleting time block:', error);
            alert(`Error: ${error.message}`);
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

    // --- 7. Funções de Renderização ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = ''; 

        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = `${rowIndex + 1} / span 1`;
            schedulerBody.appendChild(timeDiv);
        });
        
        DAY_NAMES.forEach((dayName, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateKey = formatDateToYYYYMMDD(date);
            const column = dayIndex + 2;

            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = column;
            header.textContent = `${dayName} ${date.getDate()}`;
            schedulerHeader.appendChild(header);

            const dayContainer = document.createElement('div');
            dayContainer.className = 'relative border-r border-border';
            dayContainer.style.gridColumn = column;
            dayContainer.style.gridRow = `1 / span ${TIME_SLOTS.length}`;
            dayContainer.dataset.dateKey = dateKey;
            
            TIME_SLOTS.forEach((_, rowIndex) => {
                 const line = document.createElement('div');
                 line.className = 'absolute w-full border-t border-border/50';
                 line.style.height = '1px';
                 line.style.top = `${(rowIndex + 1) * SLOT_HEIGHT_PX}px`;
                 dayContainer.appendChild(line);
            });

            schedulerBody.appendChild(dayContainer);
        });

        renderAppointments();
        renderTimeBlocks();
        updateWeekDisplay();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }

    function renderAppointments() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician === selectedTechnician);

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;

            const dateKey = formatDateToYYYYMMDD(apptDate);
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
            if (!dayContainer) return;

            const startHour = apptDate.getHours();
            if (startHour < MIN_HOUR || startHour >= MAX_HOUR) return;
            
            const topOffset = (startHour - MIN_HOUR) * SLOT_HEIGHT_PX + (apptDate.getMinutes() / 60 * SLOT_HEIGHT_PX);

            const block = document.createElement('div');
            let bgColor = 'bg-custom-primary';
            let textColor = 'text-white';

            if (appt.verification === 'Canceled') {
                bgColor = 'bg-cherry-red';
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600';
            } else if (appt.verification === 'Confirmed') {
                bgColor = 'bg-yellow-confirmed';
                textColor = 'text-black';
            }

            block.className = `appointment-block ${bgColor} ${textColor} rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.style.top = `${topOffset}px`;

            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);
            
            block.innerHTML = `
                <div>
                    <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                    <p class="text-sm font-bold truncate">${appt.customers}</p>
                    <p class="text-xs font-medium opacity-80">${appt.verification}</p>
                    <p class="text-xs font-medium opacity-80">Pets: ${appt.pets || 'N/A'}</p>
                </div>
            `;
            
            block.addEventListener('click', () => openEditModal(appt));
            dayContainer.appendChild(block);
        });
    }
    
    function renderTimeBlocks() {
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
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
            if (!dayContainer) return;

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
            blockEl.style.top = `${topOffset}px`;
            blockEl.innerHTML = `<p class="text-xs font-semibold text-white truncate">${block.notes || 'Blocked'}</p><p class="text-xs text-white/80">${block.startHour} - ${block.endHour}</p>`;
            
            blockEl.addEventListener('click', () => openEditTimeBlockModal(block));
            dayContainer.appendChild(blockEl);
        });
    }

    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    // --- 8. Inicialização e Event Listeners ---

    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);
            
            if (!techDataResponse.ok) {
                throw new Error(`Failed to load technician data. Status: ${techDataResponse.status}`);
            }
            
            const techData = await techDataResponse.json();
            allTechnicians = techData.technicians || [];

            if (appointmentsResponse.ok) {
                const apptsData = await appointmentsResponse.json();
                allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            } else {
                console.warn("Could not load appointments, but continuing with technician list.");
                allAppointments = [];
            }
            
            populateTechSelects();
            renderScheduler();
            renderMiniCalendar(); // Renderiza o mini calendário na carga inicial

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            if (techSelectDropdown) {
                techSelectDropdown.innerHTML = `<option value="">Error loading technicians!</option>`;
            }
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
        } else {
            techSelectDropdown.innerHTML = '<option value="">No technicians found.</option>';
        }
    }

    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p> <p class="text-sm text-muted-foreground">Schedule and details below.</p>`;
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar to view their schedule.</p>`;
        }
        await fetchAvailabilityForSelectedTech();
        renderScheduler();
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
        renderMiniCalendar();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
        renderMiniCalendar();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        miniCalDate = new Date();
        renderScheduler();
        renderMiniCalendar();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', async () => {
        const appointmentsResponse = await fetch('/api/get-technician-appointments');
        const apptsData = await appointmentsResponse.json();
        allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
        renderScheduler();
    });

    loadInitialData();
});
