import PDFDocument from 'pdfkit';

// Helper to format currency (Replicated from frontend for consistency)
function formatCurrency(value) {
    if (typeof value !== 'number') {
        value = parseFloat(value);
    }
    if (isNaN(value)) return '$0.00';
    return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // Recebe o array de dados processados do frontend
        const payrollData = req.body;
        
        if (!payrollData || !Array.isArray(payrollData) || payrollData.length === 0) {
            return res.status(400).json({ success: false, message: 'No payroll data provided for PDF generation.' });
        }

        // Configuração do PDF em layout paisagem (landscape) para caber as 10 colunas
        const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
        const filename = 'Technician_Payroll_Summary_' + new Date().toISOString().slice(0, 10) + '.pdf';

        // 1. Configura os cabeçalhos para forçar o download do arquivo
        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
        res.setHeader('Content-type', 'application/pdf');

        // 2. Redireciona o stream do PDF para a resposta HTTP
        doc.pipe(res);

        // --- Geração do Conteúdo do PDF (Estrutura da Tabela) ---
        
        doc.fontSize(16).font('Helvetica-Bold').text('Technician Payroll Summary', { align: 'center' });
        doc.moveDown();

        const tableTop = doc.y;
        const colCount = 10;
        const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const columnWidth = availableWidth / colCount;
        let currentY = tableTop;

        // Cabeçalhos
        const headers = [
            'Technician', 'Pets', 'Appts', 'Produced ($)', 'Comm (%)', 
            'Base Pay ($)', 'Fixed Pay ($)', 'Variables ($)', 'Final Pay ($)', 'Support ($)'
        ];
        
        doc.fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, doc.page.margins.left + i * columnWidth, tableTop, { 
                width: columnWidth, align: 'center', height: 20, lineBreak: false 
            });
        });
        currentY += 20;
        // Linha separadora do cabeçalho
        doc.lineWidth(1).moveTo(doc.page.margins.left, currentY).lineTo(doc.page.width - doc.page.margins.right, currentY).stroke('#000'); 
        
        // Linhas de Dados
        doc.fontSize(7).font('Helvetica');
        
        payrollData.forEach((row, rowIndex) => {
            currentY += 5; // Espaço antes de cada linha

            // Adiciona nova página se necessário
            if (currentY + 15 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage({ layout: 'landscape' });
                currentY = doc.y;
                
                // Repete cabeçalhos na nova página
                doc.fontSize(8).font('Helvetica-Bold');
                headers.forEach((header, i) => {
                    doc.text(header, doc.page.margins.left + i * columnWidth, currentY, { 
                        width: columnWidth, align: 'center', height: 15, lineBreak: false 
                    });
                });
                currentY += 15;
                doc.lineWidth(1).moveTo(doc.page.margins.left, currentY).lineTo(doc.page.width - doc.page.margins.right, currentY).stroke('#000');
                doc.fontSize(7).font('Helvetica');
                currentY += 5; 
            }

            const dataRow = [
                row.technician.length > 15 ? row.technician.substring(0, 13) + '...' : row.technician,
                String(row.totalPets),
                String(row.totalAppointments),
                formatCurrency(row.producedValue),
                row.commissionRate,
                formatCurrency(row.basePay),
                row.fixedPay === 'Select' || row.fixedPay === '' ? '-' : formatCurrency(row.fixedPay),
                formatCurrency(row.customVars),
                formatCurrency(row.finalPay),
                formatCurrency(row.supportValue)
            ];
            
            const isTotalRow = row.technician === 'TOTAL';

            // Define a cor de fundo para a linha TOTAL
            if (isTotalRow) {
                doc.fillColor('#f0f0f0').rect(doc.page.margins.left, currentY - 2, availableWidth, 12).fill();
                doc.fillColor('#000000');
                doc.font('Helvetica-Bold');
            }


            dataRow.forEach((cell, i) => {
                const align = (i >= 3 && i !== 4 && i !== 6) ? 'right' : (i === 0 ? 'left' : 'center'); 
                
                // Formatação específica para Final Pay (Bold)
                if (i === 8 && !isTotalRow) {
                     doc.font('Helvetica-Bold');
                }
                
                doc.text(cell, doc.page.margins.left + i * columnWidth, currentY, { 
                    width: columnWidth, align: align, height: 12, lineBreak: false 
                });

                // Volta para fonte normal
                if (i === 8 && !isTotalRow) {
                    doc.font('Helvetica');
                }
            });
            currentY += 12;

            // Retorna à fonte normal após a linha total
            if (isTotalRow) {
                doc.font('Helvetica');
            }
        });
        
        // 3. Finaliza a escrita e envia a resposta
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error during PDF generation.' });
    }
}
