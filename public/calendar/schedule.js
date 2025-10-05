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
    function getStartOfWeek(date) { /* ...código da função... */ }
    function formatDateToYYYYMMDD(date) { /* ...código da função... */ }
    function formatDateTimeForInput(dateTimeStr) { /* ...código da função... */ }

    // --- 4. Lógica do Mini Calendário ---
    function renderMiniCalendar() { /* ...código completo da função... */ }

    // --- 5. Funções de Manipulação dos Modais ---
    window.openAppointmentModal = function(appt) { /* ...código completo da função... */ }
    function closeEditModal() { /* ...código da função... */ }
    function openTimeBlockModal() { /* ...código da função... */ }
    function closeTimeBlockModal() { /* ...código da função... */ }
    function openEditTimeBlockModal(blockData) { /* ...código da função... */ }
    function closeEditTimeBlockModal() { /* ...código da função... */ }

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() { /* ...código completo da função... */ }
    async function handleSaveTimeBlock() { /* ...código completo da função... */ }
    async function handleUpdateTimeBlock() { /* ...código completo da função... */ }
    async function handleDeleteTimeBlock() { /* ...código completo da função... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código completo da função... */ }

    // --- 7. Funções de Renderização da ESTRUTURA ---
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
        
        renderTimeBlocks();
        updateWeekDisplay();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }
    
    function renderTimeBlocks() { /* ...código da função... */ }
    function updateWeekDisplay() { /* ...código da função... */ }

    // --- 8. Inicialização e Event Listeners ---
    async function loadInitialData() {
        try {
            const techDataResponse = await fetch('/api/get-dashboard-data');
            if (!techDataResponse.ok) {
                throw new Error(`Failed to load technician data. Status: ${techDataResponse.status}`);
            }
            
            const techData = await techDataResponse.json();
            allTechnicians = techData.technicians || [];
            
            populateTechSelects();
            renderScheduler();
            renderMiniCalendar();

            document.dispatchEvent(new CustomEvent('schedulerReady'));

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            if (techSelectDropdown) {
                techSelectDropdown.innerHTML = `<option value="">Error loading!</option>`;
            }
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        
        // Limpa as opções existentes (exceto a primeira, se houver)
        while (techSelectDropdown.options.length > 1) {
            techSelectDropdown.remove(1);
        }

        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
        } else {
            // Informa ao usuário que nenhum técnico foi encontrado
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
    
    // --- Adicionando todos os Event Listeners ---
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => { /* ...código com dispatchEvent... */ });
    nextWeekBtn.addEventListener('click', () => { /* ...código com dispatchEvent... */ });
    todayBtn.addEventListener('click', () => { /* ...código com dispatchEvent... */ });
    
    // Listeners dos modais
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    // ... todos os outros listeners de modais

    document.addEventListener('appointmentUpdated', () => {
        document.dispatchEvent(new CustomEvent('reloadData'));
    });

    loadInitialData();
});
