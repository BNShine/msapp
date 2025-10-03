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

    // NOVOS SELETORES DE BUSCA
    const searchCustomer = document.getElementById('searchCustomer');
    const searchDate = document.getElementById('searchDate');
    const searchCode = document.getElementById('searchCode');
    const searchTechnician = document.getElementById('searchTechnician');
    const searchBtn = document.getElementById('searchBtn');

    // Modal Selectors (New)
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

    // VARIÁVEIS GLOBAIS DENTRO DO ESCOPO DE DOMContentLoaded
    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); // Variável com erro
    
    let techAvailability = {}; 
    let activeSearchApptId = null; 
    
    // CORRIGIDO: 2 horas de duração (120px)
    const SCHEDULE_DURATION_HOURS = 2; 
    const SLOT_HEIGHT_PX = 60; // 1 hora = 60px

    const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [1, 2, 3, 4, 5, 6]; // Mon a Sat
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];

    // --- Helper Functions ---

    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay()); 
        return d;
    }
    
    function getStartOfWeekFromDateStr(dateStr) {
        // Assume dateStr is YYYY/MM/DD HH:MM
        const datePart = dateStr.split(' ')[0]; 
        const parts = datePart.split('/'); // Pega a parte da data YYYY/MM/DD
        // Constrói a data no formato YYYY-MM-DD para garantir o parse correto
        const date = new Date(parts[0], parts[1] - 1, parts[2]); 
        return getStartOfWeek(date);
    }


    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr || dateStr.length < 16) return null;
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function getDayOfWeek(date) {
        return DAY_NAMES[date.getDay()];
    }

    function getTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        // Converte YYYY/MM/DD HH:MM para YYYY-MM-DDTHH:MM (datetime-local format)
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }

    function parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // FUNÇÃO PARA CALCULAR SOBREPOSIÇÃO (2 horas de duração)
    function calculateOverlap(apptA, apptB) {
        const dateA = parseSheetDate(apptA.appointmentDate);
        const dateB = parseSheetDate(apptB.appointmentDate);

        if (!dateA || !dateB || formatDateToYYYYMMDD(dateA) !== formatDateToYYYYMMDD(dateB)) return false;

        const durationMs = SCHEDULE_DURATION_HOURS * 60 * 60 * 1000;
        
        const startA = dateA.getTime();
        const endA = startA + durationMs;
        
        const startB = dateB.getTime();
        const endB = startB + durationMs;

        // Verifica se os intervalos de tempo se sobrepõem
        return (startA < endB) && (endA > startB);
    }
    
    function openEditModal(appt) {
        // Populate static data needed for save payload (read from cache/local appt object)
        modalApptId.value = appt.id;
        modalOriginalTechnician.value = appt.technician;
        // Campos de cache (passados via hidden inputs)
        modalPetShowed.value = appt.petShowed || '';
        modalTips.value = appt.tips || '';
        modalPercentage.value = appt.percentage || '';
        modalPaymentMethod.value = appt.paymentMethod || '';

        // Populate editable fields
        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';

        // Populate Verification dropdown
        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${appt.verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');

        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
    }


    // --- Data Load and Setup ---

    async function loadInitialData() {
        console.log('--- STARTING INITIAL DATA LOAD ---');
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);

            console.log('API /api/get-dashboard-data Status:', techDataResponse.status);
            console.log('API /api/get-technician-appointments Status:', appointmentsResponse.status);

            // VERIFICAÇÃO DE SUCESSO DO FETCH: Se falhar, lança um erro com detalhes.
            if (!techDataResponse.ok) {
                const errorText = await techDataResponse.text();
                let errorDetails = errorText.substring(0, 50) + '...';
                try {
                     const errorJson = JSON.parse(errorText);
                     errorDetails = errorJson.error || errorJson.message || errorDetails;
                } catch (e) {}
                throw new Error(`Failed to load technician list (Status: ${techDataResponse.status}). Details: ${errorDetails}`);
            }
            if (!appointmentsResponse.ok) {
                const errorText = await appointmentsResponse.text();
                let errorDetails = errorText.substring(0, 50) + '...';
                try {
                     const errorJson = JSON.parse(errorText);
                     errorDetails = errorJson.error || errorJson.message || errorDetails;
                } catch (e) {}
                throw new Error(`Failed to load appointments list (Status: ${appointmentsResponse.status}). Details: ${errorDetails}`);
            }


            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();

            allTechnicians = techData.technicians || [];
            allAppointments = apptsData.appointments || [];
            
            console.log('Loaded Technicians Count:', allTechnicians.length);
            console.log('Loaded Appointments Count (Raw):', allAppointments.length);
            
            // Filtra e remove agendamentos sem data válida
            allAppointments = allAppointments.filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            console.log('Loaded Appointments Count (Valid):', allAppointments.length);


            initializeAvailability(); 
            populateTechSelects();
            renderScheduler(); 
            console.log('--- INITIAL DATA LOAD SUCCESSFUL ---');


        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            
            const userMessage = `Falha ao carregar dados iniciais. ${error.message || 'Erro desconhecido.'} Verifique a API e as variáveis de ambiente.`;
            alert(userMessage);

            if (techSelectDropdown) {
                const displayError
