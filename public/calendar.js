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

    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    let techAvailability = {}; 
    let activeSearchApptId = null; // Armazena o ID do agendamento encontrado na busca, se houver.
    
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
            
            // --- CORREÇÃO: Tratamento de erro melhorado ---
            const userMessage = `Falha ao carregar dados iniciais. ${error.message || 'Erro desconhecido.'} Verifique a API e as variáveis de ambiente.`;
            alert(userMessage);

            // Garante que o dropdown de técnico exiba o erro
            if (techSelectDropdown) {
                // Limita a mensagem de erro para caber no dropdown
                const displayError = (error.message || 'Erro de API').substring(0, 40) + '...';
                techSelectDropdown.innerHTML = `<option value="">ERROR: ${displayError}</option>`;
                selectedTechDisplay.textContent = 'ERROR';
                loadingOverlay.classList.remove('hidden');
            }
            // --- Fim CORREÇÃO ---
        }
    }
    
    function populateTechSelects() {
        if (!techSelectDropdown) return; 

        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techSelectDropdown.appendChild(option);
        });
        
        if (techConfigSelect) {
            techConfigSelect.innerHTML = '<option value="">Select Technician</option>' + 
                allTechnicians.map(tech => `<option value="${tech}">${tech}</option>`).join('');
        }

        techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    }
    
    function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        activeSearchApptId = null; // Reseta a busca ao mudar o técnico
        if (selectedTechnician) {
            selectedTechDisplay.textContent = selectedTechnician;
            loadingOverlay.classList.add('hidden');
        } else {
            selectedTechDisplay.textContent = 'No Technician Selected';
            loadingOverlay.classList.remove('hidden');
        }
        renderScheduler();
    }
    

    // --- UI Logic: Scheduler Rendering ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        
        // Renderiza os cabeçalhos das colunas (Dia da Semana + Data)
        const columnMap = {};
        VISIBLE_DAY_INDICES.forEach((dayIndex, colIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            
            const dayName = getDayOfWeek(date);
            const dateKey = formatDateToYYYYMMDD(date);
            
            columnMap[dateKey] = colIndex + 2; // Colunas de dados começam em 2
            
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[dateKey];
            header.textContent = `${dayName} ${date.getDate()} / ${selectedTechnician.split(' ')[0] || ''}`; 
            schedulerHeader.appendChild(header);
        });
        
        // Preenche a grade com slots vazios (necessário para o grid)
        TIME_SLOTS.forEach((time, rowIndex) => {
            // Linha do tempo
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = rowIndex + 1;
            timeDiv.style.gridColumn = 1;
            schedulerBody.appendChild(timeDiv);

            // Slots vazios para os dias da semana (Containers de Drop)
            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + dayIndex);
                const dateKey = formatDateToYYYYMMDD(date);

                const globalColIndex = columnMap[dateKey];
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                emptySlot.dataset.tech = selectedTechnician; 
                emptySlot.dataset.time = time;
                emptySlot.dataset.datekey = dateKey; 
                emptySlot.style.gridRow = rowIndex + 1;
                emptySlot.style.gridColumn = globalColIndex;
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        renderAppointments(columnMap);
        
        if (!selectedTechnician && activeSearchApptId === null) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
        
        updateWeekDisplay();
    }
    
    function renderAppointments(columnMap) {
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        
        let appointmentsToRender = [];
        
        if (activeSearchApptId !== null) {
             // Se houver uma busca ativa, encontre o agendamento específico
             const foundAppt = allAppointments.find(appt => String(appt.id) === String(activeSearchApptId));
             if (foundAppt) {
                 appointmentsToRender.push(foundAppt);
                 
                 // Filtra outros agendamentos do MESMO TÉCNICO na mesma semana para verificar sobreposição
                 appointmentsToRender = appointmentsToRender.concat(allAppointments.filter(appt => 
                     appt.technician === foundAppt.technician && String(appt.id) !== String(activeSearchApptId)
                 ));
             }
        } else if (selectedTechnician) {
             // Caso contrário, filtra pelo técnico selecionado
             appointmentsToRender = allAppointments.filter(appt => 
                 appt.technician === selectedTechnician
             );
        }
        
        // Remove duplicatas (se necessário)
        appointmentsToRender = Array.from(new Set(appointmentsToRender));


        appointmentsToRender.forEach(appt => {

            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            if (apptDate < currentWeekStart || apptDate >= weekEnd) {
                // Se o agendamento não pertence à semana, pule.
                return;
            }
            
            const dateKey = formatDateToYYYYMMDD(apptDate);
            
            const colIndex = columnMap[dateKey];
            
            // CORREÇÃO: Pula se o agendamento não tem uma coluna válida (dia visível)
            if (!colIndex) return; 
            
            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes();
            
            if (startHour < 8 || startHour >= 18) return; 

            // Cálculo da posição TOP em relação ao TOPO DO SCHEDULER BODY (8:00)
            const topOffset = (startHour - 8) * SLOT_HEIGHT_PX + startMinutes; 
            
            const block = document.createElement('div');
            
            // Cor de Fundo
            let bgColor = 'bg-custom-primary'; 
            
            if (appt.verification === 'Canceled') {
                // Usando a classe Cherry Red
                bgColor = 'bg-cherry-red'; 
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600'; 
            }
            
            // Lógica de Overlap: Verifica se há outro agendamento do mesmo técnico que se sobrepõe
            const overlappingAppts = allAppointments.filter(otherAppt => {
                if (otherAppt.id === appt.id) return false;
                
                // Apenas verifica sobreposição com outros agendamentos do MESMO TÉCNICO
                if (otherAppt.technician !== appt.technician) return false;
                
                return calculateOverlap(appt, otherAppt);
            });

            if (overlappingAppts.length > 0) {
                // Borda amarela para sobreposição (#ffda2d)
                block.style.borderColor = '#ffda2d'; 
                block.style.borderWidth = '2px';
                block.style.borderStyle = 'solid'; 
            }

            block.className = `appointment-block ${bgColor} text-white rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.dataset.technician = appt.technician;
            block.dataset.date = appt.appointmentDate; 
            block.dataset.serviceshowed = appt.serviceShowed || ''; 
            block.dataset.verification = appt.verification; 
            block.draggable = true;
            
            // CORREÇÃO CRÍTICA: Definir a COLUNA DO GRID explicitamente para evitar vazamento horizontal
            block.style.gridColumnStart = colIndex; 
            block.style.gridColumnEnd = colIndex + 1;
            
            // POSICIONAMENTO: Altura e Posição
            block.style.top = `${topOffset}px`;
            block.style.height = `${SCHEDULE_DURATION_HOURS * SLOT_HEIGHT_PX}px`; 

            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);

            block.innerHTML = `
                <div data-view-content>
                    <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                    <p class="text-sm font-bold truncate">${appt.customers}</p>
                    <p class="text-xs font-medium text-white/80">${appt.verification}</p>
                    <p class="text-xs font-medium text-white/80">R$${appt.serviceShowed || '0.00'}</p>
                </div>
            `;
            
            schedulerBody.appendChild(block);
            
            addDragAndDropListeners(block);
            block.addEventListener('click', handleEditAppointmentClick);
        });
    }

    // --- Lógica de Busca ---
    function handleSearch() {
        const customerTerm = searchCustomer.value.toLowerCase().trim();
        // Converte o formato do input Date (YYYY-MM-DD) para o formato da planilha (YYYY/MM/DD)
        const dateTerm = searchDate.value ? searchDate.value.replace(/-/g, '/') : ''; 
        const codeTerm = searchCode.value.toLowerCase().trim();
        const techTerm = searchTechnician.value.toLowerCase().trim();

        if (!customerTerm && !dateTerm && !codeTerm && !techTerm) {
            alert("Please enter at least one search criterion.");
            activeSearchApptId = null;
            renderScheduler();
            return;
        }

        const foundAppt = allAppointments.find(appt => {
            const matchesCustomer = !customerTerm || (appt.customers && appt.customers.toLowerCase().includes(customerTerm));
            // A busca por data usa startsWith para encontrar a data, ignorando a hora
            const matchesDate = !dateTerm || (appt.appointmentDate && appt.appointmentDate.startsWith(dateTerm));
            const matchesCode = !codeTerm || (appt.code && appt.code.toLowerCase() === codeTerm);
            const matchesTech = !techTerm || (appt.technician && appt.technician.toLowerCase().includes(techTerm));
            
            return matchesCustomer && matchesDate && matchesCode && matchesTech;
        });

        if (foundAppt) {
            const apptDateStr = foundAppt.appointmentDate; // YYYY/MM/DD HH:MM
            
            // 1. Ajusta a semana do calendário para a semana do agendamento encontrado
            currentWeekStart = getStartOfWeekFromDateStr(apptDateStr);
            
            // 2. Define o técnico como o do agendamento encontrado
            selectedTechnician = foundAppt.technician;
            techSelectDropdown.value = foundAppt.technician;
            selectedTechDisplay.textContent = foundAppt.technician;
            
            // 3. Define a busca ativa para renderizar apenas este agendamento (e seus vizinhos de técnico/dia)
            activeSearchApptId = foundAppt.id;
            
            alert(`Appointment found for: ${foundAppt.customers}. Loading week of ${apptDateStr.split(' ')[0]}.`);
            renderScheduler();
        } else {
            alert("No appointment found matching the criteria.");
            activeSearchApptId = null;
            renderScheduler();
        }
    }


    // --- Event Listeners and Initial Setup ---
    
    // Anexa a função de busca ao botão
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);

    if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSaveAppointment);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);

    loadInitialData();
});

// Funções auxiliares (handleEditAppointmentClick, handleSaveAppointment, D&D, etc.)
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
    
    // Coleta os novos dados do modal
    const newDateLocal = modalDate.value;
    const newVerification = modalVerificationSelect.value;
    const newServiceShowed = modalServiceValue.value; 
    
    // Validação básica do formulário modal
    if (!newDateLocal || !newVerification) {
         alert("Data e Status são campos obrigatórios.");
         return;
    }

    // Converte a data para o formato aceito pela API (YYYY/MM/DD HH:MM)
    const newAppointmentDateSheetFormat = newDateLocal.replace('T', ' ').replace(/-/g, '/');

    // Encontra o agendamento na lista local (a fonte de verdade)
    const localAppt = allAppointments.find(a => String(a.id) === apptId);
    
    if (!localAppt) {
        alert('Erro: Agendamento não encontrado localmente.');
        return;
    }

    // Usa os valores dos campos ocultos e dos campos editáveis para o payload
    const dataToUpdate = {
        rowIndex: parseInt(apptId, 10), // ID é o rowNumber
        // Campos editados/do modal
        appointmentDate: newDateLocal, 
        verification: newVerification,
        serviceShowed: newServiceShowed, 
        
        // Campos obrigatórios da API (do cache local ou hidden inputs)
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
            // CORREÇÃO: Atualiza o registro localmente com TODOS os valores enviados para a API
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

function updateWeekDisplay() {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    
    const startMonth = currentWeekStart.toLocaleString('en-US', { month: 'short' });
    const startDay = currentWeekStart.getDate().toString().padStart(2, '0');
    const endMonth = endOfWeek.toLocaleString('en-US', { month: 'short' });
    const endDay = endOfWeek.getDate().toString().padStart(2, '0');
    const year = currentWeekStart.getFullYear();
    
    currentWeekDisplay.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderScheduler();
});

if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderScheduler();
});

let draggedAppointment = null;

function addDragAndDropListeners(element) {
    element.addEventListener('dragstart', (e) => {
        const id = element.dataset.id;
        const localAppt = allAppointments.find(a => String(a.id) === id);

        draggedAppointment = {
            element: element,
            id: id,
            technician: element.dataset.technician,
            originalDate: element.dataset.date,
            // Adiciona campos de cache para o payload do drag&drop
            verification: localAppt.verification || '',
            serviceShowed: localAppt.serviceShowed || '', 
            petShowed: localAppt.petShowed || '',
            tips: localAppt.tips || '',
            percentage: localAppt.percentage || '',
            paymentMethod: localAppt.paymentMethod || '',
        };
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => element.style.display = 'none', 0);
    });

    element.addEventListener('dragend', (e) => {
        e.target.style.display = 'block';
        draggedAppointment = null;
    });
}

if (schedulerBody) {
    schedulerBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    schedulerBody.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        if (!draggedAppointment || !selectedTechnician) {
             if (draggedAppointment) draggedAppointment.element.style.display = 'block';
             return;
        }

        const target = e.target.closest('.time-slot'); 
        if (!target) {
             draggedAppointment.element.style.display = 'block';
             return;
        }
        
        const newTech = selectedTechnician; 
        const targetDateKey = target.dataset.datekey; 

        if (!targetDateKey) {
             draggedAppointment.element.style.display = 'block';
             return;
        }

        const rect = target.getBoundingClientRect();
        const dropY = e.clientY - rect.top; 
        
        const minuteUnit = 15; 
        const pixelsPerMinute = SLOT_HEIGHT_PX / 60; 
        const snappedMinutes = Math.round(dropY / (minuteUnit * pixelsPerMinute)) * minuteUnit;
        
        const slotHour = parseTime(target.dataset.time) / 60; 
        
        const newHour = slotHour + Math.floor(snappedMinutes / 60);
        const newMinute = (snappedMinutes % 60);

        const newDate = parseSheetDate(`${targetDateKey} 00:00`); 
        newDate.setHours(newHour, newMinute, 0, 0);

        const snapOffsetTop = (newHour - 8) * SLOT_HEIGHT_PX + newMinute; 
        const targetCol = target.style.gridColumn;

        // --- Lógica de Confirmação ---
        const localAppt = allAppointments.find(a => String(a.id) === draggedAppointment.id);
        const newDateDisplay = newDate.toLocaleDateString() + ' ' + newHour.toString().padStart(2, '0') + ':' + newMinute.toString().padStart(2, '0');

        const confirmation = confirm(`Tem certeza que deseja mover o agendamento de ${localAppt.customers} para o dia ${newDateDisplay}?`);
        
        if (!confirmation) {
            draggedAppointment.element.style.display = 'block';
            return;
        }
        // --- Fim Confirmação ---

        draggedAppointment.element.style.top = `${snapOffsetTop}px`;
        // Não defina a coluna aqui, a lógica abaixo cuida disso na renderização,
        // mas mantemos o elemento visível na nova posição temporariamente.
        // draggedAppointment.element.style.gridColumn = targetCol; 
        draggedAppointment.element.style.display = 'block';
        
        const newDateSheetFormat = formatDateToYYYYMMDD(newDate) + ' ' + getTimeHHMM(newDate);
        const newDateLocalFormat = formatDateTimeForInput(newDateSheetFormat); // Para API

        
        if (localAppt) {
            // Prepara o payload para a API de atualização (usando dados de cache do dragstart)
            const dataToUpdate = {
                rowIndex: parseInt(draggedAppointment.id, 10),
                appointmentDate: newDateLocalFormat, 
                technician: newTech,
                verification: draggedAppointment.verification, 
                serviceShowed: draggedAppointment.serviceShowed, 
                petShowed: draggedAppointment.petShowed,
                tips: draggedAppointment.tips,
                percentage: draggedAppointment.percentage,
                paymentMethod: draggedAppointment.paymentMethod,
            };

            try {
                const response = await fetch('/api/update-appointment-showed-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToUpdate),
                });
                const result = await response.json();

                if (result.success) {
                    // Atualiza o registro local
                    localAppt.technician = newTech;
                    localAppt.appointmentDate = newDateSheetFormat;
                    
                    console.log(`[API CALL SUCESSO] ID: ${localAppt.id} movido para Tech: ${newTech}, Horário: ${newDateSheetFormat}`);
                    renderScheduler();
                } else {
                    alert(`Erro ao mover agendamento: ${result.message}`);
                    renderScheduler(); // Redesenha para reverter o movimento visual
                }
            } catch (error) {
                alert('Erro de comunicação ao mover agendamento.');
                renderScheduler(); // Redesenha para reverter o movimento visual
            }
        }
    });
}

function initializeAvailability() {
    const savedConfig = localStorage.getItem('techAvailability');
    if (savedConfig) {
        techAvailability = JSON.parse(savedConfig);
    }
}

function renderAvailabilityForm(technician) {
    if (!technician) {
        availabilityFormContainer.innerHTML = '<p class="text-muted-foreground">Please select a technician.</p>';
        return;
    }
    
    const techConfig = techAvailability[technician] || {};
    const days = DAY_NAMES;
    const timeOptionsStart = TIME_SLOTS;
    const timeOptionsEnd = TIME_SLOTS.slice(1);

    availabilityFormContainer.innerHTML = days.map(day => {
        const config = techConfig[day] || { start: '09:00', end: '17:00', active: (day !== 'Sun') };
        const isDisabled = day === 'Sun' || !config.active;
        
        const startOptionsHtml = timeOptionsStart.map(t => 
            `<option value="${t}" ${config.start === t ? 'selected' : ''}>${t}</option>`
        ).join('');
        
        const endOptionsHtml = timeOptionsEnd.map(t => 
            `<option value="${t}" ${config.end === t ? 'selected' : ''}>${t}</option>`
        ).join('');

        return `
            <div class="flex items-center gap-4 p-4 border rounded-lg ${config.active ? 'border-brand-primary/20 bg-muted/50' : 'bg-muted/10'}">
                <input type="checkbox" id="${day}-active" data-day="${day}" class="availability-checkbox" ${config.active ? 'checked' : ''} ${day === 'Sun' ? 'disabled' : ''}>
                <label for="${day}-active" class="flex-1 font-semibold">${day}</label>
                <select data-day="${day}" data-field="start" class="w-32 p-2 border rounded-md" ${isDisabled ? 'disabled' : ''}>
                    ${startOptionsHtml}
                </select>
                <span>to</span>
                <select data-day="${day}" data-field="end" class="w-32 p-2 border rounded-md" ${isDisabled ? 'disabled' : ''}>
                    ${endOptionsHtml}
                </select>
            </div>
        `;
    }).join('');
    
    availabilityFormContainer.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', handleAvailabilityChange);
    });
    availabilityFormContainer.querySelectorAll('.availability-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleAvailabilityChange);
    });
}

function handleTechConfigSelectChange(e) {
    const technician = e.target.value;
    renderAvailabilityForm(technician);
}

function handleAvailabilityChange(e) {
    const technician = techConfigSelect.value;
    if (!technician) return;
    
    const day = e.target.dataset.day;
    const field = e.target.dataset.field;
    const isCheckbox = e.target.type === 'checkbox';
    
    if (!techAvailability[technician]) {
        techAvailability[technician] = {};
    }
    if (!techAvailability[technician][day]) {
        techAvailability[technician][day] = { start: '09:00', end: '17:00', active: (day !== 'Sun') };
    }
    
    if (isCheckbox) {
        techAvailability[technician][day].active = e.target.checked;
    } else {
        techAvailability[technician][day][field] = e.target.value;
    }
    
    renderAvailabilityForm(technician);
}

if (saveAvailabilityBtn) saveAvailabilityBtn.addEventListener('click', () => {
    if (!techConfigSelect.value) {
        alert('Please select a technician before saving.');
        return;
    }
    localStorage.setItem('techAvailability', JSON.stringify(techAvailability));
    alert('Availability saved successfully!');
    renderScheduler(); 
});

if (techConfigSelect) techConfigSelect.addEventListener('change', handleTechConfigSelectChange);

// Attach listeners for modal buttons (Defensive Check)
if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSaveAppointment);
if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);
