// ... (código existente até o final)
    
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
        alert(`PDF Export Error: ${error.message}. Please check your browser console for details.`);
        console.error('PDF Export Error:', error);
    }
});

    initPage();
});
