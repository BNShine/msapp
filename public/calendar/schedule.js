// public/calendar/schedule.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Seletores de Elementos ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    // ... (outros seletores permanecem iguais)

    // --- 2. Variáveis Globais e Constantes ---
    let allAppointments = [];
    let allTechnicians = [];
    // ... (outras variáveis permanecem iguais)

    // --- 3. Funções Auxiliares ---
    // ... (todas as funções auxiliares permanecem iguais)

    // --- 4. Funções de Manipulação dos Modais ---
    // ... (todas as funções de modais permanecem iguais)

    // --- 5. Funções de Manipulação de Dados (API Calls) ---
    // ... (todas as funções de API permanecem iguais)

    // --- 6. Funções de Renderização ---
    // ... (todas as funções de renderização permanecem iguais)

    // --- 7. Inicialização e Event Listeners (COM ALTERAÇÕES) ---

    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);
            
            if (!techDataResponse.ok) {
                throw new Error(`Failed to load technician data. Status: ${techDataResponse.status}`);
            }
            
            const techData = await techDataResponse.json();
            allTechnicians = techData.technicians || [];

            if (appointmentsResponse.ok) {
                const apptsData = await appointmentsResponse.json();
                allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            } else {
                console.warn("Could not load appointments, but continuing with technician list.");
                allAppointments = [];
            }
            
            populateTechSelects();
            renderScheduler();

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            // **NOVO** - Informa o usuário diretamente na UI sobre a falha
            const techSelectDropdown = document.getElementById('tech-select-dropdown');
            if (techSelectDropdown) {
                techSelectDropdown.innerHTML = `<option value="">Error loading technicians!</option>`;
            }
        }
    }

    function populateTechSelects() {
        const techSelectDropdown = document.getElementById('tech-select-dropdown');
        if (!techSelectDropdown) return;

        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
        } else {
            // **NOVO** - Mensagem clara se nenhum técnico for encontrado
            techSelectDropdown.innerHTML = '<option value="">No technicians found.</option>';
        }
    }

    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        selectedTechDisplay.textContent = selectedTechnician || 'No Technician Selected';
        await fetchAvailabilityForSelectedTech();
        renderScheduler();
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

    // ... (o restante do arquivo, incluindo todos os outros event listeners, permanece exatamente igual)
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    modalCloseXBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', async () => {
        const appointmentsResponse = await fetch('/api/get-technician-appointments');
        const apptsData = await appointmentsResponse.json();
        allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
        renderScheduler();
    });

    loadInitialData();
});
