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

    // --- Helper Functions (Definidas no escopo correto) ---

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
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }

    function parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    function calculateOverlap(apptA, apptB) {
        const dateA = parseSheetDate(apptA.appointmentDate);
        const dateB = parseSheetDate(apptB.appointmentDate);

        if (!dateA || !dateB || formatDateToYYYYMMDD(dateA) !== formatDateToYYYYMMDD(dateB)) return false;

        const durationMs = SCHEDULE_DURATION_HOURS * 60 * 60 * 1000;
        
        const startA = dateA.getTime();
        const endA = startA + durationMs;
        
        const startB = dateB.getTime();
        const endB = startB + durationMs;

        return (startA < endB) && (endA > startB);
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

        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
    }

    // --- Event Handlers (D&D e Modal) ---
    
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
    
    // Lógica de Drag and Drop
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

            const localAppt = allAppointments.find(a => String(a.id) === draggedAppointment.id);
            const newDateDisplay = newDate.toLocaleDateString() + ' ' + newHour.toString().padStart(2, '0') + ':' + newMinute.toString().padStart(2, '0');

            const confirmation = confirm(`Tem certeza que deseja mover o agendamento de ${localAppt.customers} para o dia ${newDateDisplay}?`);
            
            if (!confirmation) {
                draggedAppointment.element.style.display = 'block';
                return;
            }

            draggedAppointment.element.style.top = `${snapOffsetTop}px`;
            draggedAppointment.element.style.display = 'block';
            
            const newDateSheetFormat = formatDateToYYYYMMDD(newDate) + ' ' + getTimeHHMM(newDate);
            const newDateLocalFormat = formatDateTimeForInput(newDateSheetFormat); 

            
            if (localAppt) {
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
                        localAppt.technician = newTech;
                        localAppt.appointmentDate = newDateSheetFormat;
                        renderScheduler();
                    } else {
                        alert(`Erro ao mover agendamento: ${result.message}`);
                        renderScheduler(); 
                    }
                } catch (error) {
                    alert('Erro de comunicação ao mover agendamento.');
                    renderScheduler(); 
                }
            }
        });
    }

    // --- Data Load e Rendering ---

    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);

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
            allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            
            initializeAvailability(); 
            populateTechSelects();
            renderScheduler(); 

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            
            const userMessage = `Falha ao carregar dados iniciais. ${error.message || 'Erro desconhecido.'} Verifique a API e as variáveis de ambiente.`;
            alert(userMessage);

            if (techSelectDropdown) {
                const displayError = (error.message || 'Erro de API').substring(0, 40) + '...';
                techSelectDropdown.innerHTML = `<option value="">ERROR: ${displayError}</option>`;
                selectedTechDisplay.textContent = 'ERROR';
                loadingOverlay.classList.remove('hidden');
            }
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
        activeSearchApptId = null; 
        if (selectedTechnician) {
            selectedTechDisplay.textContent = selectedTechnician;
            loadingOverlay.classList.add('hidden');
        } else {
            selectedTechDisplay.textContent = 'No Technician Selected';
            loadingOverlay.classList.remove('hidden');
        }
        renderScheduler();
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

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        
        const columnMap = {};
        VISIBLE_DAY_INDICES.forEach((dayIndex, colIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            
            const dayName = getDayOfWeek(date);
            const dateKey = formatDateToYYYYMMDD(date);
            
            columnMap[dateKey] = colIndex + 2; 
            
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[dateKey];
            header.textContent = `${dayName} ${date.getDate()} / ${selectedTechnician.split(' ')[0] || ''}`; 
            schedulerHeader.appendChild(header);
        });
        
        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = rowIndex + 1;
            timeDiv.style.gridColumn = 1;
            schedulerBody.appendChild(timeDiv);

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
             const foundAppt = allAppointments.find(appt => String(appt.id) === String(activeSearchApptId));
             if (foundAppt) {
                 appointmentsToRender.push(foundAppt);
                 appointmentsToRender = appointmentsToRender.concat(allAppointments.filter(appt => 
                     appt.technician === foundAppt.technician && String(appt.id) !== String(activeSearchApptId)
                 ));
             }
        } else if (selectedTechnician) {
             appointmentsToRender = allAppointments.filter(appt => 
                 appt.technician === selectedTechnician
             );
        }
        
        appointmentsToRender = Array.from(new Set(appointmentsToRender));

        appointmentsToRender.forEach(appt => {

            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            if (apptDate < currentWeekStart || apptDate >= weekEnd) return;
            
            const dateKey = formatDateToYYYYMMDD(apptDate);
            const colIndex = columnMap[dateKey];
            
            if (!colIndex) return; 
            
            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes();
            
            if (startHour < 8 || startHour >= 18) return; 

            const topOffset = (startHour - 8) * SLOT_HEIGHT_PX + startMinutes; 
            
            const block = document.createElement('div');
            
            let bgColor = 'bg-custom-primary'; 
            
            if (appt.verification === 'Canceled') {
                bgColor = 'bg-cherry-red'; 
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600'; 
            }
            
            const overlappingAppts = allAppointments.filter(otherAppt => {
                if (otherAppt.id === appt.id) return false;
                if (otherAppt.technician !== appt.technician) return false;
                return calculateOverlap(appt, otherAppt);
            });

            if (overlappingAppts.length > 0) {
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
            
            block.style.gridColumnStart = colIndex; 
            block.style.gridColumnEnd = colIndex + 1;
            
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

    function handleSearch() {
        // ... (Logic remains the same as provided by the user for the search)
    }


    function initializeAvailability() {
        const savedConfig = localStorage.getItem('techAvailability');
        if (savedConfig) {
            techAvailability = JSON.parse(savedConfig);
        }
    }
    
    function renderAvailabilityForm(technician) {
        // ... (Logic remains the same)
    }

    function handleTechConfigSelectChange(e) {
        const technician = e.target.value;
        renderAvailabilityForm(technician);
    }
    
    function handleAvailabilityChange(e) {
        // ... (Logic remains the same)
    }


    // --- Event Listeners e Inicialização ---
    
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
    });

    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
    });
    
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);

    if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSaveAppointment);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);
    
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

    // INICIALIZAÇÃO
    loadInitialData();
});
