document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('file-upload');
    const processBtn = document.getElementById('process-btn');
    const exportBtn = document.getElementById('export-btn');
    const tableHead = document.getElementById('results-table-head');
    const tableBody = document.getElementById('results-table-body');
    const loadingSpinner = document.getElementById('loading-spinner');

    let processedData = [];

    const FORMAS_PAGAMENTO_VALIDAS = [
        'Check', 'American Express', 'Apple Pay', 'Discover',
        'Master Card', 'Visa', 'Zelle', 'Cash', 'Invoice'
    ];
    const INVALID_CLIENTS = ['SERVICES IN:', 'BNS PROFIT:', 'Total'];

    processBtn.addEventListener('click', async () => {
        if (fileUpload.files.length === 0) {
            alert('Please select at least one file to process.');
            return;
        }

        loadingSpinner.classList.remove('hidden');
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
        displayData(processedData);
    });

    exportBtn.addEventListener('click', () => {
        if (processedData.length === 0) {
            alert('No data to export. Please process a file first.');
            return;
        }
        exportToCSV(processedData);
    });

    function processWorkbook(workbook) {
        let allData = [];
        workbook.SheetNames.forEach(sheetName => {
            if (sheetName.startsWith('WEEK')) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                
                if (jsonSheet.length === 0) return;

                const technicianBlocks = [];
                let currentBlock = [];
                let collecting = false;

                jsonSheet.forEach(row => {
                    const rowString = JSON.stringify(row);
                    if (rowString.includes('NAME:')) {
                        if (currentBlock.length > 0) {
                            technicianBlocks.push(currentBlock);
                        }
                        currentBlock = [];
                        collecting = true;
                    }
                    if (collecting) {
                        currentBlock.push(row);
                    }
                });
                if (currentBlock.length > 0) {
                    technicianBlocks.push(currentBlock);
                }

                technicianBlocks.forEach(block => {
                    const nameRow = block.find(row => JSON.stringify(row).includes('NAME:'));
                    if (!nameRow) return;

                    const nameColIdx = nameRow.findIndex(cell => typeof cell === 'string' && cell.includes('NAME:'));
                    if (nameColIdx === -1) return;

                    const technicianInfo = {
                        Semana: sheetName,
                        Nome: nameRow[nameColIdx + 1] || null,
                        Categoria: nameRow[nameColIdx + 3] || null,
                        Origem: (nameRow[nameColIdx + 4] && String(nameRow[nameColIdx + 4]).includes('From:')) ? nameRow[nameColIdx + 5] : null
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

                            if (!clientName || INVALID_CLIENTS.some(invalid => clientName.toUpperCase().includes(invalid.toUpperCase()))) {
                                return;
                            }

                            const serviceValueRaw = dayRow[startCol + 2];
                            let serviceValue = 0;
                            if (serviceValueRaw !== null && serviceValueRaw !== '') {
                                serviceValue = parseFloat(serviceValueRaw);
                            }

                            if (!isNaN(serviceValue) && serviceValue > 0) {
                                const tipValueRaw = dayRow[startCol + 3];
                                const pagamento = dayRow[startCol + 5];

                                const dayInfo = {
                                    Dia: daysOfWeek[dayIdx],
                                    Data: dayRow[startCol + 1],
                                    Cliente: clientName,
                                    Serviço: serviceValue,
                                    Gorjeta: (tipValueRaw !== null && tipValueRaw !== '') ? parseFloat(tipValueRaw) : 0,
                                    Pets: dayRow[startCol + 4] || 0,
                                    Pagamento: (pagamento && FORMAS_PAGAMENTO_VALIDAS.includes(pagamento)) ? pagamento : null,
                                    Realizado: true
                                };
                                allData.push({ ...technicianInfo, ...dayInfo });
                            }
                        });
                    }
                });
            }
        });
        return allData;
    }

    function displayData(data) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center">No valid data found in the processed file(s).</td></tr>';
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
                     // Converte data serial do Excel para data legível
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
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            });
            csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'processed_data.csv');
        a.click();
    }
});
