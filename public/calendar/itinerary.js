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
    let orderedClientStops = []; // Armazena a ordem otimizada
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

    /**
     * **NOVA FUNÇÃO**
     * Preenche o dropdown com os horários disponíveis.
     */
    function populateTimeSlotsDropdown() {
        if (!firstScheduleSelect) return;
        firstScheduleSelect.innerHTML = ''; // Limpa opções anteriores

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
    
    /**
     * **FUNCIONALIDADE IMPLEMENTADA**
     * Aplica a rota otimizada, reagendando e salvando os compromissos.
     */
    async function handleApplyRoute() {
        const selectedStartTime = firstScheduleSelect.value;
        const selectedDay = dayFilter.value;
        
        if (!selectedStartTime || selectedDay === '' || orderedClientStops.length === 0) {
            alert("Please optimize a route and select a start time first.");
            return;
        }

        applyRouteBtn.disabled = true;
        applyRouteBtn.textContent = "Applying...";

        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDay, 10));
        const [startHour, startMinute] = selectedStartTime.split(':').map(Number);

        const updatePromises = [];

        orderedClientStops.forEach((stop, index) => {
            const appointmentToUpdate = allAppointments.find(a => a.id === stop.id);
            if (appointmentToUpdate) {
                const newStartDate = new Date(targetDate);
                newStartDate.setHours(startHour, startMinute);
                newStartDate.setHours(newStartDate.getHours() + (index * APPOINTMENT_DURATION_HOURS));
                
                const year = newStartDate.getFullYear();
                const month = String(newStartDate.getMonth() + 1).padStart(2, '0');
                const day = String(newStartDate.getDate()).padStart(2, '0');
                const hour = String(newStartDate.getHours()).padStart(2, '0');
                const minute = String(newStartDate.getMinutes()).padStart(2, '0');
                
                // Formato para a API: 'YYYY-MM-DDTHH:MM'
                const apiDateTime = `${year}-${month}-${day}T${hour}:${minute}`;

                const dataToUpdate = {
                    rowIndex: appointmentToUpdate.id,
                    appointmentDate: apiDateTime,
                    // Inclui os outros campos para não serem apagados
                    technician: appointmentToUpdate.technician,
                    petShowed: appointmentToUpdate.petShowed,
                    serviceShowed: appointmentToUpdate.serviceShowed,
                    tips: appointmentToUpdate.tips,
                    percentage: appointmentToUpdate.percentage,
                    paymentMethod: appointmentToUpdate.paymentMethod,
                    verification: appointmentToUpdate.verification,
                };
                
                // Adiciona a promessa de atualização à lista
                const promise = fetch('/api/update-appointment-showed-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToUpdate),
                }).then(res => res.json());

                updatePromises.push(promise);
            }
        });

        try {
            const results = await Promise.all(updatePromises);
            const allSuccess = results.every(res => res.success);

            if (allSuccess) {
                alert("Route applied and all appointments updated successfully!");
                // Dispara um evento para que os outros módulos (schedule.js) saibam que precisam recarregar os dados
                document.dispatchEvent(new CustomEvent('appointmentUpdated'));
            } else {
                throw new Error("Some appointments could not be updated. Please check the data.");
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
    function renderDayItineraryTable() {
        if (!dayItineraryTableBody) return;
        dayItineraryTableBody.innerHTML = '';
        itineraryResultsList.innerHTML = 'No route calculated.';
        schedulingControls.classList.add('hidden');

        const selectedDayOfWeek = dayFilter.value;
        const selectedTechName = techSelectDropdown.value;

        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        if (!selectedTechName || selectedDayOfWeek === '') {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">Select a day and a technician to view appointments.</td></tr>';
            return;
        }

        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDayOfWeek, 10));
        const dateKey = formatDateToYYYYMMDD(targetDate);

        dayAppointments = allAppointments
            .filter(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const apptDateKey = apptDate ? formatDateToYYYYMMDD(apptDate) : null;
                return appt.technician === selectedTechName && apptDateKey === dateKey;
            })
            .sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));

        if (dayAppointments.length === 0) {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">No appointments found for the selected day.</td></tr>';
            return;
        }

        dayAppointments.forEach(appt => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/ ৫০';
            const apptDate = parseSheetDate(appt.appointmentDate);
            row.innerHTML = `
                <td class="p-4 font-bold">${getTimeHHMM(apptDate)}</td>
                <td class="p-4">${appt.customers}</td>
                <td class="p-4">${appt.phone || ''}</td>
                <td class="p-4">${appt.zipCode || 'N/A'}</td>
                <td class="p-4">${appt.code || ''}</td>
                <td class="p-4">${appt.verification || ''}</td>
                <td class="p-4">${appt.technician || ''}</td>
            `;
            dayItineraryTableBody.appendChild(row);
        });

        if (dayAppointments.some(appt => appt.zipCode)) {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
    }
    
    async function runItineraryOptimization(isReversed = false) {
        itineraryResultsList.innerHTML = 'Calculating route...';
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;
        
        const selectedTechnician = techSelectDropdown.value;
        let techCoverageData = [];
        try {
            const techCoverageResponse = await fetch('/api/get-tech-coverage');
            if (techCoverageResponse.ok) {
                techCoverageData = await techCoverageResponse.json();
            }
        } catch (e) {
            console.error("Could not fetch tech coverage:", e);
        }
        
        const selectedTechObj = techCoverageData.find(t => t.nome === selectedTechnician);
        const originZip = selectedTechObj?.zip_code;

        if (!originZip) {
            itineraryResultsList.innerHTML = '<p class="text-red-600 font-bold">Technician origin Zip Code not found.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        const validWaypoints = dayAppointments
            .filter(appt => appt.zipCode)
            .map(appt => ({
                id: appt.id, // Importante para o reagendamento
                zipCode: appt.zipCode,
                customerName: appt.customers
            }));

        if (validWaypoints.length < 1) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">No appointments with valid Zip Codes to optimize.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originZip: originZip,
                    waypoints: validWaypoints,
                    isReversed: isReversed
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message);
            }

            const route = result.routeData.routes[0];
            itineraryResultsList.innerHTML = `<p class="font-bold text-lg">Optimized Route (${isReversed ? 'Farthest First' : 'Nearest First'}):</p>`;
            let totalDuration = 0, totalDistance = 0;

            const finalOrder = route.waypoint_order ? route.waypoint_order.map(i => validWaypoints[i]) : validWaypoints;
            orderedClientStops = finalOrder; // Salva a ordem para o "Apply Route"
            
            route.legs.forEach((leg, i) => {
                const clientName = (finalOrder[i] || { customerName: "Return to Origin" }).customerName;
                itineraryResultsList.innerHTML += `
                    <div class="border-b border-muted py-2">
                        <p class="font-bold text-base">${i + 1}. Go to: ${leg.end_address} (${clientName})</p>
                        <p class="ml-4 text-sm">Travel: ${leg.duration.text} | ${leg.distance.text}</p>
                    </div>
                `;
                totalDuration += leg.duration.value;
                totalDistance += leg.distance.value;
            });

            itineraryResultsList.innerHTML += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Travel: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1000 * 0.621371).toFixed(1)} mi</div>`;
            schedulingControls.classList.remove('hidden');
            applyRouteBtn.disabled = false;

        } catch (error) {
            itineraryResultsList.innerHTML = `<p class="text-red-600 font-bold">Error calculating route: ${error.message}</p>`;
        } finally {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
    }


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
    
    document.addEventListener('technicianChanged', (e) => {
        currentWeekStart = e.detail.weekStart;
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
    
    // Carga Inicial
    loadAppointmentData();
    populateTimeSlotsDropdown(); // Preenche o dropdown assim que a página carrega
});
