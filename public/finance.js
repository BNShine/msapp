// public/finance.js

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('payroll-table-body');
    const tableFooter = document.getElementById('payroll-table-footer');
    const variablesBody = document.getElementById('variables-table-body');
    const technicianFilter = document.getElementById('technician-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const addVariableBtn = document.getElementById('add-variable-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');

    let allAppointmentsData = [];
    let allTechnicians = [];
    let payrollConfig = loadPayrollConfig(); // { 'Technician Name': { commission: '20%', fixedPay: '900.00' } }
    let customVariables = loadCustomVariables(); // [{ tech: 'Name', desc: '...', value: 0, total: 0, current: 0 }]
    
    // Configurações padrão
    const COMMISSION_OPTIONS = ["20%", "25%"];
    const FIXED_PAYMENT_OPTIONS = ["Selecionar", "750.00", "900.00"];

    // --- Helper Functions ---

    function formatCurrency(value) {
        if (typeof value !== 'number') {
            value = parseFloat(value);
        }
        if (isNaN(value)) return '$0.00';
        // Formata para USD com separador de milhar e duas casas decimais
        return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    function parseNumeric(value) {
        if (typeof value === 'string') {
            return parseFloat(value.replace('$', '').replace(/,/g, ''));
        }
        return parseFloat(value);
    }

    // --- Local Storage Management ---

    function loadPayrollConfig() {
        try {
            return JSON.parse(localStorage.getItem('payrollConfig')) || {};
        } catch {
            return {};
        }
    }

    function savePayrollConfig() {
        localStorage.setItem('payrollConfig', JSON.stringify(payrollConfig));
        alert('Configurações de comissão e pagamento fixo salvas com sucesso!');
    }
    
    function loadCustomVariables() {
        try {
            return JSON.parse(localStorage.getItem('customVariables')) || [];
        } catch {
            return [];
        }
    }

    function saveCustomVariables() {
        localStorage.setItem('customVariables', JSON.stringify(customVariables));
    }

    // --- Core Payroll Calculation Logic (Simulating Python's logic) ---

    function calculatePayrollSummary(data) {
        const technicianSummary = data.reduce((acc, appointment) => {
            const techName = appointment.technician;
            if (!techName) return acc;

            const service = parseNumeric(appointment.serviceShowed || 0);
            const tips = parseNumeric(appointment.tips || 0);
            const pets = parseNumeric(appointment.petShowed || 0);

            if (!acc[techName]) {
                acc[techName] = {
                    totalPets: 0,
                    totalAppointments: 0,
                    totalServices: 0,
                    totalTips: 0,
                };
            }

            acc[techName].totalPets += pets;
            acc[techName].totalAppointments++;
            acc[techName].totalServices += service;
            acc[techName].totalTips += tips;
            
            return acc;
        }, {});
        
        const finalPayroll = Object.keys(technicianSummary).map(techName => {
            const summary = technicianSummary[techName];
            const config = payrollConfig[techName] || {};
            const customVars = customVariables.filter(v => v.tech === techName).reduce((sum, v) => sum + parseNumeric(v.value), 0);

            const producedValue = summary.totalServices + summary.totalTips;
            
            // Get saved commission or default to 20%
            const commissionRate = parseNumeric(config.commission || '20%') / 100;
            
            // 1. Calculate Pagamento Base
            const basePay = (summary.totalServices * commissionRate) + summary.totalTips;
            
            // 2. Determine Payment for Calculation (Fixed or Base)
            const fixedPayAmount = parseNumeric(config.fixedPay) || 0;
            const paymentForCalc = (fixedPayAmount > 0 && config.fixedPay !== 'Selecionar') ? fixedPayAmount : basePay;
            
            // 3. Calculate Pagamento Final
            const finalPay = paymentForCalc + customVars;
            
            // 4. Calculate Support Value
            const supportValue = finalPay > basePay ? (finalPay - basePay) : 0;

            return {
                technician: techName,
                totalPets: summary.totalPets,
                totalAppointments: summary.totalAppointments,
                totalServices: summary.totalServices,
                totalTips: summary.totalTips,
                producedValue: producedValue,
                commissionRate: (commissionRate * 100).toFixed(0) + '%',
                basePay: basePay,
                fixedPay: config.fixedPay || 'Selecionar',
                customVars: customVars,
                finalPay: finalPay,
                supportValue: supportValue,
            };
        });

        return finalPayroll;
    }

    // --- UI Rendering ---

    function renderPayrollTable(payrollData) {
        tableBody.innerHTML = '';
        
        let totalPetsSum = 0;
        let totalAppointmentsSum = 0;
        let totalProducedSum = 0;
        let totalBasePaySum = 0;
        let totalCustomVarsSum = 0;
        let totalFinalPaySum = 0;
        let totalSupportValueSum = 0;

        if (payrollData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center">Nenhum dado encontrado para o período selecionado.</td></tr>';
            tableFooter.innerHTML = '';
            return;
        }

        payrollData.forEach(data => {
            const techName = data.technician;
            const savedConfig = payrollConfig[techName] || {};
            
            totalPetsSum += data.totalPets;
            totalAppointmentsSum += data.totalAppointments;
            totalProducedSum += data.producedValue;
            totalBasePaySum += data.basePay;
            totalCustomVarsSum += data.customVars;
            totalFinalPaySum += data.finalPay;
            totalSupportValueSum += data.supportValue;
            
            const basePayClass = data.basePay < 900 ? 'red-text' : '';
            const finalPayClass = data.finalPay < 900 ? 'red-text' : '';
            const varsClass = data.customVars > 0 ? 'green-text' : (data.customVars < 0 ? 'red-text' : '');

            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            
            const commissionIndex = COMMISSION_OPTIONS.indexOf(savedConfig.commission || '20%');
            const fixedIndex = FIXED_PAYMENT_OPTIONS.indexOf(savedConfig.fixedPay || 'Selecionar');

            row.innerHTML = `
                <td class="data-row font-semibold">${techName}</td>
                <td class="data-row">${data.totalPets}</td>
                <td class="data-row">${data.totalAppointments}</td>
                <td class="data-row">${formatCurrency(data.producedValue)}</td>
                <td class="data-row">
                    <select data-tech="${techName}" data-config="commission" class="w-20">
                        ${COMMISSION_OPTIONS.map(opt => `<option value="${opt}" ${opt === (savedConfig.commission || '20%') ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </td>
                <td class="data-row ${basePayClass}">${formatCurrency(data.basePay)}</td>
                <td class="data-row">
                    <select data-tech="${techName}" data-config="fixedPay" class="w-20">
                        ${FIXED_PAYMENT_OPTIONS.map(opt => `<option value="${opt}" ${opt === (savedConfig.fixedPay || 'Selecionar') ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </td>
                <td class="data-row ${varsClass}">${formatCurrency(data.customVars)}</td>
                <td class="data-row font-bold ${finalPayClass}">${formatCurrency(data.finalPay)}</td>
                <td class="data-row">${formatCurrency(data.supportValue)}</td>
            `;
            tableBody.appendChild(row);
        });
        
        // Adiciona listeners para os selects de configuração (Comissão e Fixo)
        tableBody.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                const tech = e.target.dataset.tech;
                const configKey = e.target.dataset.config;
                const value = e.target.value;
                
                payrollConfig[tech] = { ...payrollConfig[tech], [configKey]: value };
                
                // Dispara uma atualização local para recalcular e renderizar a tabela
                const currentData = calculatePayrollSummary(allAppointmentsData);
                renderPayrollTable(currentData);
                renderVariableTable(); 
            });
        });

        // Rodapé de totalização
        tableFooter.innerHTML = `
            <tr>
                <td class="data-row font-bold">TOTAL</td>
                <td class="data-row font-bold">${totalPetsSum}</td>
                <td class="data-row font-bold">${totalAppointmentsSum}</td>
                <td class="data-row font-bold">${formatCurrency(totalProducedSum)}</td>
                <td class="data-row"></td>
                <td class="data-row font-bold">${formatCurrency(totalBasePaySum)}</td>
                <td class="data-row"></td>
                <td class="data-row font-bold ${totalCustomVarsSum > 0 ? 'green-text' : (totalCustomVarsSum < 0 ? 'red-text' : '')}">${formatCurrency(totalCustomVarsSum)}</td>
                <td class="data-row font-bold">${formatCurrency(totalFinalPaySum)}</td>
                <td class="data-row font-bold">${formatCurrency(totalSupportValueSum)}</td>
            </tr>
        `;
    }
    
    function renderVariableTable() {
        variablesBody.innerHTML = '';

        if (customVariables.length === 0) {
            variablesBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Nenhuma variável adicionada.</td></tr>';
            return;
        }
        
        const technicianOptions = [''].concat(allTechnicians.sort());

        customVariables.forEach((variable, index) => {
            const valueClass = parseNumeric(variable.value) > 0 ? 'green-text' : (parseNumeric(variable.value) < 0 ? 'red-text' : '');
            
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            
            row.innerHTML = `
                <td class="data-row">
                    <select data-index="${index}" data-key="tech" class="w-full">
                        ${technicianOptions.map(opt => `<option value="${opt}" ${opt === variable.tech ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </td>
                <td class="data-row"><input type="text" data-index="${index}" data-key="desc" value="${variable.desc}" class="w-full text-left"></td>
                <td class="data-row">
                    <input type="number" data-index="${index}" data-key="value" value="${variable.value}" step="0.01" class="w-full text-center ${valueClass}">
                </td>
                <td class="data-row"><input type="number" data-index="${index}" data-key="total" value="${variable.total}" step="1" class="w-full text-center"></td>
                <td class="data-row"><input type="number" data-index="${index}" data-key="current" value="${variable.current}" step="1" class="w-full text-center"></td>
                <td class="data-row">
                    <button data-index="${index}" class="delete-var-btn text-red-600 hover:text-red-800">🗑️</button>
                </td>
            `;
            variablesBody.appendChild(row);
        });

        // Add listeners for variable inputs and selects
        variablesBody.querySelectorAll('input, select').forEach(element => {
            element.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                const key = e.target.dataset.key;
                
                let value = e.target.value;
                if (key === 'value' || key === 'total' || key === 'current') {
                    value = parseNumeric(value) || 0;
                }

                customVariables[index][key] = value;
                saveCustomVariables();
                
                // Recalcula e renderiza as tabelas
                const currentData = calculatePayrollSummary(allAppointmentsData);
                renderPayrollTable(currentData);
                renderVariableTable();
            });
        });
        
        variablesBody.querySelectorAll('.delete-var-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                customVariables.splice(index, 1);
                saveCustomVariables();
                
                // Recalcula e renderiza as tabelas
                const currentData = calculatePayrollSummary(allAppointmentsData);
                renderPayrollTable(currentData);
                renderVariableTable();
            });
        });
    }

    // --- Data Fetching and Initialization ---

    async function fetchTechnicians() {
        try {
            // Reusa o endpoint que já busca a lista de técnicos
            const response = await fetch('/api/get-dashboard-data');
            if (!response.ok) throw new Error('Falha ao carregar lista de técnicos.');
            const data = await response.json();
            allTechnicians = data.technicians || [];
            
            // Popula o filtro de técnicos
            technicianFilter.innerHTML = '<option value="">Todos os Técnicos</option>' + allTechnicians.map(t => `<option value="${t}">${t}</option>`).join('');

        } catch (error) {
            console.error('Erro ao carregar técnicos:', error);
        }
    }
    
    async function fetchAppointments() {
        try {
            // Reusa o endpoint que já busca os dados de atendimento e serviço
            const response = await fetch('/api/get-customers-data');
            if (!response.ok) {
                 const error = await response.json();
                 throw new Error(error.error || 'Falha ao carregar dados de agendamentos.');
            }
            const data = await response.json();
            allAppointmentsData = data.customers.filter(c => c.technician); // Filtra apenas o que tem técnico atribuído
            
        } catch (error) {
            console.error('Erro ao carregar dados de agendamentos:', error);
            tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-red-600">Erro ao carregar dados: ${error.message}</td></tr>`;
        }
    }

    async function initPage() {
        await fetchTechnicians();
        await fetchAppointments();
        
        applyFilters();
    }

    // --- Filters and Event Listeners ---
    
    function applyFilters() {
        const selectedTechnician = technicianFilter.value;
        const startDate = startDateFilter.value ? new Date(startDateFilter.value) : null;
        const endDate = endDateFilter.value ? new Date(endDateFilter.value) : null;
        
        // Define o limite superior para a data de hoje, se nenhum final for definido
        const effectiveEndDate = endDate || new Date(); 
        
        const filteredAppointments = allAppointmentsData.filter(app => {
            const appDate = new Date(app.appointmentDate.replace(/(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3'));
            
            const matchesTech = !selectedTechnician || app.technician === selectedTechnician;
            
            const matchesDate = (!startDate || appDate >= startDate) && (appDate <= effectiveEndDate);
            
            return matchesTech && matchesDate;
        });
        
        const payrollSummary = calculatePayrollSummary(filteredAppointments);
        renderPayrollTable(payrollSummary);
        renderVariableTable(); 
    }

    // Event Listeners
    applyFiltersBtn.addEventListener('click', applyFilters);
    
    saveConfigBtn.addEventListener('click', savePayrollConfig);
    
    addVariableBtn.addEventListener('click', () => {
        customVariables.push({ tech: '', desc: '', value: 0, total: 0, current: 0 });
        saveCustomVariables();
        renderVariableTable();
    });
    
    // Download CSV Logic
    downloadCsvBtn.addEventListener('click', () => {
        const dataToExport = calculatePayrollSummary(allAppointmentsData);
        if (dataToExport.length === 0) {
            alert("Nenhum dado para exportar.");
            return;
        }

        let csv = 'Técnico,Pets,Serviços,Produzido ($),Comissão (%),Pagto Base ($),Pagto Fixo,Variáveis ($),Pagto Final ($),Support ($)\n';

        dataToExport.forEach(row => {
            csv += `${row.technician},${row.totalPets},${row.totalAppointments},${row.producedValue.toFixed(2)},${row.commissionRate},${row.basePay.toFixed(2)},${row.fixedPay},${row.customVars.toFixed(2)},${row.finalPay.toFixed(2)},${row.supportValue.toFixed(2)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'payroll_summary.csv');
        link.click();
    });

    initPage();
});
