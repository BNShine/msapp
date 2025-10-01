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
    
    // Helper para formatar YYYY/MM/DD (do backend) para YYYY-MM-DD (para input HTML type=date)
    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        // Se o formato for YYYY/MM/DD, substitui '/' por '-'
        return dateStr.replace(/\//g, '-'); 
    }

    // Função auxiliar para popular dropdowns
    function populateDropdown(selectElement, items) {
        if (items && Array.isArray(items)) {
            // Adiciona a opção "All" ou "Select"
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = selectElement.id === 'technician-filter' ? 'All Technicians' : 'All Verifications';
            selectElement.appendChild(defaultOption);
            
            // Adiciona as demais opções
            items.forEach(item => {
                if (item) {
                    const option = document.createElement('option');
                    option.value = item;
                    option.textContent = item;
                    selectElement.appendChild(option);
                }
            });
        }
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
                    <td class="p-4"><input type="date" value="${formatDateForInput(appointment.appointmentDate)}" style="width: 130px;" class="bg-transparent border border-border rounded-md px-2 date-input"></td>
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
        const selectedStartDate = startDateFilter.value ? new Date(startDateFilter.value) : null;
        const selectedEndDate = endDateFilter.value ? new Date(endDateFilter.value) : null;
        const selectedTechnician = technicianFilter.value.toLowerCase();
        const selectedVerification = verificationFilter.value.toLowerCase();

        const filteredData = allAppointmentsData.filter(appointment => {
            // Usa a data do agendamento para filtros de data
            const appointmentDate = new Date(appointment.appointmentDate.split('/').reverse().join('-'));

            const matchesCustomers = searchTermCustomers === '' || 
                                     (appointment.customers && appointment.customers.toLowerCase().includes(searchTermCustomers));
            
            const matchesCode = searchTermCode === '' || 
                                (appointment.code && appointment.code.toLowerCase().includes(searchTermCode));
            
            const matchesDateRange = (!selectedStartDate || appointmentDate >= selectedStartDate) &&
                                     (!selectedEndDate || appointmentDate <= selectedEndDate);
            
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

            const inputs = row.querySelectorAll('input');
            const selects = row.querySelectorAll('select');
            
            // Mapeamento dos elementos de entrada e seleção:
            // inputs: [0] appointmentDate (Date), [1] serviceShowed (Text), [2] tips (Text)
            // selects: [0] technician (Dropdown), [1] petShowed (Dropdown), [2] percentage (Dropdown), [3] paymentMethod (Dropdown), [4] verification (Dropdown)

            const rowData = {
                rowIndex: parseInt(sheetRowNumber, 10),
                appointmentDate: inputs[0].value, 
                // customers é ignorado
                technician: selects[0].value, // Technician é o primeiro select
                petShowed: selects[1].value,
                serviceShowed: inputs[1].value, 
                tips: inputs[2].value, 
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
