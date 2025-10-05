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
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');

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

    const SCHEDULE_DURATION_HOURS = 2;
    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- 3. Funções Auxiliares ---

    function getStartOfWeek(date) { /* ...código existente... */ }
    function formatDateToYYYYMMDD(date) { /* ...código existente... */ }
    function parseSheetDate(dateStr) { /* ...código existente... */ }
    function getTimeHHMM(date) { /* ...código existente... */ }
    function formatDateTimeForInput(dateTimeStr) { /* ...código existente... */ }

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
        
        // **NOVA OPÇÃO ADICIONADA**
        const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        verificationSelect.innerHTML = statusOptions.map(opt =>
            `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditModal() { /* ...código existente... */ }
    function openTimeBlockModal() { /* ...código existente... */ }
    function closeTimeBlockModal() { /* ...código existente... */ }
    function openEditTimeBlockModal(blockData) { /* ...código existente... */ }
    function closeEditTimeBlockModal() { /* ...código existente... */ }

    // --- 5. Funções de Manipulação de Dados (API Calls) ---
    
    async function handleSaveAppointment() { /* ...código existente... */ }
    async function handleSaveTimeBlock() { /* ...código existente... */ }
    async function handleUpdateTimeBlock() { /* ...código existente... */ }
    async function handleDeleteTimeBlock() { /* ...código existente... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código existente... */ }

    // --- 6. Funções de Renderização ---

    function renderScheduler() { /* ...código existente... */ }

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
            let bgColor = 'bg-custom-primary'; // Default
            
            // **NOVA LÓGICA DE COR**
            if (appt.verification === 'Canceled') {
                bgColor = 'bg-cherry-red';
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600';
            } else if (appt.verification === 'Confirmed') {
                bgColor = 'bg-yellow-confirmed text-black'; // Adiciona text-black para melhor contraste
            }

            block.className = `appointment-block ${bgColor} rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.style.top = `${topOffset}px`;

            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);
            block.innerHTML = `<div><p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p><p class="text-sm font-bold truncate">${appt.customers}</p><p class="text-xs font-medium opacity-80">${appt.verification}</p></div>`;
            
            block.addEventListener('click', () => openEditModal(appt));
            dayContainer.appendChild(block);
        });
    }
    
    function renderTimeBlocks() { /* ...código existente... */ }
    function updateWeekDisplay() { /* ...código existente... */ }

    // --- 7. Inicialização e Event Listeners ---
    async function loadInitialData() { /* ...código existente... */ }
    function populateTechSelects() { /* ...código existente... */ }
    async function handleTechSelectionChange(event) { /* ...código existente... */ }

    // ... (todos os outros event listeners permanecem os mesmos) ...
});
