// public/manage-showed.js

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('showed-table-body');
    const totalPetsShowedCount = document.getElementById('totalPetsShowedCount');
    const totalServiceShowed = document.getElementById('totalServiceShowed');
    const totalTips = document.getElementById('totalTips');
    const totalCustomersCount = document.getElementById('totalCustomersCount');

    const customersFilter = document.getElementById('customers-filter');
    const codeFilter = document.getElementById('code-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const technicianFilter = document.getElementById('technician-filter');
    const verificationFilter = document.getElementById('verification-filter');

    let allAppointmentsData = [];
    let allTechnicians = []; // Renomeado para Technicians
    
    // Opções para os dropdowns
    const petOptions = Array.from({ length: 10 }, (_, i) => i + 1);
    const percentageOptions = ["20%", "25%"];
    const paymentOptions = ["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"];
    const verificationOptions = ["Showed", "Canceled"];
    
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;


    // MODIFICATION 1: Helper para formatar MM/DD/YYYY HH:MM (do backend) para YYYY-MM-DDTHH:MM (para input HTML type=datetime-local)
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        // Input: MM/DD/YYYY HH:MM (from API/Sheet)
        // Output: YYYY-MM-DDTHH:MM (for HTML input)

        const [datePart, timePart] = dateTimeStr.split(' ');
        if (!datePart || !timePart) return '';

        const [month, day, year] = datePart.split('/');
        
        if (year && month && day) {
             // Convert MM/DD/YYYY to YYYY-MM-DD and combine with time
            return `${year}-${month}-${day}T${timePart}`; 
        }
        return '';
    }

    // Helper para formatar MM/DD/YYYY (do backend) para YYYY-MM-DD (para input HTML type=date)
    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        // Input: MM/DD/YYYY (from API/Sheet - date part)
        // Output: YYYY-MM-DD (for HTML input type=date)
        const datePart = dateStr.split(' ')[0]; 

        const [month, day, year] = datePart.split('/');

        if (year && month && day) {
            // Convert MM/DD/YYYY to YYYY-MM-DD
            return `${year}-${month}-${day}`;
        }
        return ''; 
    }

    // Helper para converter a data do filtro (YYYY-MM-DD) para objeto Date para comparação
    function parseFilterDate(inputDate) {
         if (!inputDate) return null;
         const [Y, M, D] = inputDate.split('-');
         // Month is 0-indexed in Date constructor (M - 1)
         return new Date(Y, M - 1, D);
    }
    
    // Função auxiliar para popular dropdowns
    function populateDropdown(selectElement, items) {
        // ... (no change in dropdown population logic)
        // ...
    }

    // Função para renderizar a tabela e atualizar os cards
    function renderTableAndCards(data) {
        tableBody.innerHTML = '';
        
        let totalPets = 0;
        let totalServiceValue = 0;
        let totalTipsValue = 0;
        let totalCustomers = data.length;

        if (data.length === 0) {
            // Colspan ajustado para 11
            tableBody.innerHTML = '<tr><td colspan="11" class="p-4 text-center text-muted-foreground">Nenhum agendamento encontrado.</td></tr>';
        } else {
            // Cria o mapeamento das opções de Technician
            const technicianOptionsMap = allTechnicians.map(name => {
                const displayTechnician = name.length > 18 
                    ? name.substring(0, 15) + '...'
                    : name;
                return { value: name, display: displayTechnician };
            });

            data.forEach((appointment) => {
                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');

                const petShowed = parseInt(appointment.petShowed, 10) || 0;
                const serviceValue = parseFloat(appointment.serviceShowed) || 0;
                const tipsValue = parseFloat(appointment.tips) || 0;

                totalPets += petShowed;
                totalServiceValue += serviceValue;
                totalTipsValue += tipsValue;

                // Lógica para truncar o nome do cliente a 18 caracteres
                const customerName = appointment.customers || '';
                const truncatedCustomers = customerName.length > 18 
                    ? customerName.substring(0, 15) + '...'
                    : customerName;
                    
                // O elemento de Technician agora é um <select>
                const technicianDropdown = `
                    <select style="width: 130px;" class="bg-transparent border border-border rounded-md px-2">
                        <option value="">Select Technician</option>
                        ${technicianOptionsMap.map(option => `
                            <option value="${option.value}" ${appointment.technician === option.value ? 'selected' : ''}>
                                ${option.display}
                            </option>
                        `).join('')}
                    </select>
                `;

                row.innerHTML = `
                    <td class="p-4"><input type="datetime-local" value="${formatDateTimeForInput(appointment.appointmentDate)}" style="width: 160px;" class="bg-transparent border border-border rounded-md px-2 datetime-local-input"></td>
                    <td class="p-4">${truncatedCustomers}</td>
                    <td class="p-4 code-cell">${appointment.code}</td>
                    <td class="p-4">${technicianDropdown}</td>
                    <td class="p-4">
                        <select style="width: 60px;" class="bg-transparent border border-border rounded-md px-2">
                            <option value="">Pets...</option>
                            ${petOptions.map(num => `<option value="${num}" ${appointment.petShowed === String(num) ? 'selected' : ''}>${num}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2"></td>
                    <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" placeholder="$0.00"></td>
                    <td class="p-4">
                        <select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2">
                            <option value="">%</option>
                            ${percentageOptions.map(option => `<option value="${option}" ${appointment.percentage === option ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-4">
                        <select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2">
                            <option value="">Select...</option>
                            ${paymentOptions.map(option => `<option value="${option}" ${appointment.paymentMethod === option ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-4">
                        <select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2">
                            <option value="">Select...</option>
                            ${verificationOptions.map(option => `<option value="${option}" ${appointment.verification === option ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-4">
                        <button class="save-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-brand-primary text-white hover:shadow-brand" data-row-number="${appointment.sheetRowNumber}">Save</button>
                    </td>
                `;

                tableBody.appendChild(row);
            });
        }
        
        // Atualiza os cards de resumo
        totalPetsShowedCount.textContent = totalPets;
        totalServiceShowed.textContent = `R$${totalServiceValue.toFixed(2)}`;
        totalTips.textContent = `R$${totalTipsValue.toFixed(2)}`;
        totalCustomersCount.textContent = totalCustomers;
    }

    // Função para aplicar os filtros
    function applyFilters() {
        const searchTermCustomers = customersFilter.value.toLowerCase();
        const searchTermCode = codeFilter.value.toLowerCase();
        
        const selectedStartDate = startDateFilter.value ? parseFilterDate(startDateFilter.value) : null;
        const selectedEndDate = endDateFilter.value ? parseFilterDate(endDateFilter.value) : null;
        
        const selectedTechnician = technicianFilter.value.toLowerCase();
        const selectedVerification = verificationFilter.value.toLowerCase();

        const filteredData = allAppointmentsData.filter(appointment => {
            // A data do agendamento é MM/DD/YYYY HH:MM. A comparação de data precisa considerar apenas a parte da data.
            const apptDate = parseFilterDate(formatDateForInput(appointment.appointmentDate)); // Converte MM/DD/YYYY para Date object (apenas data)

            const matchesCustomers = searchTermCustomers === '' || 
                                     (appointment.customers && appointment.customers.toLowerCase().includes(searchTermCustomers));
            
            const matchesCode = searchTermCode === '' || 
                                (appointment.code && appointment.code.toLowerCase().includes(searchTermCode));
            
            const matchesDateRange = (!selectedStartDate || (apptDate && apptDate >= selectedStartDate)) &&
                                     (!selectedEndDate || (apptDate && apptDate <= selectedEndDate));
            
            const matchesTechnician = selectedTechnician === '' || 
                                      (appointment.technician && appointment.technician.toLowerCase() === selectedTechnician);
            
            const matchesVerification = selectedVerification === '' || 
                                        (appointment.verification && appointment.verification.toLowerCase() === selectedVerification);

            return matchesCustomers && matchesCode && matchesDateRange && matchesTechnician && matchesVerification;
        });

        renderTableAndCards(filteredData);
    }
    
    // Função principal para buscar os dados e renderizar a página
    async function initPage() {
        try {
            const [customersResponse, dashboardResponse] = await Promise.all([
                fetch('/api/get-customers-data', { cache: 'no-store' }),
                fetch('/api/get-dashboard-data') // Traz as listas de employees e technicians
            ]);

            // 1. Check main data fetch and safely extract error info if status is bad
            if (!customersResponse.ok) {
                let errorDetails = 'Falha ao carregar dados de agendamentos.';
                try {
                    const errorJson = await customersResponse.json();
                    errorDetails = errorJson.error || errorDetails;
                } catch (e) {
                    errorDetails = `Falha ao carregar dados de agendamentos. Status: ${customersResponse.status}.`;
                }
                throw new Error(errorDetails);
            }
            
            const customersData = await customersResponse.json();
            allAppointmentsData = customersData.customers;
            
            // 2. Safely process dashboard data for technicians list
            if (dashboardResponse.ok) { 
                const dashboardData = await dashboardResponse.json();
                // FIX: Agora usa o array 'technicians' do backend
                allTechnicians = dashboardData.technicians || []; 
            } else {
                console.warn(`Failed to load dashboard data. Status: ${dashboardResponse.status}. Proceeding without technician list.`);
                allTechnicians = [];
            }

            // Popula o dropdown de técnicos para o filtro
            const technicians = new Set();
            allAppointmentsData.forEach(appointment => {
                if (appointment.technician) technicians.add(appointment.technician);
            });
            populateDropdown(technicianFilter, [...technicians].sort());

            renderTableAndCards(allAppointmentsData);
        } catch (error) {
            console.error('Error fetching data:', error);
            const errorMessage = `Erro ao carregar dados. Detalhes: ${error.message}. Tente novamente.`;
            tableBody.innerHTML = `<tr><td colspan="11" class="p-4 text-center text-red-600">${errorMessage}</td></tr>`;
        }
    }

    // Event listener para a ação de salvar
    tableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('save-btn')) {
            const row = event.target.closest('tr');
            const sheetRowNumber = event.target.dataset.rowNumber;

            // Encontra o input de datetime-local
            const appointmentDateInput = row.querySelector('.datetime-local-input');
            
            // Encontra os inputs de texto e os selects
            const textInputs = row.querySelectorAll('input:not(.datetime-local-input)');
            const selects = row.querySelectorAll('select');
            
            // MODIFICATION 2: Convert HTML input format (YYYY-MM-DDTHH:MM) to API target format (MM/DD/YYYY HH:MM)
            const appointmentDateLocal = appointmentDateInput.value;
            const [datePart, timePart] = appointmentDateLocal.split('T');
            const [year, month, day] = datePart.split('-');
            const apiFormattedDate = `${month}/${day}/${year} ${timePart}`; // MM/DD/YYYY HH:MM

            // MODIFICATION 3: Hour Validation
            const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
            const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);

            if (hour < MIN_HOUR || hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) {
                alert(`Save Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
                return;
            }
            // END MODIFICATION 3


            const rowData = {
                rowIndex: parseInt(sheetRowNumber, 10),
                appointmentDate: apiFormattedDate, // MM/DD/YYYY HH:MM is passed to the API
                // customers é ignorado
                technician: selects[0].value, // Technician é o primeiro select
                petShowed: selects[1].value,
                serviceShowed: textInputs[0].value, 
                tips: textInputs[1].value, 
                percentage: selects[2].value, 
                paymentMethod: selects[3].value,
                verification: selects[4].value,
            };

            try {
                const response = await fetch('/api/update-appointment-showed-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(rowData),
                });
                const result = await response.json();
                if (result.success) {
                    alert('Dados e cálculo de "To Pay" atualizados com sucesso!');
                    initPage(); // Recarrega a tabela para mostrar os dados atualizados
                } else {
                    alert(`Erro ao salvar: ${result.message}`);
                }
            } catch (error) {
                console.error('Erro na requisição da API:', error);
                alert('Erro na comunicação com o servidor. Tente novamente.');
            }
        }
    });

    // Adiciona event listeners para os novos filtros
    customersFilter.addEventListener('input', applyFilters);
    codeFilter.addEventListener('input', applyFilters);
    startDateFilter.addEventListener('change', applyFilters);
    endDateFilter.addEventListener('change', applyFilters);
    technicianFilter.addEventListener('change', applyFilters);
    verificationFilter.addEventListener('change', applyFilters);

    initPage();
});
