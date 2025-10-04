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
        const currentVerification = appt.verification || "Scheduled";
        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${opt === currentVerification ? 'selected' : ''}>${opt}</option>`
        ).join('');
        

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

    // Função de tratamento de salvamento do modal (mantida a simplicidade para o foco do log)
    function handleSaveAppointment(event) {
        // Lógica de salvamento... (não implementada neste arquivo)
        closeEditModal();
        renderScheduler(); 
    }
    
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
         // Lógica de renderização do formulário de disponibilidade (omissa para manter o foco)
         element.innerHTML = `<p class="text-green-600">Formulário de disponibilidade para ${technician} renderizado (Funcionalidade não implementada).</p>`;
    }
    
    // --- NOVO: Função para popular os dropdowns de técnico ---
    function populateTechSelects(technicians) {
        console.log('[CALENDAR LOG] Chamando populateTechSelects. Total de técnicos recebidos:', technicians.length);
        
        if (techSelectDropdown) {
            // Limpa as opções existentes
            techSelectDropdown.innerHTML = '<option value="">Select Technician</option>'; 
            technicians.forEach(tech => {
                if (tech) {
                    const option = document.createElement('option');
                    option.value = tech;
                    option.textContent = tech;
                    techSelectDropdown.appendChild(option);
                }
            });
            console.log('[CALENDAR LOG] Dropdown de Weekly Schedule (tech-select-dropdown) populado.');
        } else {
            console.error('[CALENDAR LOG] Elemento tech-select-dropdown não encontrado.');
        }

        if (techConfigSelect) {
            // Limpa as opções existentes
            techConfigSelect.innerHTML = '<option value="">Select Technician</option>';
            technicians.forEach(tech => {
                 if (tech) {
                    const option = document.createElement('option');
                    option.value = tech;
                    option.textContent = tech;
                    techConfigSelect.appendChild(option);
                 }
            });
            console.log('[CALENDAR LOG] Dropdown de Configuração (tech-config-select) populado.');
        } else {
             console.error('[CALENDAR LOG] Elemento tech-config-select não encontrado.');
        }
        
        // Seleciona o primeiro técnico por padrão se houver
        if (technicians.length > 0 && techSelectDropdown) {
             techSelectDropdown.value = technicians[0];
             selectedTechnician = technicians[0];
             renderScheduler(); // Renderiza o calendário para o primeiro técnico
        }
    }


    // --- RENDERING PRINCIPAL (Contém a lógica de agendamento e cor) ---

    function renderScheduler() {
        // ... (restante do setup do scheduler) ...
        
        // Assume renderScheduler also updates the header with days of the week
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        
        // Generate day headers (Mon-Sat)
        for (let i = 1; i <= 6; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-r border-border';
            header.textContent = `${DAY_NAMES[i]} (${date.getDate()}/${date.getMonth() + 1})`;
            schedulerHeader.appendChild(header);
        }

        schedulerBody.innerHTML = ''; // Clear previous slots
        const columnMap = {};
        
        TIME_SLOTS.forEach((time, rowIndex) => {
            const hour = parseInt(time.split(':')[0], 10);
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-sm font-medium border-b border-border';
            timeDiv.textContent = time;
            schedulerBody.appendChild(timeDiv);

            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + dayIndex);
                const dateKey = date.toDateString(); // Used for mapping appointments
                
                if (!columnMap[dateKey]) columnMap[dateKey] = [];
                columnMap[dateKey].push(dayIndex + 1); // Grid column index

                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                
                // NOVO: Aplica a cor de fundo para o período noturno (18:00 em diante)
                if (hour >= NIGHT_SHIFT_HOUR) {
                    emptySlot.classList.add('night-shift');
                }
                
                emptySlot.style.gridRow = `${rowIndex + 1}`;
                emptySlot.style.gridColumn = `${dayIndex + 1}`;
                
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        renderAppointments(columnMap);
        
        // Update week display
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

        // Update loading overlay state
        if (selectedTechnician) {
             loadingOverlay.classList.add('hidden');
        } else {
             loadingOverlay.classList.remove('hidden');
             loadingOverlay.innerHTML = '<p class="text-xl font-semibold text-muted-foreground">Select a technician to view schedule.</p>';
        }
    }
    
    function renderAppointments(columnMap) {
        if (!selectedTechnician) return;
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        
        let appointmentsToRender = allAppointments.filter(appt => 
             appt.technician === selectedTechnician
        );

        // FILTRO DE CÓDIGO APLICADO
        const codeFilterTerm = searchCode ? searchCode.value.toLowerCase().trim() : '';

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            const apptDay = apptDate.getDay(); 
            const isVisibleDay = VISIBLE_DAY_INDICES.includes(apptDay);
            
            // Filter by current week
            if (apptDate < currentWeekStart || apptDate >= weekEnd) return;
            
            // Check if it's a visible day (Mon-Sat)
            if (!isVisibleDay) return;

            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes() / 60 * SLOT_HEIGHT_PX;
            
            // CORRIGIDO: Novo limite de horário para renderização de appointments
            if (startHour < TIME_SLOTS_START_HOUR || startHour >= TIME_SLOTS_END_HOUR) return; 

            // Lógica de filtragem por Code
            if (codeFilterTerm && (!appt.code || appt.code.toLowerCase().indexOf(codeFilterTerm) === -1)) {
                 return; // Ignora agendamentos que não correspondem ao filtro de código
            }
            
            const topOffset = (startHour - TIME_SLOTS_START_HOUR) * SLOT_HEIGHT_PX + startMinutes; 
            const column = apptDay; // apptDay is 1 (Mon) to 6 (Sat)
            
            const duration = SCHEDULE_DURATION_HOURS * SLOT_HEIGHT_PX; // 120px

            // Estilos
            let bgColor = 'bg-custom-primary'; 
            let borderColor = 'border-brand-primary';
            let verificationText = appt.verification || 'Scheduled';
            
            if (verificationText === 'Canceled') {
                bgColor = 'bg-cherry-red';
                borderColor = 'border-cherry-red';
            } else if (verificationText === 'Showed') {
                bgColor = 'bg-green-600';
                borderColor = 'border-green-600';
            }
            
            // Cria o bloco de agendamento
            const block = document.createElement('div');
            block.className = `appointment-block ${bgColor} text-white rounded-md shadow-medium border ${borderColor} transition-all duration-300 hover:shadow-large cursor-pointer`;
            block.dataset.id = appt.id;
            block.dataset.date = appt.appointmentDate;
            block.style.top = `${topOffset}px`;
            block.style.height = `${duration}px`;
            block.style.gridColumn = column + 1; // Ajusta para a coluna correta (1 é o tempo)

            block.innerHTML = `
                <div class="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">${appt.customers || 'N/A'}</div>
                <div class="text-xs mt-1">Code: ${appt.code || 'N/A'}</div>
                <div class="text-xs mt-1 font-medium">${startHour}:00 - ${startHour + SCHEDULE_DURATION_HOURS}:00</div>
                <div class="text-xs mt-1 font-bold">${verificationText}</div>
            `;
            
            schedulerBody.appendChild(block);
            
            block.addEventListener('click', handleEditAppointmentClick);
        });
    }

    // --- CÓDIGO INICIALIZAÇÃO (MODIFICADO COM LOGS) ---
    
    async function loadInitialData() {
        console.log('[CALENDAR LOG] 1. Iniciando loadInitialData.');
        loadingOverlay.innerHTML = '<p class="text-xl font-semibold text-muted-foreground">Loading initial data...</p>';
        loadingOverlay.classList.remove('hidden');
        
        try {
            // 1. Fetch Technicians List
            const [techResponse, apptResponse] = await Promise.all([
                 fetch('/api/get-dashboard-data'), // Fetches technicians list
                 fetch('/api/get-technician-appointments') // Fetches appointments
            ]);

            console.log('[CALENDAR LOG] 2. Resposta da API de Técnicos (get-dashboard-data): Status', techResponse.status);
            if (!techResponse.ok) {
                 const error = await techResponse.json().catch(() => ({ error: 'Unknown Error' }));
                 throw new Error(`Failed to load technicians: ${error.error || techResponse.statusText}`);
            }

            const techData = await techResponse.json();
            allTechnicians = techData.technicians || [];
            console.log('[CALENDAR LOG] 3. allTechnicians carregado:', allTechnicians);

            // 2. Fetch Appointments
            console.log('[CALENDAR LOG] 4. Resposta da API de Agendamentos (get-technician-appointments): Status', apptResponse.status);
            if (!apptResponse.ok) {
                 const error = await apptResponse.json().catch(() => ({ error: 'Unknown Error' }));
                 throw new Error(`Failed to load appointments: ${error.error || apptResponse.statusText}`);
            }
            
            const apptData = await apptResponse.json();
            allAppointments = apptData.appointments || [];
            console.log('[CALENDAR LOG] 5. allAppointments carregado. Total:', allAppointments.length);


            // 3. Populate Dropdowns and Render
            populateTechSelects(allTechnicians.sort()); // Populate dropdowns
            
            if (allTechnicians.length === 0) {
                 loadingOverlay.innerHTML = '<p class="text-xl font-semibold text-red-600">No technicians found. Please check your Sheets setup.</p>';
            } else if (!selectedTechnician) {
                 // Set initial selection if not set by populateTechSelects
                 selectedTechnician = techSelectDropdown.value;
                 renderScheduler();
            }
            
        } catch (error) {
            console.error('[CALENDAR LOG] Erro Crítico no loadInitialData:', error);
            loadingOverlay.innerHTML = `<p class="text-xl font-semibold text-red-600">ERROR: ${error.message}</p>`;
            loadingOverlay.classList.remove('hidden');
        } finally {
            // Wait for initial render to set final state
            if (allTechnicians.length > 0) {
                 loadingOverlay.classList.add('hidden');
            }
        }
    }


    // --- INICIALIZAÇÃO E LISTENERS ---
    
    // Listeners de navegação (Previous Week/Next Week)
    prevWeekBtn.addEventListener('click', () => {
         currentWeekStart.setDate(currentWeekStart.getDate() - 7);
         renderScheduler();
    });
    nextWeekBtn.addEventListener('click', () => {
         currentWeekStart.setDate(currentWeekStart.getDate() + 7);
         renderScheduler();
    });

    if (techSelectDropdown) techSelectDropdown.addEventListener('change', (e) => {
         selectedTechnician = e.target.value;
         console.log('[CALENDAR LOG] Técnico selecionado alterado para:', selectedTechnician);
         renderScheduler();
    });
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
