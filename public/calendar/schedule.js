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
    const miniCalendarContainer = document.getElementById('mini-calendar-container');

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
    let miniCalDate = new Date();

    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;

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
        for (let i = 0; i < firstDayOfWeek; i++) { datesHtml += `<div class="date-cell other-month"></div>`; }
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const currentDate = new Date(year, month, i);
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const endOfWeek = new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
            const isSelected = currentDate >= currentWeekStart && currentDate <= endOfWeek;
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
                <div class="days-grid">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="day-name">${d}</div>`).join('')}</div>
                <div class="dates-grid">${datesHtml}</div>
            </div>`;
        document.getElementById('mini-cal-prev-month').addEventListener('click', () => { miniCalDate.setMonth(miniCalDate.getMonth() - 1); renderMiniCalendar(); });
        document.getElementById('mini-cal-next-month').addEventListener('click', () => { miniCalDate.setMonth(miniCalDate.getMonth() + 1); renderMiniCalendar(); });
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
    window.openAppointmentModal = function(appt) {
        allAppointments.push(appt); // Garante que o agendamento esteja na lista local para edição
        const { id, appointmentDate, verification } = appt;
        document.getElementById('modal-appt-id').value = id;
        document.getElementById('modal-date').value = formatDateTimeForInput(appointmentDate);
        const verificationSelect = document.getElementById('modal-verification');
        const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        verificationSelect.innerHTML = statusOptions.map(opt => `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`).join('');
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }
    
    function closeEditModal() { if (editModal) editModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
    function openTimeBlockModal() { if (!selectedTechnician) { alert('Please select a technician first.'); return; } document.getElementById('time-block-form').reset(); timeBlockModal.classList.remove('hidden'); }
    function closeTimeBlockModal() { timeBlockModal.classList.add('hidden'); }
    function openEditTimeBlockModal(blockData) { editBlockRowNumberInput.value = blockData.rowNumber; const [month, day, year] = blockData.date.split('/'); editBlockDateInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`; editBlockStartInput.value = blockData.startHour; editBlockEndInput.value = blockData.endHour; editBlockNotesInput.value = blockData.notes; editTimeBlockModal.classList.remove('hidden'); document.body.classList.add('modal-open'); }
    function closeEditTimeBlockModal() { if (editTimeBlockModal) editTimeBlockModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() {
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';
        const apptId = document.getElementById('modal-appt-id').value;
        const appointmentToUpdate = allAppointments.find(a => a.id.toString() === apptId);
        if (!appointmentToUpdate) { alert("Error: Could not find appointment."); modalSaveBtn.disabled = false; modalSaveBtn.textContent = 'Save Changes'; return; }
        const newDate = document.getElementById('modal-date').value;
        const newVerification = document.getElementById('modal-verification').value;
        const [datePart, timePart] = newDate.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;
        const dataToUpdate = {
            rowIndex: parseInt(apptId), appointmentDate: apiFormattedDate, verification: newVerification,
            technician: appointmentToUpdate.technician, petShowed: appointmentToUpdate.petShowed,
            serviceShowed: appointmentToUpdate.serviceShowed, tips: appointmentToUpdate.tips,
            percentage: appointmentToUpdate.percentage, paymentMethod: appointmentToUpdate.paymentMethod,
        };
        try {
            const response = await fetch('/api/update-appointment-showed-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpdate) });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            document.dispatchEvent(new CustomEvent('reloadData'));
            closeEditModal();
        } catch (error) { alert(`Error saving: ${error.message}`); } finally { modalSaveBtn.disabled = false; modalSaveBtn.textContent = 'Save Changes'; }
    }

    async function handleSaveTimeBlock() { /* ...código da função... */ }
    async function handleUpdateTimeBlock() { /* ...código da função... */ }
    async function handleDeleteTimeBlock() { /* ...código da função... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código da função... */ }

    // --- 7. Funções de Renderização da ESTRUTURA ---
    function renderScheduler() {
        try {
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
            renderTimeBlocks();
            updateWeekDisplay();
            loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        } catch(error) {
            console.error("Error rendering scheduler structure:", error);
        }
    }
    
    function renderTimeBlocks() { /* ...código da função... */ }
    
    function updateWeekDisplay() {
        if (!currentWeekDisplay) return;
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    // --- 8. Inicialização e Event Listeners ---
    async function loadInitialData() {
        renderScheduler();
        renderMiniCalendar();
        try {
            const techDataResponse = await fetch('/api/get-technicians');
            if (!techDataResponse.ok) {
                throw new Error(`Failed to load technician data. Status: ${techDataResponse.status}`);
            }
            const technicians = await techDataResponse.json();
            allTechnicians = technicians || [];
            populateTechSelects();
            document.dispatchEvent(new CustomEvent('schedulerReady'));
        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            if (techSelectDropdown) { techSelectDropdown.innerHTML = `<option value="">Error loading!</option>`; }
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        while (techSelectDropdown.options.length > 1) { techSelectDropdown.remove(1); }
        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
        } else {
            techSelectDropdown.innerHTML = '<option value="">No technicians found</option>';
        }
    }

    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p> <p class="text-sm text-muted-foreground">Schedule and details below.</p>`;
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar.</p>`;
        }
        await fetchAvailabilityForSelectedTech();
        renderScheduler();
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); renderScheduler(); renderMiniCalendar(); document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } })); });
    nextWeekBtn.addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); renderScheduler(); renderMiniCalendar(); document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } })); });
    todayBtn.addEventListener('click', () => { currentWeekStart = getStartOfWeek(new Date()); miniCalDate = new Date(); renderScheduler(); renderMiniCalendar(); document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } })); });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', () => {
        document.dispatchEvent(new CustomEvent('reloadData'));
    });

    loadInitialData();
});
