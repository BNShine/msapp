// public/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const techConfigSelect = document.getElementById('tech-config-select');
    const searchCode = document.getElementById('searchCode');

    // Modal Selectors
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');
    
    // Modal Form Fields
    const modalApptId = document.getElementById('modal-appt-id');
    const modalDate = document.getElementById('modal-date');
    const modalVerificationSelect = document.getElementById('modal-verification');
    const modalServiceValue = document.getElementById('modal-service-value');
    
    // Hidden fields for payload
    const modalOriginalTechnician = document.getElementById('modal-original-technician');
    const modalPetShowed = document.getElementById('modal-pet-showed');
    const modalTips = document.getElementById('modal-tips');
    const modalPercentage = document.getElementById('modal-percentage');
    const modalPaymentMethod = document.getElementById('modal-payment-method');

    // Global state variables
    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    const SCHEDULE_DURATION_HOURS = 2; 
    const SLOT_HEIGHT_PX = 60; 
    
    const TIME_SLOTS_START_HOUR = 8;
    const TIME_SLOTS_END_HOUR = 22;
    const NIGHT_SHIFT_HOUR = 18;
    const TIME_SLOTS = Array.from({ length: TIME_SLOTS_END_HOUR - TIME_SLOTS_START_HOUR }, 
        (_, i) => `${(TIME_SLOTS_START_HOUR + i).toString().padStart(2, '0')}:00`
    );

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [1, 2, 3, 4, 5, 6]; 
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];
    
    // --- Helper Functions ---
    
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        return new Date(d.setDate(diff));
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr || !dateStr.includes('/') || !dateStr.includes(':')) return null;
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }
    
    // CORRIGIDO: Lógica de abrir o modal e popular os campos.
    function openEditModal(appt) {
        if (!appt) return;

        // Preenche campos escondidos que a API precisa
        modalApptId.value = appt.id; // sheetRowNumber
        modalOriginalTechnician.value = appt.technician;
        modalPetShowed.value = appt.petShowed || ''; 
        modalTips.value = appt.tips || '';
        modalPercentage.value = appt.percentage || '';
        modalPaymentMethod.value = appt.paymentMethod || '';
        
        // Preenche campos visíveis e editáveis
        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';
        
        // Popula o select de 'Verification'
        const currentVerification = appt.verification || "Scheduled";
        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${opt === currentVerification ? 'selected' : ''}>${opt}</option>`
        ).join('');

        // Mostra o modal e trava o scroll da página
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    // CORRIGIDO: Lógica para fechar o modal.
    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
    
    function handleEditAppointmentClick(event) {
        const block = event.currentTarget;
        const apptId = block.dataset.id;
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        
        if (localAppt) {
            openEditModal(localAppt);
        } else {
            console.error('Appointment data not found for ID:', apptId);
            alert('Error: Could not find appointment details.');
        }
    }

    // CORRIGIDO: Lógica completa para salvar os dados do modal.
    async function handleSaveAppointment() {
        const dataToSend = {
            rowIndex: parseInt(modalApptId.value, 10),
            appointmentDate: modalDate.value,
            verification: modalVerificationSelect.value,
            serviceShowed: modalServiceValue.value,
            technician: modalOriginalTechnician.value, 
            petShowed: modalPetShowed.value,
            tips: modalTips.value,
            percentage: modalPercentage.value,
            paymentMethod: modalPaymentMethod.value,
        };

        console.log('[SAVING DATA]', dataToSend);

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });

            const result = await response.json();

            if (result.success) {
                alert('Appointment updated successfully!');
                await loadInitialData(true); // Recarrega os dados para refletir a mudança
            } else {
                throw new Error(result.message || 'Unknown error occurred.');
            }
        } catch (error) {
            console.error('Failed to save appointment:', error);
            alert(`Error saving appointment: ${error.message}`);
        } finally {
            closeEditModal();
        }
    }
    
    function populateTechSelects(technicians) {
        const createOptions = (techList) => techList.map(tech => `<option value="${tech}">${tech}</option>`).join('');
        
        if (techSelectDropdown) {
            techSelectDropdown.innerHTML = `<option value="">Select Technician</option>${createOptions(technicians)}`;
        }
        if (techConfigSelect) {
            techConfigSelect.innerHTML = `<option value="">Select Technician</option>${createOptions(technicians)}`;
        }
        
        // Mantém a seleção do técnico após o reload
        if (selectedTechnician && technicians.includes(selectedTechnician)) {
            techSelectDropdown.value = selectedTechnician;
        }
    }

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        
        for (let i of VISIBLE_DAY_INDICES) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i - 1); // Ajusta para o dia correto (segunda a sábado)
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-r border-border';
            header.textContent = `${DAY_NAMES[i]} (${date.getDate()}/${date.getMonth() + 1})`;
            schedulerHeader.appendChild(header);
        }

        schedulerBody.innerHTML = '';
        
        TIME_SLOTS.
