// public/calendar/itinerary.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores de Elementos ---
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');
    const techSelectDropdown = document.getElementById('tech-select-dropdown');

    // --- Variáveis Globais ---
    let allAppointments = [];
    let dayAppointments = [];
    let techAvailabilityBlocks = []; // Armazena os blocos do técnico
    let orderedClientStops = [];
    let currentWeekStart = getStartOfWeek(new Date());

    const MIN_HOUR = 7;
    const MAX_HOUR = 21;
    const APPOINTMENT_DURATION_HOURS = 2;

    // --- Funções Auxiliares ---
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
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const dateParts = datePart.split('/');
        if (dateParts.length !== 3) return null;
        const [month, day, year] = dateParts.map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    function getTimeHHMM(date) {
        if (!date) return '';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
        const date = new Date(startOfWeekDate);
        date.setDate(startOfWeekDate.getDate() + dayOfWeek);
        return date;
    }
    
    // --- Lógica da Aplicação da Rota e Dropdown ---

    function populateTimeSlotsDropdown() {
        if (!firstScheduleSelect) return;
        firstScheduleSelect.innerHTML = ''; 

        for (let hour = MIN_HOUR; hour < MAX_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const option = document.createElement('option');
                option.value = timeString;
                option.textContent = timeString;
                firstScheduleSelect.appendChild(option);
            }
        }
    }
    
    async function handleApplyRoute() {
        const selectedStartTime = firstScheduleSelect.value;
        const selectedDay = dayFilter.value;
        
        if (!selectedStartTime || selectedDay === '' || orderedClientStops.length === 0) {
            alert("Please optimize a route and select a start time first.");
            return;
        }

        applyRouteBtn.disabled = true;
        applyRouteBtn.textContent = "Applying...";

        // 1. Busca os blocos de tempo do técnico para o dia selecionado
        const selectedTechnician = techSelectDropdown.value;
        await fetchAvailabilityForSelectedTech(selectedTechnician);
        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDay, 10));
        
        const dayBlocks = techAvailabilityBlocks.filter(block => {
            const [bMonth, bDay, bYear] = block.date.split('/').map(Number);
            const blockDate = new Date(bYear, bMonth - 1, bDay);
            return blockDate.getTime() === targetDate.getTime();
        }).map(block => {
            const [startH, startM] = block.startHour.split(':').map(Number);
            const [endH, endM] = block.endHour.split(':').map(Number);
            const startDate = new Date(targetDate);
            startDate.setHours(startH, startM, 0, 0);
            const endDate = new Date(targetDate);
            endDate.setHours(endH, endM, 0, 0);
            return { start: startDate, end: endDate };
        });

        // 2. Inicia o cálculo dos horários
        const updatePromises = [];
        let nextAvailableTime = new Date(targetDate);
        const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
        nextAvailableTime.setHours(startHour, startMinute, 0, 0);

        for (const stop of orderedClientStops) {
            const appointmentToUpdate = allAppointments.find(a => a.id === stop.id);
            if (appointmentToUpdate) {
                
                let isSlotFound = false;
                while (!isSlotFound) {
                    let appointmentStart = new Date(nextAvailableTime);
                    let appointmentEnd = new Date(appointmentStart);
                    appointmentEnd.setHours(appointmentStart.getHours() + APPOINTMENT_DURATION_HOURS);

                    // Verifica se o horário de término ultrapassa o limite
                    if (appointmentEnd.getHours() > MAX_HOUR || (appointmentEnd.getHours() === MAX_HOUR && appointmentEnd.getMinutes() > 0)) {
                         alert(`Could not schedule all appointments. The schedule for "${appointmentToUpdate.customers}" would exceed the 21:00 limit.`);
                         applyRouteBtn.disabled = false;
                         applyRouteBtn.textContent = "Apply Route";
                         return; // Para a execução
                    }

                    // Verifica conflito com os blocos
                    const conflictingBlock = dayBlocks.find(block => 
                        (appointmentStart < block.end) && (appointmentEnd > block.start)
                    );

                    if (conflictingBlock) {
                        // Se houver conflito, pula para o final do bloco
                        nextAvailableTime = new Date(conflictingBlock.end);
                    } else {
                        // Nenhum conflito, o slot é válido
                        isSlotFound = true;

                        const year = appointmentStart.getFullYear();
                        const month = String(appointmentStart.getMonth() + 1).padStart(2, '0');
                        const day = String(appointmentStart.getDate()).padStart(2, '0');
                        const hour = String(appointmentStart.getHours()).padStart(2, '0');
                        const minute = String(appointmentStart.getMinutes()).padStart(2, '0');
                        
                        const apiDateTime = `${year}-${month}-${day}T${hour}:${minute}`;

                        const dataToUpdate = {
                            rowIndex: appointmentToUpdate.id,
                            appointmentDate: apiDateTime,
                            technician: appointmentToUpdate.technician,
                            petShowed: appointmentToUpdate.petShowed,
                            serviceShowed: appointmentToUpdate.serviceShowed,
                            tips: appointmentToUpdate.tips,
                            percentage: appointmentToUpdate.percentage,
                            paymentMethod: appointmentToUpdate.paymentMethod,
                            verification: appointmentToUpdate.verification,
                        };
                        
                        const promise = fetch('/api/update-appointment-showed-data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(dataToUpdate),
                        }).then(res => res.json());

                        updatePromises.push(promise);

                        // Define o próximo horário disponível
                        nextAvailableTime = appointmentEnd;
                    }
                }
            }
        }

        try {
            const results = await Promise.all(updatePromises);
            const allSuccess = results.every(res => res.success);

            if (allSuccess) {
                alert("Route applied and all appointments updated successfully!");
                document.dispatchEvent(new CustomEvent('appointmentUpdated'));
            } else {
                throw new Error("Some appointments could not be updated.");
            }
        } catch (error) {
            console.error("Error applying route:", error);
            alert(`An error occurred: ${error.message}`);
        } finally {
            applyRouteBtn.disabled = false;
            applyRouteBtn.textContent = "Apply Route";
        }
    }


    // --- Renderização e Lógica da Rota (sem alterações) ---
    function renderDayItineraryTable() { /* ...código existente... */ }
    async function runItineraryOptimization(isReversed = false) { /* ...código existente... */ }


    // --- Inicialização e Event Listeners ---
    async function loadAppointmentData() {
        try {
            const response = await fetch('/api/get-technician-appointments');
            if (!response.ok) throw new Error('Failed to load appointments for itinerary.');
            const data = await response.json();
            allAppointments = (data.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            renderDayItineraryTable();
        } catch (error) {
            console.error('Error loading appointment data for itinerary:', error);
        }
    }
    
    async function fetchAvailabilityForSelectedTech(technicianName) {
        if (!technicianName) {
            techAvailabilityBlocks = [];
            return;
        }
        try {
            const response = await fetch(`/api/manage-technician-availability?technicianName=${encodeURIComponent(technicianName)}`);
            if (!response.ok) throw new Error('Could not fetch availability.');
            const data = await response.json();
            techAvailabilityBlocks = data.availability || [];
        } catch (error) {
            console.error('Error fetching availability:', error);
            techAvailabilityBlocks = [];
        }
    }
    
    document.addEventListener('technicianChanged', async (e) => {
        currentWeekStart = e.detail.weekStart;
        await fetchAvailabilityForSelectedTech(e.detail.technician);
        renderDayItineraryTable();
    });

    document.addEventListener('weekChanged', (e) => {
        currentWeekStart = e.detail.weekStart;
        renderDayItineraryTable();
    });
    
    document.addEventListener('appointmentUpdated', async () => {
        await loadAppointmentData();
    });

    if (dayFilter) dayFilter.addEventListener('change', renderDayItineraryTable);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', () => runItineraryOptimization(false));
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', () => runItineraryOptimization(true));
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', handleApplyRoute);
    
    loadAppointmentData();
    populateTimeSlotsDropdown();
});
