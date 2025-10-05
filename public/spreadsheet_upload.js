document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const fileUpload = document.getElementById('file-upload');
    const processBtn = document.getElementById('process-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const tableHead = document.getElementById('results-table-head');
    const tableBody = document.getElementById('results-table-body');
    const loadingSpinner = document.getElementById('loading-spinner');
    const dashboardSection = document.getElementById('dashboard-section');
    const filterName = document.getElementById('filter-name');
    const filterWeek = document.getElementById('filter-week');
    const totalServicoCard = document.getElementById('total-servico');
    const totalGorjetaCard = document.getElementById('total-gorjeta');
    const totalPetsCard = document.getElementById('total-pets');

    // Armazenamento dos dados
    let processedData = [];
    let filteredData = [];

    // Constantes de validação
    const FORMAS_PAGAMENTO_VALIDAS = [
        'Check', 'American Express', 'Apple Pay', 'Discover',
        'Master Card', 'Visa', 'Zelle', 'Cash', 'Invoice'
    ];
    const INVALID_CLIENTS = ['SERVICES IN:', 'BNS PROFIT:', 'Total'];

    // Event Listeners
    processBtn.addEventListener('click', handleProcessFiles);
    exportCsvBtn.addEventListener('click', () => exportToCSV(filteredData));
    exportPdfBtn.addEventListener('click', () => exportToPDF(filteredData));
    filterName.addEventListener('change', applyFilters);
    filterWeek.addEventListener('change', applyFilters);

    async function handleProcessFiles() {
        if (fileUpload.files.length === 0) {
            alert('Please select at least one file to process.');
            return;
        }

        loadingSpinner.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center">Processing...</td></tr>';
        processedData = [];

        for (const file of fileUpload.files) {
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const result = processWorkbook(workbook);
                processedData.push(...result);
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                alert(`An error occurred while processing ${file.name}.`);
            }
        }

        loadingSpinner.classList.add('hidden');
        if (processedData.length > 0) {
            dashboardSection.classList.remove('hidden');
            populateFilters();
            applyFilters();
        } else {
             tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center">No valid data found in the processed file(s).</td></tr>';
        }
    }

    function processWorkbook(workbook) {
        let allData = [];
        workbook.SheetNames.forEach(sheetName => {
            if (!sheetName.startsWith('WEEK')) return;

            const worksheet = workbook.Sheets[sheetName];
            const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
            if (jsonSheet.length === 0) return;

            const technicianBlocks = [];
            let currentBlock = [];
            let collecting = false;

            jsonSheet.forEach(row => {
                const rowString = JSON.stringify(row);
                if (rowString.includes('NAME:')) {
                    if (currentBlock.length > 0) technicianBlocks.push(currentBlock);
                    currentBlock = [];
                    collecting = true;
                }
                if (collecting) currentBlock.push(row);
            });
            if (currentBlock.length > 0) technicianBlocks.push(currentBlock);

            technicianBlocks.forEach(block => {
                const nameRow = block.find(row => JSON.stringify(row).includes('NAME:'));
                if (!nameRow) return;

                const nameColIdx = nameRow.findIndex(cell => typeof cell === 'string' && cell.includes('NAME:'));
                if (nameColIdx === -1) return;

                const technicianInfo = {
                    Semana: sheetName,
                    Nome: nameRow[nameColIdx + 1] || 'N/A',
                    Categoria: nameRow[nameColIdx + 3] || 'N/A'
                };

                const headerRowIdx = block.findIndex(row => {
                    const rowString = JSON.stringify(row);
                    return rowString.includes('Schedule') && rowString.includes('DATE') && rowString.includes('SERVICE');
                });
                if (headerRowIdx === -1) return;

                for (let i = headerRowIdx + 1; i < block.length; i++) {
                    const dayRow = block[i];
                    const dayColumns = [1, 10, 19, 28, 37, 46, 55];
                    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

                    dayColumns.forEach((startCol, dayIdx) => {
                        const clientName = dayRow[startCol] ? String(dayRow[startCol]).trim() : '';
                        
                        // *** NOVA REGRA ADICIONADA AQUI ***
                        const clientNameUpper = clientName.toUpperCase();
                        if (!clientName || 
                            INVALID_CLIENTS.some(invalid => clientNameUpper.includes(invalid.toUpperCase())) ||
                            clientNameUpper.startsWith('PAY TO')) {
                            return;
                        }

                        const serviceValueRaw = dayRow[startCol + 2];
                        const serviceValue = (serviceValueRaw !== null && serviceValueRaw !== '') ? parseFloat(serviceValueRaw) : 0;

                        if (!isNaN(serviceValue) && serviceValue > 0) {
                            allData.push({
                                ...technicianInfo,
                                Dia: daysOfWeek[dayIdx],
                                Data: dayRow[startCol + 1],
                                Cliente: clientName,
                                'Serviço': serviceValue,
                                Gorjeta: (dayRow[startCol + 3] !== null && dayRow[startCol + 3] !== '') ? parseFloat(dayRow[startCol + 3]) : 0,
                                Pets: (dayRow[startCol + 4] !== null && dayRow[startCol + 4] !== '') ? parseInt(dayRow[startCol + 4], 10) : 0,
                                Pagamento: (dayRow[startCol + 5] && FORMAS_PAGAMENTO_VALIDAS.includes(dayRow[startCol + 5])) ? dayRow[startCol + 5] : null,
                                Realizado: true
                            });
                        }
                    });
                }
            });
        });
        return allData;
    }

    function populateFilters() {
        const names = [...new Set(processedData.map(item => item.Nome))].sort();
        const weeks = [...new Set(processedData.map(item => item.Semana))].sort();

        filterName.innerHTML = names.map(name => `<option value="${name}">${name}</option>`).join('');
        filterWeek.innerHTML = weeks.map(week => `<option value="${week}">${week}</option>`).join('');
    }

    function applyFilters() {
        const selectedNames = Array.from(filterName.selectedOptions).map(opt => opt.value);
        const selectedWeeks = Array.from(filterWeek.selectedOptions).map(opt => opt.value);

        filteredData = processedData.filter(item => {
            const nameMatch = selectedNames.length === 0 || selectedNames.includes(item.Nome);
            const weekMatch = selectedWeeks.length === 0 || selectedWeeks.includes(item.Semana);
            return nameMatch && weekMatch;
        });

        updateDashboard();
    }
    
    function updateDashboard() {
        updateCards();
        displayData(filteredData);
    }

    function updateCards() {
        const totalServico = filteredData.reduce((sum, item) => sum + (item['Serviço'] || 0), 0);
        const totalGorjeta = filteredData.reduce((sum, item) => sum + (item.Gorjeta || 0), 0);
        const totalPets = filteredData.reduce((sum, item) => sum + (item.Pets || 0), 0);
        
        totalServicoCard.textContent = `$${totalServico.toFixed(2)}`;
        totalGorjetaCard.textContent = `$${totalGorjeta.toFixed(2)}`;
        totalPetsCard.textContent = totalPets;
    }

    function displayData(data) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center text-muted-foreground">No data matches the current filters.</td></tr>';
            return;
        }

        const headers = Object.keys(data[0]);
        const headerRow = document.createElement('tr');
        headerRow.className = "bg-muted text-muted-foreground uppercase text-xs font-semibold";
        headers.forEach(header => {
            const th = document.createElement('th');
            th.className = "p-4 border-b border-border";
            th.textContent = header;
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-border hover:bg-muted/50 transition-colors";
            headers.forEach(header => {
                const td = document.createElement('td');
                td.className = "p-4";
                let cellValue = row[header];
                if (header === 'Data' && !isNaN(cellValue) && cellValue > 10000) {
                    const date = new Date(Date.UTC(1900, 0, cellValue - 1));
                    cellValue = date.toLocaleDateString();
                }
                td.textContent = cellValue !== null ? cellValue : '';
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    }

    function exportToCSV(data) {
        if (data.length === 0) {
            alert('No data to export.');
            return;
        }
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];
                if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
                return value;
            });
            csvRows.push(values.join(','));
        });

        downloadFile(csvRows.join('\n'), 'filtered_data.csv', 'text/csv');
    }

    function exportToPDF(data) {
        if (data.length === 0) {
            alert('No data to export.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const headers = Object.keys(data[0]);
        const body = data.map(row => headers.map(header => row[header]));

        doc.autoTable({
            head: [headers],
            body: body,
            startY: 25,
            didDrawPage: function(data) {
                doc.setFontSize(18);
                doc.text('Filtered Data Report', 14, 20);
            }
        });

        doc.save('filtered_data.pdf');
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', fileName);
        a.click();
        URL.revokeObjectURL(url);
    }
});
