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
    // const modalCloseXBtn = document.getElementById('modal-close-x-btn'); // Removido

    // ... (resto dos seletores)

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
    // ... (resto das funções de modal)

    // --- 5. Funções de Manipulação de Dados (API Calls) ---
    
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

        // Formata a data para a API (YYYY-MM-DDTHH:MM)
        const [datePart, timePart] = newDate.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;

        const dataToUpdate = {
            rowIndex: parseInt(apptId),
            appointmentDate: apiFormattedDate,
            verification: newVerification,
            // Inclui os outros campos existentes para não serem apagados na planilha
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

            // Atualiza os dados locais e re-renderiza tudo
            document.dispatchEvent(new CustomEvent('appointmentUpdated'));
            closeEditModal();

        } catch (error) {
            alert(`Error saving appointment: ${error.message}`);
        } finally {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
        }
    }
    // ... (resto das funções de API)

    // --- 6. Funções de Renderização ---

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
            
            // **INNER HTML ATUALIZADO PARA MOSTRAR PETS**
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
    
    // --- 7. Inicialização e Event Listeners ---
    
    // ... (loadInitialData e outras funções permanecem iguais)

    // Listener para o botão de salvar do modal (o de fechar 'X' foi removido)
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    // ... (resto dos event listeners)
});
