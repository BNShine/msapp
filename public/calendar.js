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

    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    let techAvailability = {}; 
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
    
    function isValidAppointmentTime(newDate, technician, currentApptId) {
        // LÓGICA DE CONFLITO REMOVIDA A PEDIDO DO CLIENTE: Horários flexíveis e sobreposição são permitidos.
        return true;
    }


    // --- Data Load and Setup ---

    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);

            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();

            allTechnicians = techData.technicians || [];
            allAppointments = apptsData.appointments || [];

            initializeAvailability(); 
            populateTechSelects();
            renderScheduler(); 

        } catch (error) {
            console.error('Error loading initial data:', error);
            alert('Falha ao carregar dados iniciais. Verifique a API.');
        }
    }
    
    function populateTechSelects() {
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techSelectDropdown.appendChild(option);
        });
        
        techConfigSelect.innerHTML = '<option value="">Select Technician</option>' + 
            allTechnicians.map(tech => `<option value="${tech}">${tech}</option>`).join('');

        techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    }
    
    function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.textContent = selectedTechnician;
            loadingOverlay.classList.add('hidden');
        } else {
            selectedTechDisplay.textContent = 'No Technician Selected';
            loadingOverlay.classList.remove('hidden');
        }
        renderScheduler();
    }
    

    // --- UI Logic: Scheduler Rendering (CORRIGIDO) ---

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
        
        if (!selectedTechnician) {
            loadingOverlay.classList.remove('hidden');
        }
        
        updateWeekDisplay();
    }
    
    function renderAppointments(columnMap) {
        if (!selectedTechnician) return;
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        
        const filteredAppointments = allAppointments.filter(appt => 
            appt.technician === selectedTechnician
        );
        
        filteredAppointments.forEach(appt => {

            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            if (apptDate < currentWeekStart || apptDate >= weekEnd) return;
            
            const dateKey = formatDateToYYYYMMDD(apptDate);
            
            const colIndex = columnMap[dateKey];
            if (!colIndex) return; 
            
            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes();
            
            if (startHour < 8 || startHour >= 18) return; 

            // Cálculo da posição TOP em relação ao TOPO DO SCHEDULER BODY (8:00)
            const topOffset = (startHour - 8) * SLOT_HEIGHT_PX + startMinutes; 
            
            const block = document.createElement('div');
            
            // CORREÇÃO: Cor de Fundo
            let bgColor = 'bg-custom-primary'; // Cor Primária
            if (appt.verification === 'Canceled') {
                bgColor = 'bg-destructive/80'; 
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600'; 
            }

            // Adiciona a classe 'editable' e o data-state
            block.className = `appointment-block editable ${bgColor} text-white rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.dataset.technician = appt.technician;
            block.dataset.date = appt.appointmentDate; 
            block.dataset.serviceshowed = appt.serviceShowed || ''; // USANDO SERVICE SHOWED (CORREÇÃO DE MODELO)
            block.dataset.verification = appt.verification;
            block.dataset.state = 'view';
            block.draggable = true;
            
            // POSICIONAMENTO: Restrito à Coluna do Dia (colIndex)
            block.style.gridColumn = colIndex; 
            block.style.top = `${topOffset}px`;
            
            // POSICIONAMENTO: Altura Fixa de 2 horas (120px)
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

    // --- Nova Função para Editar/Salvar o Agendamento ---

    function handleEditAppointmentClick(event) {
        const block = event.currentTarget;
        if (block.dataset.state === 'edit') return; // Já está em modo de edição
        
        block.dataset.state = 'edit';
        block.draggable = false; // Desabilita drag ao editar
        block.classList.remove('cursor-pointer');

        // Pega os dados atuais
        const apptId = block.dataset.id;
        const apptDateStr = block.dataset.date;
        const verification = block.dataset.verification;
        const serviceShowed = block.dataset.serviceshowed; // USANDO SERVICE SHOWED (CORREÇÃO)

        // Formata a data para o input datetime-local
        const formattedDate = formatDateTimeForInput(apptDateStr);

        // Cria o HTML do modo de edição (Corrigindo a UI/UX para texto escuro e labels)
        const editHtml = `
            <div class="space-y-1 p-1">
                <label class="block text-white text-xs font-semibold">Data e Hora</label>
                <input type="datetime-local" data-field="date" value="${formattedDate}" 
                       class="w-full text-sm p-1 rounded bg-white text-foreground border border-gray-300 focus:border-brand-primary" required>
                
                <label class="block text-white text-xs font-semibold">Status</label>
                <select data-field="verification" class="w-full text-sm p-1 rounded bg-white text-foreground border border-gray-300">
                    ${VERIFICATION_OPTIONS.map(opt => 
                        `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`
                    ).join('')}
                </select>

                <label class="block text-white text-xs font-semibold">Service Value</label>
                <input type="text" data-field="serviceShowed" value="${serviceShowed}" placeholder="Ex: 150.00"
                       class="w-full text-sm p-1 rounded bg-white text-foreground border border-gray-300 focus:border-brand-primary">

                <button data-id="${apptId}" data-action="save" class="mt-2 w-full text-xs font-bold text-white bg-brand-primary p-1 rounded hover:bg-brand-primary/80">
                    Save
                </button>
                <button data-id="${apptId}" data-action="cancel" class="mt-1 w-full text-xs font-medium text-white bg-gray-500 p-1 rounded hover:bg-gray-600">
                    Cancel
                </button>
            </div>
        `;

        block.innerHTML = editHtml;

        // Adiciona listeners para Salvar e Cancelar
        block.querySelector('[data-action="save"]').addEventListener('click', handleSaveAppointment);
        block.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que o clique no botão ative o modo de edição novamente
            block.dataset.state = 'view';
            block.draggable = true;
            block.classList.add('cursor-pointer');
            renderScheduler(); // Redesenha o scheduler para restaurar o card
        });
    }

    async function handleSaveAppointment(event) {
        event.stopPropagation();
        const apptId = event.currentTarget.dataset.id;
        const block = event.currentTarget.closest('.appointment-block');
        
        // Coleta os novos dados do formulário
        const newDateLocal = block.querySelector('[data-field="date"]').value;
        const newVerification = block.querySelector('[data-field="verification"]').value;
        const newServiceShowed = block.querySelector('[data-field="serviceShowed"]').value; // Campo Service Showed
        
        // Converte a data para o formato aceito pela API (YYYY/MM/DD HH:MM)
        const newAppointmentDateSheetFormat = newDateLocal.replace('T', ' ').replace(/-/g, '/');

        // Encontra o agendamento na lista local para obter outros dados necessários
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        
        if (!localAppt) {
            alert('Erro: Agendamento não encontrado localmente.');
            return;
        }

        const dataToUpdate = {
            rowIndex: parseInt(apptId, 10), // ID é o rowNumber
            // Campos editados
            appointmentDate: newDateLocal, // Envia o formato datetime-local para a API
            verification: newVerification,
            serviceShowed: newServiceShowed, // Envia o Service Showed (Value)
            
            // Campos obrigatórios da API update-appointment-showed-data.js (do cache local)
            technician: localAppt.technician,
            petShowed: localAppt.petShowed || '',
            tips: localAppt.tips || '',
            percentage: localAppt.percentage || '',
            paymentMethod: localAppt.paymentMethod || '',
        };

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });

            const result = await response.json();
            
            if (result.success) {
                // Atualiza o registro localmente (para a próxima renderização)
                localAppt.appointmentDate = newAppointmentDateSheetFormat;
                localAppt.verification = newVerification;
                localAppt.serviceShowed = newServiceShowed; // Atualiza o cache com o novo valor
                
                alert('Agendamento atualizado com sucesso!');
                renderScheduler(); // Redesenha para mostrar as mudanças
            } else {
                alert(`Erro ao salvar: ${result.message}`);
            }
        } catch (error) {
            console.error('Erro na requisição da API:', error);
            alert('Erro de comunicação com o servidor. Tente novamente.');
        }
    }


    // [Funções de Navegação e Drag and Drop]

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
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
    });

    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
    });

    let draggedAppointment = null;
    
    function addDragAndDropListeners(element) {
        element.addEventListener('dragstart', (e) => {
            if (element.dataset.state === 'edit') {
                 e.preventDefault(); // Não permite arrastar se estiver editando
                 return;
            }
            draggedAppointment = {
                element: element,
                id: element.dataset.id,
                technician: element.dataset.technician,
                originalDate: element.dataset.date,
                originalTop: element.style.top,
                originalColumn: element.style.gridColumn,
                serviceShowed: element.dataset.serviceshowed, // USANDO SERVICE SHOWED (CORREÇÃO)
            };
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => element.style.display = 'none', 0);
        });

        element.addEventListener('dragend', (e) => {
            e.target.style.display = 'block';
            draggedAppointment = null;
        });
    }

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

        draggedAppointment.element.style.top = `${snapOffsetTop}px`;
        draggedAppointment.element.style.gridColumn = targetCol;
        draggedAppointment.element.style.display = 'block';
        
        const newDateSheetFormat = formatDateToYYYYMMDD(newDate) + ' ' + getTimeHHMM(newDate);
        const newDateLocalFormat = formatDateTimeForInput(newDateSheetFormat); // Para API

        const localAppt = allAppointments.find(a => String(a.id) === draggedAppointment.id);
        
        if (localAppt) {
            // Prepara o payload para a API de atualização (usando a mesma estrutura de manage-showed)
            const dataToUpdate = {
                rowIndex: parseInt(draggedAppointment.id, 10),
                appointmentDate: newDateLocalFormat, 
                technician: newTech,
                // Campos que precisam ser passados para o cálculo de To Pay na API (agora corretamente preenchidos)
                verification: localAppt.verification || '', 
                serviceShowed: localAppt.serviceShowed || '', 
                petShowed: localAppt.petShowed || '',
                tips: localAppt.tips || '',
                percentage: localAppt.percentage || '',
                paymentMethod: localAppt.paymentMethod || '',
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
                    localAppt.serviceShowed = dataToUpdate.serviceShowed; 
                    
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

    saveAvailabilityBtn.addEventListener('click', () => {
        if (!techConfigSelect.value) {
            alert('Please select a technician before saving.');
            return;
        }
        localStorage.setItem('techAvailability', JSON.stringify(techAvailability));
        alert('Availability saved successfully!');
        renderScheduler(); 
    });

    techConfigSelect.addEventListener('change', handleTechConfigSelectChange);

    // --- Initialization ---
    loadInitialData();
});
