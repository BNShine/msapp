// public/finance.js

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('payroll-table-body');
    const tableFooter = document.getElementById('payroll-table-footer');
    const variablesBody = document.getElementById('variables-table-body');
    const presetFilter = document.getElementById('preset-filter'); 
    const technicianFilter = document.getElementById('technician-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const addVariableBtn = document.getElementById('add-variable-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn'); // PDF Button ID

    let allAppointmentsData = [];
    let allTechnicians = [];
    let payrollConfig = loadPayrollConfig(); 
    let customVariables = loadCustomVariables(); 
    
    // Default translated configurations
    const COMMISSION_OPTIONS = ["20%", "25%"];
    const FIXED_PAYMENT_OPTIONS = ["Select", "750.00", "900.00"];

    // --- Helper Functions ---

    function formatCurrency(value) {
        if (typeof value !== 'number') {
            value = parseFloat(value);
        }
        if (isNaN(value)) return '$0.00';
        // Formats to USD with comma thousands separator and two decimal places
        return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    function parseNumeric(value) {
        if (typeof value === 'string') {
            return parseFloat(value.replace('$', '').replace(/,/g, ''));
        }
        return parseFloat(value);
    }
    
    // Function to format Date to YYYY-MM-DD (HTML input format)
    function formatDateToInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Function to calculate predefined dates (Last Week, Last Month)
    function getPresetDates(preset) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        let startDate, endDate;
        
        if (preset === 'last-week') {
            // Last Week: Sunday to Saturday.
            
            // Calculate last Saturday (end of period)
            const lastSaturday = new Date(today);
            lastSaturday.setDate(today.getDate() - today.getDay() - 1);
            
            // Calculate previous Sunday (start of period)
            const lastSunday = new Date(lastSaturday);
            lastSunday.setDate(lastSaturday.getDate() - 6);
            
            startDate = lastSunday;
            endDate = lastSaturday;

        } else if (preset === 'last-month') {
            // Last Month: First day of last month until the last day of last month.
            
            // Start: First day of last month (month current - 1)
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            
            // End: Last day of last month (day 0 of current month)
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        } else {
            return { start: '', end: '' };
        }
        
        return {
            start: formatDateToInput(startDate),
            end: formatDateToInput(endDate)
        };
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
        alert('Commission and fixed pay settings saved successfully!');
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

            if (service === 0 && tips === 0) return acc;

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
            
            // 1. Calculate Base Pay
            const basePay = (summary.totalServices * commissionRate) + summary.totalTips;
            
            // 2. Determine Payment for Calculation (Fixed or Base)
            const fixedPayAmount = parseNumeric(config.fixedPay) || 0;
            const paymentForCalc = (fixedPayAmount > 0 && config.fixedPay !== 'Select') ? fixedPayAmount : basePay;
            
            // 3. Calculate Final Pay
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
                fixedPay: config.fixedPay || 'Select',
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
            tableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center">No data found for the selected period.</td></tr>';
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
            const fixedIndex = FIXED_PAYMENT_OPTIONS.indexOf(savedConfig.fixedPay || 'Select');

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
                        ${FIXED_PAYMENT_OPTIONS.map(opt => `<option value="${opt}" ${opt === (savedConfig.fixedPay || 'Select') ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </td>
                <td class="data-row ${varsClass}">${formatCurrency(data.customVars)}</td>
                <td class="data-row font-bold ${finalPayClass}">${formatCurrency(data.finalPay)}</td>
                <td class="data-row">${formatCurrency(data.supportValue)}</td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add listeners for configuration selects (Commission and Fixed Pay)
        tableBody.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                const tech = e.target.dataset.tech;
                const configKey = e.target.dataset.config;
                const value = e.target.value;
                
                payrollConfig[tech] = { ...payrollConfig[tech], [configKey]: value };
                
                // Trigger local update to recalculate and render the table
                const currentData = calculatePayrollSummary(allAppointmentsData);
                renderPayrollTable(currentData);
                renderVariableTable(); 
            });
        });

        // Totalization Footer
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
            variablesBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">No variables added.</td></tr>';
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
                
                // Recalculate and render tables
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
                
                // Recalculate and render tables
                const currentData = calculatePayrollSummary(allAppointmentsData);
                renderPayrollTable(currentData);
                renderVariableTable();
            });
        });
    }

    // --- Data Fetching and Initialization ---

    async function fetchTechnicians() {
        try {
            // Reuses the endpoint that already fetches the list of technicians
            const response = await fetch('/api/get-dashboard-data');
            if (!response.ok) throw new Error('Failed to load technician list.');
            const data = await response.json();
            allTechnicians = data.technicians || [];
            
            // Populate technician filter
            technicianFilter.innerHTML = '<option value="">All Technicians</option>' + allTechnicians.map(t => `<option value="${t}">${t}</option>`).join('');

        } catch (error) {
            console.error('Error loading technicians:', error);
        }
    }
    
    async function fetchAppointments() {
        try {
            // Reuses the endpoint that fetches appointments and service data
            const response = await fetch('/api/get-customers-data');
            if (!response.ok) {
                 const error = await response.json();
                 throw new Error(error.error || 'Failed to load appointment data.');
            }
            const data = await response.json();
            // Filter only what has an assigned technician AND a service/tip value (assumed 'Showed')
            allAppointmentsData = data.customers.filter(c => c.technician && (parseNumeric(c.serviceShowed) > 0 || parseNumeric(c.tips) > 0)); 
            
        } catch (error) {
            console.error('Error loading appointment data:', error);
            tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-red-600">Error loading data: ${error.message}</td></tr>`;
        }
    }

    async function initPage() {
        await fetchTechnicians();
        await fetchAppointments();
        
        // Set filter to 'Last Month' on load (better default)
        presetFilter.value = 'last-month';
        handlePresetChange();
    }

    // --- Filter Helper for PDF Export ---

    function getFilteredAppointments() {
        const selectedTechnician = technicianFilter.value;
        
        const startDate = startDateFilter.value ? new Date(startDateFilter.value + 'T00:00:00') : null;
        const endDate = endDateFilter.value ? new Date(endDateFilter.value + 'T23:59:59') : null; 

        if (!startDate || !endDate) {
             return [];
        }

        return allAppointmentsData.filter(app => {
            const appDate = new Date(app.appointmentDate.replace(/\//g, '-') + 'T00:00:00');
            const matchesTech = !selectedTechnician || app.technician === selectedTechnician;
            const matchesDate = appDate >= startDate && appDate <= endDate;
            
            return matchesTech && matchesDate;
        });
    }

    // --- Filters and Event Listeners ---
    
    function applyFilters() {
        
        const filteredAppointments = getFilteredAppointments();
        
        if (filteredAppointments.length === 0) {
            renderPayrollTable([]);
            alert("No appointments found for the selected filters.");
            return;
        }
        
        const payrollSummary = calculatePayrollSummary(filteredAppointments);
        renderPayrollTable(payrollSummary);
        renderVariableTable(); 
    }
    
    // Logic for the preset selector
    function handlePresetChange() {
        const preset = presetFilter.value;
        const dates = getPresetDates(preset);
        
        startDateFilter.value = dates.start;
        endDateFilter.value = dates.end;
        
        if (preset) {
            applyFilters();
        } else {
             // If Custom Period is selected, clear dates and wait for manual entry/apply click
             startDateFilter.value = '';
             endDateFilter.value = '';
        }
    }


    // Event Listeners
    applyFiltersBtn.addEventListener('click', applyFilters);
    presetFilter.addEventListener('change', handlePresetChange); 
    
    // Ensure technician filter still triggers date filter logic
    technicianFilter.addEventListener('change', () => {
         // If a preset is active, reapply it. Otherwise, use manual dates.
         if (presetFilter.value) {
            handlePresetChange();
         } else {
            applyFilters();
         }
    });
    
    saveConfigBtn.addEventListener('click', savePayrollConfig);
    
    addVariableBtn.addEventListener('click', () => {
        customVariables.push({ tech: '', desc: '', value: 0, total: 0, current: 0 });
        saveCustomVariables();
        renderVariableTable();
    });
    
    // PDF Logic (Replaced CSV download)
    downloadPdfBtn.addEventListener('click', async () => { 
        const filteredAppointments = getFilteredAppointments();
        
        // Recalcula o summary APENAS dos dados filtrados para ter certeza do que está sendo exportado
        const dataToExport = calculatePayrollSummary(filteredAppointments);
        
        if (dataToExport.length === 0) {
            alert("No data to export. Please apply filters that return data.");
            return;
        }
        
        // Calculate Totals Row
        const totals = dataToExport.reduce((acc, row) => {
            acc.totalPets += row.totalPets;
            acc.totalAppointments += row.totalAppointments;
            acc.totalProduced += row.producedValue;
            acc.totalBasePay += row.basePay;
            acc.totalCustomVars += row.customVars;
            acc.totalFinalPay += row.finalPay;
            acc.totalSupportValue += row.supportValue;
            return acc;
        }, {
            totalPets: 0, totalAppointments: 0, totalProduced: 0, totalBasePay: 0,
            totalCustomVars: 0, totalFinalPay: 0, totalSupportValue: 0
        });
        
        // Add the TOTAL row (must be the last element for backend processing)
        dataToExport.push({
            technician: 'TOTAL',
            totalPets: totals.totalPets,
            totalAppointments: totals.totalAppointments,
            producedValue: totals.totalProduced,
            commissionRate: '',
            basePay: totals.totalBasePay,
            fixedPay: '',
            customVars: totals.totalCustomVars,
            finalPay: totals.totalFinalPay,
            supportValue: totals.totalSupportValue,
        });


        try {
            const response = await fetch('/api/generate-payroll-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToExport),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Failed to generate PDF.' }));
                throw new Error(error.message || 'Server returned error status: ' + response.status);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'Technician_Payroll_Summary.pdf';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) {
                    filename = match[1];
                }
            }

            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            alert(`PDF Export Error: ${error.message}. Please ensure the backend is correctly configured with 'pdfkit' and accessible at /api/generate-payroll-pdf.`);
            console.error('PDF Export Error:', error);
        }
    });

    initPage();
});
