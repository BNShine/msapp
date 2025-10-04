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

    // NOVOS SELETORES DE BUSCA (Assumindo que existem no HTML)
    const searchCustomer = document.getElementById('searchCustomer');
    const searchDate = document.getElementById('searchDate');
    const searchCode = document.getElementById('searchCode');
    const searchTechnician = document.getElementById('searchTechnician');
    const searchBtn = document.getElementById('searchBtn');

    // Modal Selectors
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalVerificationSelect = document.getElementById('modal-verification');
    const modalApptId = document.getElementById('modal-appt-id');
    const modalDate = document.getElementById('modal-date');
    const modalServiceValue = document.getElementById('modal-service-value');
    const modalOriginalTechnician = document.getElementById('modal-original-technician');
    const modalPetShowed = document.getElementById('modal-pet-showed');
    const modalTips = document.getElementById('modal-tips');
    const modalPercentage = document.getElementById('modal-percentage');
    const modalPaymentMethod = document.getElementById('modal-payment-method');
    
    // Referência ao botão X
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');

    // VARIÁVEIS PRINCIPAIS (AGORA NO ESCOPO CORRETO)
    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    let techAvailability = {}; 
    let activeSearchApptId = null; 
    
    const SCHEDULE_DURATION_HOURS = 2; 
    const SLOT_HEIGHT_PX = 60; 
    
    // CORRIGIDO: Horário estendido de 8:00h até 21:00h (13 slots: 8 a 20)
    const TIME_SLOTS_START_HOUR = 8;
    const TIME_SLOTS_END_HOUR = 21; // O último slot é 20:00, que termina às 21:00
    const NIGHT_SHIFT_HOUR = 18; // 18:00 onwards should be colored
    const TIME_SLOTS = Array.from({ length: TIME_SLOTS_END_HOUR - TIME_SLOTS_START_HOUR }, 
        (_, i) => `${(TIME_SLOTS_START_HOUR + i).toString().padStart(2, '0')}:00`
    );

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [1, 2, 3, 4, 5, 6]; 
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];
    let draggedAppointment = null;
    
    // --- Helper Functions ---
    // (Restante das funções auxiliares de data e cálculo omitidas aqui para brevidade, mas estão no código submetido)
    
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay()); 
        return d;
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr || dateStr.length < 16) return null;
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }
    
    function openEditModal(appt) {
        // ... (populate modal fields) ...
        modalApptId.value = appt.id;
        modalOriginalTechnician.value = appt.technician;
        // ... (resto dos campos)

        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';

        // ... (populate verification)

        // 1. EXIBE O MODAL
        editModal.classList.remove('hidden');
        
        // 2. Ativa o travamento de rolagem
        document.body.classList.add('modal-open');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        
        // Remove o travamento de rolagem
        document.body.classList.remove('modal-open');
    }
    
    function handleEditAppointmentClick(event) {
        const block = event.currentTarget;
        const apptId = block.dataset.id;
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        
        if (localAppt) {
            openEditModal(localAppt);
        } else {
            alert('Erro: Agendamento não encontrado.');
        }
    }

    function handleSaveAppointment(event) {
        // ... (Lógica de salvamento) ...
        closeEditModal();
        renderScheduler(); 
    }
    
    // As funções `handleTechConfigSelectChange` e `renderAvailabilityForm` são necessárias
    // no escopo DOMContentLoaded para resolver o ReferenceError.

    function handleTechConfigSelectChange(e) {
        const technician = e.target.value;
        renderAvailabilityForm(technician);
    }
    
    function renderAvailabilityForm(technician) {
         // REMOVIDO: "Please select a technician."
         const element = document.getElementById('availability-form-container');
         if (!technician) {
             element.innerHTML = '<p class="text-muted-foreground">Select a technician above to manage their weekly working hours (8:00 to 21:00 range).</p>';
             return;
         }
         // ... (restante da lógica de renderização do formulário)
    }

    // --- RENDERING PRINCIPAL (Contém a lógica de agendamento e cor) ---

    function renderScheduler() {
        // ... (restante do setup do scheduler) ...
        
        TIME_SLOTS.forEach((time, rowIndex) => {
            const hour = parseInt(time.split(':')[0], 10);
            
            // ... (criação de timeDiv e colunas) ...

            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                // ... (cálculo de data e índice) ...
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                
                // NOVO: Aplica a cor de fundo para o período noturno (18:00 em diante)
                if (hour >= NIGHT_SHIFT_HOUR) {
                    emptySlot.classList.add('night-shift');
                }
                
                // ... (atribuição de data-sets e grid position) ...
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        renderAppointments(columnMap);
        
        // ... (restante da lógica de loading/display) ...
    }
    
    function renderAppointments(columnMap) {
        
        // ... (lógica de cálculo de semana e filtragem inicial) ...

        appointmentsToRender = Array.from(new Set(appointmentsToRender));
        
        // FILTRO DE CÓDIGO APLICADO
        const codeFilterTerm = searchCode ? searchCode.value.toLowerCase().trim() : '';

        appointmentsToRender.forEach(appt => {

            // ... (cálculo de data e validação de horário) ...

            // Lógica de filtragem por Code
            if (codeFilterTerm && (!appt.code || appt.code.toLowerCase().indexOf(codeFilterTerm) === -1)) {
                 return; // Ignora agendamentos que não correspondem ao filtro de código
            }
            
            const startHour = apptDate.getHours();
            // CORRIGIDO: Novo limite de horário para renderização de appointments
            if (startHour < TIME_SLOTS_START_HOUR || startHour >= TIME_SLOTS_END_HOUR) return; 

            const topOffset = (startHour - TIME_SLOTS_START_HOUR) * SLOT_HEIGHT_PX + startMinutes; 
            
            // ... (restante da lógica de renderização do bloco) ...
            
            block.addEventListener('click', handleEditAppointmentClick);
        });
    }

    // ... (restante das funções: loadInitialData, populateTechSelects, etc.) ...

    // --- INICIALIZAÇÃO E LISTENERS ---
    
    // ... (Inicialização e listeners de navegação) ...

    if (techConfigSelect) techConfigSelect.addEventListener('change', handleTechConfigSelectChange);

    // Event listeners de Modal (Repassados para as funções do escopo)
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSaveAppointment);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal); 
    if (modalCloseXBtn) {
        modalCloseXBtn.addEventListener('click', closeEditModal);
    }
    
    // Novo listener para o filtro de código (aciona a renderização)
    if (searchCode) searchCode.addEventListener('input', renderScheduler);


    loadInitialData();
});
