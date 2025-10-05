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
    let allAppointments = []; // Mantido para a lógica do modal
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let miniCalDate = new Date();

    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;

    // --- 3. Funções Auxiliares ---
    function getStartOfWeek(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d; }
    function formatDateToYYYYMMDD(date) { const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}/${month}/${day}`; }
    function parseSheetDate(dateStr) { if (!dateStr) return null; const [datePart, timePart] = dateStr.split(' '); if (!datePart || !timePart) return null; const dateParts = datePart.split('/'); if (dateParts.length !== 3) return null; const [month, day, year] = dateParts.map(Number); const [hour, minute] = timePart.split(':').map(Number); if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null; return new Date(year, month - 1, day, hour, minute); }
    function formatDateTimeForInput(dateTimeStr) { if (!dateTimeStr) return ''; const date = parseSheetDate(dateTimeStr); if (!date) return ''; const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); const hour = date.getHours().toString().padStart(2, '0'); const minute = date.getMinutes().toString().padStart(2, '0'); return `${year}-${month}-${day}T${hour}:${minute}`; }

    // --- 4. Lógica do Mini Calendário ---
    function renderMiniCalendar() { /* ...código da função... */ }

    // --- 5. Funções de Manipulação dos Modais ---
    window.openAppointmentModal = function(appt) { /* ...código da função... */ }
    function closeEditModal() { /* ...código da função... */ }
    function openTimeBlockModal() { /* ...código da função... */ }
    function closeTimeBlockModal() { /* ...código da função... */ }
    function openEditTimeBlockModal(blockData) { /* ...código da função... */ }
    function closeEditTimeBlockModal() { /* ...código da função... */ }

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() { /* ...código da função... */ }
    async function handleSaveTimeBlock() { /* ...código da função... */ }
    async function handleUpdateTimeBlock() { /* ...código da função... */ }
    async function handleDeleteTimeBlock() { /* ...código da função... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código da função... */ }

    // --- 7. Funções de Renderização da ESTRUTURA ---
    function renderScheduler() {
        try {
            schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
            schedulerBody.innerHTML = ''; 
            TIME_SLOTS.forEach((time, rowIndex) => { /* ...código... */ });
            DAY_NAMES.forEach((dayName, dayIndex) => { /* ...código... */ });
            renderTimeBlocks();
            updateWeekDisplay(); // Movido para garantir que sempre seja chamado
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
        renderScheduler(); // Renderiza a estrutura imediatamente para remover o "Loading..."
        renderMiniCalendar();
        try {
            const techDataResponse = await fetch('/api/get-dashboard-data');
            if (!techDataResponse.ok) throw new Error(`Failed to load technician data. Status: ${techDataResponse.status}`);
            const techData = await techDataResponse.json();
            allTechnicians = techData.technicians || [];
            populateTechSelects();
            document.dispatchEvent(new CustomEvent('schedulerReady'));
        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            if (techSelectDropdown) { techSelectDropdown.innerHTML = `<option value="">Error loading!</option>`; }
        }
    }

    function populateTechSelects() { /* ...código da função... */ }

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
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    // ... todos os outros listeners

    loadInitialData();
});
