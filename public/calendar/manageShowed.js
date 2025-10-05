// public/calendar/manageShowed.js

document.addEventListener('DOMContentLoaded', async () => {
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');
    let allAppointments = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};

    // --- Funções Auxiliares ---
    function getStartOfWeek(date) { /* ...código existente... */ }
    function parseSheetDate(dateStr) { /* ...código existente... */ }
    function formatDateTimeForInput(dateTimeStr) { /* ...código existente... */ }

    // --- Renderização da Tabela ---
    function renderShowedAppointmentsTable() {
        if (!showedAppointmentsTableBody) return;

        showedAppointmentsTableBody.innerHTML = '';
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsForWeek = allAppointments.filter(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            return appt.technician === selectedTechnician && apptDate >= currentWeekStart && apptDate < weekEnd;
        }).sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));

        if (appointmentsForWeek.length === 0) {
            showedAppointmentsTableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-muted-foreground">No appointments for this technician in the selected week.</td></tr>';
            return;
        }

        appointmentsForWeek.forEach(appointment => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50';
            row.dataset.rowId = appointment.id;
            
            // **NOVA OPÇÃO ADICIONADA**
            const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
            const verificationDropdown = statusOptions.map(opt => `<option value="${opt}" ${appointment.verification === opt ? 'selected' : ''}>${opt}</option>`).join('');

            row.innerHTML = `
                <td class="p-4"><input type="datetime-local" value="${formatDateTimeForInput(appointment.appointmentDate)}" style="width: 160px;" class="bg-transparent border border-border rounded-md px-2" data-key="appointmentDate"></td>
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0, 15) + '...' : appointment.customers}</td>
                <td class="p-4">${appointment.code}</td>
                <td class="p-4"><input type="text" value="${appointment.technician}" class="bg-transparent border border-border rounded-md px-2" data-key="technician" disabled></td>
                <td class="p-4"><select style="width: 60px;" class="bg-transparent border border-border rounded-md px-2" data-key="petShowed"><option value="">Pets</option>${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}</select></td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="tips"></td>
                <td class="p-4"><select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="percentage"><option value="">%</option>${["20%", "25%"].map(opt => `<option value="${opt}" ${appointment.percentage === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2" data-key="paymentMethod"><option value="">Select...</option>${["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"].map(opt => `<option value="${opt}" ${appointment.paymentMethod === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification"><option value="">Select...</option>${verificationDropdown}</select></td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }

    // --- Lógica de Salvamento ---
    async function handleTableCellChange(event) { /* ...código existente... */ }

    // --- Inicialização e Event Listeners ---
    async function loadAppointmentData() { /* ...código existente... */ }

    // ... (todos os outros event listeners permanecem os mesmos) ...
});
