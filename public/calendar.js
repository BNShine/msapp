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

    // Referência explícita ao botão X
    const closeXButton = editModal.querySelector('.absolute.top-4.right-4');

    // VARIÁVEIS PRINCIPAIS (AGORA NO ESCOPO CORRETO)
    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    let techAvailability = {}; 
    let activeSearchApptId = null; 
    
    const SCHEDULE_DURATION_HOURS = 2; 
    const SLOT_HEIGHT_PX = 60; 

    const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [1, 2, 3, 4, 5, 6]; 
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];
    let draggedAppointment = null;
    
    // --- Helper Functions (Somente as alteradas são exibidas para brevidade) ---

    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay()); 
        return d;
    }
    
    function getStartOfWeekFromDateStr(dateStr) {
        const datePart = dateStr.split(' ')[0]; 
        const parts = datePart.split('/'); 
        const date = new Date(parts[0], parts[1] - 1, parts[2]); 
        return getStartOfWeek(date);
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }

    function openEditModal(appt) {
        modalApptId.value = appt.id;
        modalOriginalTechnician.value = appt.technician;
        modalPetShowed.value = appt.petShowed || '';
        modalTips.value = appt.tips || '';
        modalPercentage.value = appt.percentage || '';
        modalPaymentMethod.value = appt.paymentMethod || '';

        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';

        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${appt.verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');

        // EXIBE O MODAL
        editModal.classList.remove('hidden');
        
        // Ativa o travamento de rolagem
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

    async function handleSaveAppointment(event) {
        event.stopPropagation();
        
        const apptId = modalApptId.value;
        const newDateLocal = modalDate.value;
        const newVerification = modalVerificationSelect.value;
        const newServiceShowed = modalServiceValue.value; 
        
        if (!newDateLocal || !newVerification) {
             alert("Data e Status são campos obrigatórios.");
             return;
        }

        const newAppointmentDateSheetFormat = newDateLocal.replace('T', ' ').replace(/-/g, '/');
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        
        if (!localAppt) {
            alert('Erro: Agendamento não encontrado localmente.');
            return;
        }

        const dataToUpdate = {
            rowIndex: parseInt(apptId, 10), 
            appointmentDate: newDateLocal, 
            verification: newVerification,
            serviceShowed: newServiceShowed, 
            technician: localAppt.technician,
            petShowed: modalPetShowed.value || '',
            tips: modalTips.value || '',
            percentage: modalPercentage.value || '',
            paymentMethod: modalPaymentMethod.value || '',
        };

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });

            const result = await response.json();
            
            if (result.success) {
                // Atualiza o registro localmente
                localAppt.appointmentDate = newAppointmentDateSheetFormat;
                localAppt.verification = newVerification;
                localAppt.serviceShowed = newServiceShowed;
                localAppt.petShowed = dataToUpdate.petShowed;
                localAppt.tips = dataToUpdate.tips;
                localAppt.percentage = dataToUpdate.percentage;
                localAppt.paymentMethod = dataToUpdate.paymentMethod;
                
                alert('Agendamento atualizado com sucesso!');
                closeEditModal();
                renderScheduler(); 
            } else {
                alert(`Erro ao salvar: ${result.message}`);
            }
        } catch (error) {
            console.error('Erro na requisição da API:', error);
            alert('Erro de comunicação com o servidor. Tente novamente.');
        }
    }

    // --- Outras Funções (Renderização, D&D, etc. - Sem Alterações Críticas) ---

    // ... (restante das funções: addDragAndDropListeners, renderAppointments, loadInitialData, etc.) ...
    
    // As funções que não estão aqui, como renderScheduler, updateWeekDisplay, etc., permanecem as mesmas.

    // INÍCIO DOS LISTENERS

    if (schedulerBody) {
        // Listener Drop D&D
        schedulerBody.addEventListener('drop', async (e) => {
            e.preventDefault();
            
            // ... (lógica D&D)
            const localAppt = allAppointments.find(a => String(a.id) === draggedAppointment.id);
            // ...
            
            // Simulação de sucesso para forçar o fechamento do modal e render
            alert('Agendamento movido com sucesso!'); 
            renderScheduler(); 
        });
    }

    // Adiciona listener para o clique em agendamentos (já está configurado na função renderAppointments)
    // block.addEventListener('click', handleEditAppointmentClick);

    // Event listeners de Navegação
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => { /* ... */ });
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => { /* ... */ });
    
    // Event listeners do Modal
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSaveAppointment);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal); 
    
    // Listener do botão X
    if (closeXButton) {
        closeXButton.addEventListener('click', closeEditModal);
    }
    
    // Event listeners para Disponibilidade/Busca
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);
    if (saveAvailabilityBtn) saveAvailabilityBtn.addEventListener('click', () => { /* ... */ });
    if (techConfigSelect) techConfigSelect.addEventListener('change', handleTechConfigSelectChange);

    // INICIALIZAÇÃO
    loadInitialData();
});
