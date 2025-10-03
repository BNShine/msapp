// public/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    const techCheckboxes = document.getElementById('tech-checkboxes');
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
    let visibleTechnicians = [];
    let currentWeekStart = getStartOfWeek(new Date()); // Começa na semana atual (domingo)
    
    // Simulação do armazenamento de configuração de disponibilidade (Seria idealmente um endpoint)
    let techAvailability = {}; // { 'Technician Name': { 'Mon': { start: '09:00', end: '17:00', active: true }, ... } }

    const SCHEDULE_DURATION_HOURS = 2; // Regra de bloqueio de 2 horas

    // Horários de 8h às 18h (índices 0 a 10)
    const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);

    // --- Helper Functions ---

    // Obtém o início da semana (domingo)
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay()); // Seta para o último domingo
        return d;
    }

    // Formata a data para YYYY/MM/DD
    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    // Formata YYYY/MM/DD HH:MM para um objeto Date
    function parseSheetDate(dateStr) {
        if (!dateStr || dateStr.length < 16) return null;
        // Assume YYYY/MM/DD HH:MM - Parseia manualmente para evitar problemas de fuso horário local
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        // Cria a data no fuso horário do usuário
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    // Retorna o dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
    function getDayOfWeek(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    }

    // Retorna a hora (HH:MM)
    function getTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // Função principal de validação de bloqueio de 2 horas
    function isValidAppointmentTime(technician, date, appointmentsToConsider) {
        const startTime = date.getTime();
        const endTime = startTime + (SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);

        // 1. Validação de Bloqueio de Agendamentos Existentes
        const conflictingAppts = appointmentsToConsider.filter(appt => {
            if (appt.technician !== technician) return false;

            const existingStart = parseSheetDate(appt.appointmentDate);
            if (!existingStart) return false;

            const existingEnd = new Date(existingStart.getTime() + (SCHEDULE_DURATION_HOURS * 60 * 60 * 1000));
            
            // Verifica sobreposição de 2 horas
            const overlap = (startTime < existingEnd.getTime() && endTime > existingStart.getTime());
            return overlap;
        });

        if (conflictingAppts.length > 0) {
            console.warn(`Conflito com o agendamento: ${conflictingAppts[0].customers}`);
            return false;
        }
        
        // 2. Validação da Máscara de Disponibilidade Semanal
        const day = getDayOfWeek(date);
        const techConfig = techAvailability[technician];
        
        // Se a configuração não estiver carregada ou o dia estiver inativo (Domingo por padrão)
        if (!techConfig || !techConfig[day] || !techConfig[day].active) {
             // Aceita apenas se for segunda a sábado E não for o técnico 'Heltor' (exemplo de restrição)
             return date.getDay() >= 1 && date.getDay() <= 6; 
        }

        const availStart = parseTime(techConfig[day].start);
        const availEnd = parseTime(techConfig[day].end);
        
        const currentMinuteOfDay = date.getHours() * 60 + date.getMinutes();
        
        if (currentMinuteOfDay < availStart || currentMinuteOfDay + (SCHEDULE_DURATION_HOURS * 60) > availEnd) {
            console.warn(`Fora do horário de trabalho configurado para ${technician} em ${day}`);
            return false;
        }
        
        return true;
    }
    
    // Converte HH:MM para minutos do dia
    function parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // --- UI Logic: Initial Data Load and Setup ---

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

            // Inicializa a configuração com valores padrão e carrega do localStorage
            initializeAvailability(); 
            
            // Define todos os técnicos como visíveis por padrão, ou carrega do cache
            const cachedVisibleTechs = localStorage.getItem('visibleTechnicians');
            visibleTechnicians = cachedVisibleTechs ? JSON.parse(cachedVisibleTechs) : allTechnicians;

            // Popula os seletores de técnico e renderiza a interface
            populateTechSelects();
            renderScheduler();

        } catch (error) {
            console.error('Error loading initial data:', error);
            alert('Falha ao carregar dados iniciais. Verifique a API.');
        }
    }
    
    function populateTechSelects() {
        techConfigSelect.innerHTML = '<option value="">Select Technician</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techConfigSelect.appendChild(option);
        });

        // Configura o painel lateral de checkboxes
        techCheckboxes.innerHTML = allTechnicians.map(tech => `
            <div class="flex items-center space-x-2">
                <input type="checkbox" id="tech-${tech}" value="${tech}" ${visibleTechnicians.includes(tech) ? 'checked' : ''} class="tech-filter-checkbox">
                <label for="tech-${tech}" class="text-sm cursor-pointer">${tech}</label>
            </div>
        `).join('');
        
        // Adiciona listener para os checkboxes
        techCheckboxes.querySelectorAll('.tech-filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleTechFilterChange);
        });
        
        // Renderiza o formulário de disponibilidade se um técnico estiver selecionado
        techConfigSelect.addEventListener('change', handleTechConfigSelectChange);
    }
    
    function handleTechFilterChange(event) {
        const techName = event.target.value;
        if (event.target.checked) {
            if (!visibleTechnicians.includes(techName)) {
                visibleTechnicians.push(techName);
            }
        } else {
            visibleTechnicians = visibleTechnicians.filter(t => t !== techName);
        }
        localStorage.setItem('visibleTechnicians', JSON.stringify(visibleTechnicians));
        renderScheduler();
    }
    
    // --- UI Logic: Scheduler Rendering ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        
        // Atualiza a variável CSS para a grade
        schedulerHeader.style.setProperty('--num-techs', visibleTechnicians.length || 1);
        schedulerBody.style.setProperty('--num-techs', visibleTechnicians.length || 1);
        
        const columnMap = {};
        visibleTechnicians.forEach((tech, index) => {
            columnMap[tech] = index + 2; // Colunas começam em 2 (1 é Time)
            
            // Adiciona cabeçalho do técnico
            const header = document.createElement('div');
            header.className = 'tech-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[tech];
            header.textContent = tech;
            schedulerHeader.appendChild(header);
        });
        
        // Preenche a grade com slots de tempo e a linha do tempo
        TIME_SLOTS.forEach((time, index) => {
            // Linha do tempo
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = index + 1;
            timeDiv.style.gridColumn = 1;
            schedulerBody.appendChild(timeDiv);

            // Slots vazios para os técnicos (importante para o layout da grade)
            visibleTechnicians.forEach(tech => {
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                emptySlot.dataset.tech = tech;
                emptySlot.dataset.time = time;
                emptySlot.style.gridRow = index + 1;
                emptySlot.style.gridColumn = columnMap[tech];
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        // Renderiza os agendamentos (blocos)
        renderAppointments(visibleTechnicians, columnMap);
        
        // Atualiza a exibição da semana
        updateWeekDisplay();
    }
    
    function renderAppointments(techList, columnMap) {
        // Encontra o fuso horário atual para ajustes no cálculo de posição
        const tzOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        
        allAppointments.forEach(appt => {
            if (!techList.includes(appt.technician)) return;

            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            // Filtra agendamentos para a semana atual
            if (apptDate < currentWeekStart || apptDate >= weekEnd) return;

            const dayIndex = apptDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes();
            
            // O calendário começa às 8h (índice 0). O cálculo é baseado na diferença de horas.
            // Row Start = (startHour - 8) + 1 (A grade começa na linha 1)
            const rowStart = (startHour - 8) + 1;
            
            // Posição Y em pixels (60px por hora)
            // Top = (startHour - 8) * 60 + startMinutes * 1
            const topOffset = (startHour - 8) * 60 + startMinutes;
            
            // Posição horizontal na coluna do técnico
            const colIndex = columnMap[appt.technician];
            
            // Apenas renderiza agendamentos dentro da faixa de tempo TIME_SLOTS (8h-18h)
            if (rowStart < 1 || rowStart > TIME_SLOTS.length || startHour < 8 || startHour >= 18) return;


            const block = document.createElement('div');
            block.className = 'appointment-block bg-brand-primary text-white rounded-md p-2 shadow-soft cursor-move absolute transition-colors hover:bg-brand-primary-hover';
            block.dataset.id = appt.id;
            block.dataset.technician = appt.technician;
            block.dataset.date = appt.appointmentDate; // Guarda a data original
            block.draggable = true;
            
            // Aplica a posição no layout da grade (Grid Column)
            block.style.gridColumn = colIndex; 
            
            // Posicionamento absoluto dentro do contêiner da grade
            // Multiplica o índice da coluna pela largura da coluna (1fr) + offset da linha do tempo (80px)
            // A largura da coluna é calculada por JS se houver necessidade de ser absoluta
            // Por simplicidade e adaptabilidade, usaremos a propriedade CSS 'grid-column' e posicionamento 'top'
            block.style.gridRow = rowStart;
            block.style.top = `${topOffset}px`;

            block.innerHTML = `
                <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000))}</p>
                <p class="text-sm font-bold truncate">${appt.customers}</p>
                <p class="text-xs text-muted-foreground/50">${appt.code} / Pets: ${appt.petShowed || 0}</p>
            `;
            
            schedulerBody.appendChild(block);
            
            // Adiciona a lógica de drag-and-drop
            addDragAndDropListeners(block);
        });
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
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
    });

    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
    });

    // --- Drag and Drop Logic ---
    let draggedAppointment = null;
    
    function addDragAndDropListeners(element) {
        element.addEventListener('dragstart', (e) => {
            draggedAppointment = {
                element: element,
                id: element.dataset.id,
                technician: element.dataset.technician,
                originalDate: element.dataset.date,
                originalTop: element.style.top,
                originalColumn: element.style.gridColumn,
            };
            e.dataTransfer.effectAllowed = 'move';
            // Adiciona um timeout para remover o bloco temporariamente
            setTimeout(() => element.style.display = 'none', 0);
        });

        element.addEventListener('dragend', (e) => {
            // Garante que o elemento volte a aparecer
            e.target.style.display = 'block';
            draggedAppointment = null;
        });
    }

    schedulerBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    schedulerBody.addEventListener('drop', (e) => {
        e.preventDefault();
        
        if (!draggedAppointment) return;

        // 1. Determina a nova coluna (Técnico) e o slot de tempo de destino (Target Slot)
        const target = e.target.closest('.time-slot') || e.target.closest('.appointment-block');
        if (!target) return;
        
        const newTech = target.dataset.tech || draggedAppointment.technician; // Mantém o técnico se arrastar sobre outro bloco
        if (!visibleTechnicians.includes(newTech)) return; // Se o drop for em um espaço invisível

        // 2. Calcula a nova data/hora
        const rect = schedulerBody.getBoundingClientRect();
        const dropY = e.clientY - rect.top; // Posição Y relativa ao topo da grade
        
        // Posição arredondada para o slot de 15 em 15 minutos (1/4 da altura de 60px)
        const minuteUnit = 60 / 4; 
        const snapOffset = Math.round(dropY / minuteUnit) * minuteUnit;
        
        // Hora de início (8:00 é 0)
        const newHour = 8 + Math.floor(snapOffset / 60);
        const newMinute = (snapOffset % 60);

        // O dia de destino é o dia da coluna de destino, que é a mesma da coluna de origem (estamos no modo semanal)
        const originalApptDate = parseSheetDate(draggedAppointment.originalDate);
        if (!originalApptDate) {
             console.error("Erro ao analisar a data original.");
             // Volta para o estado original em caso de erro
             draggedAppointment.element.style.display = 'block';
             return;
        }

        const newDate = new Date(originalApptDate);
        newDate.setHours(newHour, newMinute, 0, 0);
        
        // 3. Validação Crucial: Bloqueio de 2 Horas e Disponibilidade
        // É necessário filtrar o compromisso atual da lista de consideração para evitar conflito consigo mesmo
        const appointmentsExcludingSelf = allAppointments.filter(appt => appt.id !== draggedAppointment.id);

        if (!isValidAppointmentTime(newTech, newDate, appointmentsExcludingSelf)) {
            alert('Conflito: Este horário se sobrepõe a um agendamento de 2h existente ou está fora da disponibilidade do técnico.');
            
            // Volta para a posição original
            draggedAppointment.element.style.top = draggedAppointment.originalTop;
            draggedAppointment.element.style.gridColumn = draggedAppointment.originalColumn;
            draggedAppointment.element.style.display = 'block';
            return;
        }
        
        // 4. Atualiza a UI (Posição)
        draggedAppointment.element.style.top = `${snapOffset}px`;
        draggedAppointment.element.style.gridColumn = columnMap[newTech];
        draggedAppointment.element.style.display = 'block';
        
        // 5. Atualiza a Data no Array Local e Envia para o Backend
        const newDateSheetFormat = formatDateToYYYYMMDD(newDate) + ' ' + getTimeHHMM(newDate);
        
        const localAppt = allAppointments.find(a => String(a.id) === draggedAppointment.id);
        if (localAppt) {
            localAppt.technician = newTech;
            localAppt.appointmentDate = newDateSheetFormat;
            
            // ** [TODO] CHAME A API DE UPDATE AQUI **
            // O endpoint api/update-appointment-showed-data.js é o mais próximo.
            // Ele precisaria de uma modificação para aceitar a atualização da data e do técnico
            // SEM exigir todos os outros campos de "Showed" (petShowed, serviceShowed, etc.)

             // Exemplo de chamada de API (simulação):
             // sendUpdateToBackend(localAppt.id, newTech, newDateSheetFormat);
             console.log(`[API CALL SIMULADA] ID: ${localAppt.id} movido para Tech: ${newTech}, Horário: ${newDateSheetFormat}`);
             // Re-renderiza para garantir a consistência
             renderScheduler();
        }
    });
    
    // --- UI Logic: Availability Configuration (Referência Imagem 2) ---

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
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        availabilityFormContainer.innerHTML = days.map(day => {
            const config = techConfig[day] || { start: '09:00', end: '17:00', active: (day !== 'Sun') };
            const timeOptions = TIME_SLOTS.map(t => `<option value="${t}" ${config.start === t ? 'selected' : ''}>${t}</option>`).join('');
            const endOptions = TIME_SLOTS.slice(1).map(t => `<option value="${t}" ${config.end === t ? 'selected' : ''}>${t}</option>`).join('');

            return `
                <div class="flex items-center gap-4 p-4 border rounded-lg ${config.active ? 'border-brand-primary/20 bg-muted/50' : 'bg-muted/10'}">
                    <input type="checkbox" id="${day}-active" data-day="${day}" class="availability-checkbox" ${config.active ? 'checked' : ''} ${day === 'Sun' ? 'disabled' : ''}>
                    <label for="${day}-active" class="flex-1 font-semibold">${day}</label>
                    <select data-day="${day}" data-field="start" class="w-32 p-2 border rounded-md" ${!config.active || day === 'Sun' ? 'disabled' : ''}>
                        ${timeOptions}
                    </select>
                    <span>to</span>
                    <select data-day="${day}" data-field="end" class="w-32 p-2 border rounded-md" ${!config.active || day === 'Sun' ? 'disabled' : ''}>
                        ${endOptions}
                    </select>
                </div>
            `;
        }).join('');
        
        // Adiciona listeners para os campos
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
        
        // Re-renderiza o formulário para atualizar o estado desabilitado/ativo
        renderAvailabilityForm(technician);
    }

    saveAvailabilityBtn.addEventListener('click', () => {
        if (!techConfigSelect.value) {
            alert('Please select a technician before saving.');
            return;
        }
        localStorage.setItem('techAvailability', JSON.stringify(techAvailability));
        alert('Availability saved successfully!');
        renderScheduler(); // Re-renderiza o calendário para aplicar novas regras de bloqueio
    });

    // --- Initialization ---
    loadInitialData();
});
