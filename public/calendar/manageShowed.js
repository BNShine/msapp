// public/calendar/manageShowed.js

document.addEventListener('DOMContentLoaded', async () => {
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');
    let allAppointments = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};

    // --- Funções Auxiliares (reutilizadas) ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
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

    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

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
                <td class="p-4"><select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification"><option value="">Select...</option>${["Scheduled", "Showed", "Canceled"].map(opt => `<option value="${opt}" ${appointment.verification === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }

    // --- Lógica de Salvamento ---
    async function handleTableCellChange(event) {
        const target = event.target;
        if (target.matches('input, select')) {
            const row = target.closest('tr');
            const apptId = row.dataset.rowId;

            if (isSaving[apptId]) return;

            isSaving[apptId] = true;
            row.classList.add('is-saving');
            row.classList.remove('is-success', 'is-error');

            const dataToUpdate = {
                rowIndex: parseInt(apptId, 10),
                appointmentDate: row.querySelector('[data-key="appointmentDate"]').value,
                technician: row.querySelector('[data-key="technician"]').value,
                petShowed: row.querySelector('[data-key="petShowed"]').value,
                serviceShowed: row.querySelector('[data-key="serviceShowed"]').value,
                tips: row.querySelector('[data-key="tips"]').value,
                percentage: row.querySelector('[data-key="percentage"]').value,
                paymentMethod: row.querySelector('[data-key="paymentMethod"]').value,
                verification: row.querySelector('[data-key="verification"]').value,
            };

            try {
                const response = await fetch('/api/update-appointment-showed-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToUpdate),
                });
                const result = await response.json();
                if (!result.success) throw new Error(result.message);

                row.classList.remove('is-saving');
                row.classList.add('is-success');

            } catch (error) {
                console.error('Error saving from table:', error);
                row.classList.remove('is-saving');
                row.classList.add('is-error');
            } finally {
                setTimeout(() => {
                    row.classList.remove('is-saving', 'is-success', 'is-error');
                    isSaving[apptId] = false;
                }, 2000);
            }
        }
    }

    // --- Inicialização e Event Listeners ---
    async function loadAppointmentData() {
        try {
            const response = await fetch('/api/get-technician-appointments');
            if (!response.ok) throw new Error('Failed to load appointments.');
            const data = await response.json();
            allAppointments = (data.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            renderShowedAppointmentsTable();
        } catch (error) {
            console.error('Error loading appointment data for table:', error);
        }
    }

    document.addEventListener('technicianChanged', (e) => {
        selectedTechnician = e.detail.technician;
        currentWeekStart = e.detail.weekStart;
        renderShowedAppointmentsTable();
    });

    document.addEventListener('weekChanged', (e) => {
        currentWeekStart = e.detail.weekStart;
        renderShowedAppointmentsTable();
    });

    showedAppointmentsTableBody.addEventListener('change', handleTableCellChange);

    loadAppointmentData();
});
