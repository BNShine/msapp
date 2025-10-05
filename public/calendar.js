// public/calendar.js

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

    // --- 2. Variáveis Globais de Estado ---
    let allAppointments = [];
    let allTechnicians = [];
    let techCoverageData = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let miniCalDate = new Date();

    // --- 3. Constantes de Configuração ---
    const SLOT_HEIGHT_PX = 60; // Representa 60 minutos de altura
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;

    // --- 4. Funções Auxiliares ---

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
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    async function getTravelTimesForDay(originZip, waypoints, dateKey) {
        const cacheKey = `travelTimes_${dateKey}_${selectedTechnician}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`Cache HIT for ${cacheKey}`);
            return JSON.parse(cachedData);
        }

        console.log(`Cache MISS for ${cacheKey}. Fetching from API...`);
        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originZip, waypoints, isReversed: true })
            });
            const result = await response.json();
            if (result.success && result.routeData.routes[0]?.legs) {
                const travelTimes = result.routeData.routes[0].legs.map(leg => leg.duration.value / 60);
                sessionStorage.setItem(cacheKey, JSON.stringify(travelTimes));
                return travelTimes;
            }
            return [];
        } catch (error) {
            console.error("Error fetching travel time:", error);
            return [];
        }
    }

    // --- 5. Lógica de Renderização ---

    function renderSchedulerStructure() {
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
        updateWeekDisplay();
    }

    async function renderFullScheduler() {
        renderSchedulerStructure();
        await fetchAvailabilityForSelectedTech();
        renderTimeBlocks();
        await renderDynamicAppointments();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }
    
    async function renderDynamicAppointments() {
        if (!selectedTechnician) return;

        const techInfo = techCoverageData.find(t => t.nome === selectedTechnician);
        if (!techInfo || !techInfo.zip_code) { return; }
        const techOriginZip = techInfo.zip_code;

        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsToRender = allAppointments.filter(appt => 
            appt.technician === selectedTechnician &&
            parseSheetDate(appt.appointmentDate) >= currentWeekStart &&
            parseSheetDate(appt.appointmentDate) < weekEnd
        );

        const appointmentsByDay = appointmentsToRender.reduce((acc, appt) => {
            const dateKey = formatDateToYYYYMMDD(parseSheetDate(appt.appointmentDate));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(appt);
            return acc;
        }, {});

        for (const dateKey in appointmentsByDay) {
            const dayAppointments = appointmentsByDay[dateKey].sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));
            if (dayAppointments.length === 0) continue;

            const waypoints = dayAppointments.map(appt => ({ zipCode: appt.zipCode }));
            const travelTimes = await getTravelTimesForDay(techOriginZip, waypoints, dateKey);
            
            dayAppointments.forEach((appt, index) => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
                if (!dayContainer) return;

                const travelTime = travelTimes[index] || 0;
                const serviceDuration = (parseInt(appt.pets, 10) || 1) * 60;
                const margin = parseInt(appt.margin, 10) || 30;
                const totalBlockDuration = travelTime + serviceDuration + margin;
                const blockHeight = (totalBlockDuration / 60) * SLOT_HEIGHT_PX;
                
                const blockStartMoment = new Date(apptDate.getTime() - (travelTime * 60000));
                const topOffset = ((blockStartMoment.getHours() - MIN_HOUR) * 60 + blockStartMoment.getMinutes()) / 60 * SLOT_HEIGHT_PX;

                const block = document.createElement('div');
                let bgColor = 'bg-custom-primary', textColor = 'text-white';
                if (appt.verification === 'Canceled') { bgColor = 'bg-cherry-red'; }
                else if (appt.verification === 'Showed') { bgColor = 'bg-green-600'; }
                else if (appt.verification === 'Confirmed') { bgColor = 'bg-yellow-confirmed'; textColor = 'text-black'; }

                block.className = `appointment-block ${bgColor} ${textColor} rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
                block.dataset.id = appt.id;
                block.style.top = `${topOffset}px`;
                block.style.height = `${blockHeight}px`;
                block.style.width = '100%';
                
                const serviceEndTime = new Date(apptDate.getTime() + (serviceDuration + margin) * 60000);

                block.innerHTML = `
                    <div>
                        <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(serviceEndTime)}</p>
                        <p class="text-sm font-bold truncate">${appt.customers}</p>
                        <p class="text-xs font-medium opacity-80">${appt.verification}</p>
                        <p class="text-xs font-medium opacity-80">Pets: ${appt.pets || 'N/A'}</p>
                        <p class="text-xs font-medium opacity-80">Travel: ${Math.round(travelTime)} min</p>
                    </div>
                `;
                block.addEventListener('click', () => openEditModal(appt));
                dayContainer.appendChild(block);
            });
        }
    }

    function renderTimeBlocks() { /* ...código da função... */ }
    function updateWeekDisplay() { /* ...código da função... */ }
    function renderMiniCalendar() { /* ...código da função... */ }
    
    // --- 6. Funções de Manipulação dos Modais e Dados ---
    function openEditModal(appt) { /* ...código da função... */ }
    function closeEditModal() { /* ...código da função... */ }
    // ... todas as outras funções de modal ...

    async function handleSaveAppointment() { /* ...código da função... */ }
    async function handleSaveTimeBlock() { /* ...código da função... */ }
    async function handleUpdateTimeBlock() { /* ...código da função... */ }
    async function handleDeleteTimeBlock() { /* ...código da função... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código da função... */ }

    // --- 7. Inicialização e Event Listeners ---
    async function loadInitialData() {
        renderSchedulerStructure();
        renderMiniCalendar();
        try {
            const techDataResponse = await fetch('/api/get-technicians');
            if (!techDataResponse.ok) throw new Error(`Failed to load technicians: ${techDataResponse.statusText}`);
            allTechnicians = await techDataResponse.json() || [];
            populateTechSelects();

            const [appointmentsResponse, coverageResponse] = await Promise.all([
                fetch('/api/get-technician-appointments'),
                fetch('/api/get-tech-coverage')
            ]);
            if (!appointmentsResponse.ok || !coverageResponse.ok) throw new Error("Failed to load initial appointment/coverage data.");
            
            allAppointments = (await appointmentsResponse.json()).appointments || [];
            techCoverageData = await coverageResponse.json() || [];
            
            // Renderiza agendamentos se um técnico já estiver selecionado (raro, mas possível)
            if (selectedTechnician) {
                await renderFullScheduler();
            }

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            techSelectDropdown.innerHTML = `<option value="">Error loading!</option>`;
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        while (techSelectDropdown.options.length > 1) { techSelectDropdown.remove(1); }
        if (allTechnicians.length > 0) {
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
        await renderFullScheduler();
    }
    
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', async () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); await renderFullScheduler(); renderMiniCalendar(); });
    nextWeekBtn.addEventListener('click', async () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); await renderFullScheduler(); renderMiniCalendar(); });
    todayBtn.addEventListener('click', async () => { currentWeekStart = getStartOfWeek(new Date()); miniCalDate = new Date(); await renderFullScheduler(); renderMiniCalendar(); });
    
    // ... outros listeners de modais ...
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    
    document.addEventListener('appointmentUpdated', async () => {
        // Recarrega apenas os dados necessários e renderiza novamente
        const appointmentsResponse = await fetch('/api/get-technician-appointments');
        allAppointments = (await appointmentsResponse.json()).appointments || [];
        await renderFullScheduler();
    });

    loadInitialData();
});
