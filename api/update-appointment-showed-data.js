// alansalviano/myshineapp/myshineapp-db2432304fc990c3e93b2326d7faa293e6a13b38/api/update-appointment-showed-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_APPOINTMENTS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;

// Função auxiliar para limpar e analisar strings monetárias/percentuais para um número
function parseToNumeric(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }
    const cleanedValue = value.replace(/R\$/, '').replace(/%/g, '').replace(/[.]/g, '').replace(/,/g, '.').trim();
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed;
}

// Função auxiliar para converter YYYY-MM-DDTHH:MM para YYYY/MM/DD HH:MM
function formatToSheetDate(isoDate) {
    if (!isoDate) return '';
    return isoDate.replace('T', ' ').replace(/-/g, '/');
}

// Helper para garantir que valores numéricos/de quantidade vazios sejam salvos como '0'
const ensureNumericString = (value) => {
    if (value === '' || value === undefined || value === null) return '0';
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    return cleaned === '' ? '0' : cleaned;
};

// Helper para garantir que o valor de porcentagem vazio seja salvo como '0%'
const ensurePercentageString = (value) => {
    if (value === '' || value === undefined || value === null || String(value).toLowerCase() === 'select') return '0%';
    const stringValue = String(value);
    if (!stringValue.includes('%')) return `${stringValue}%`;
    return stringValue;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate } = req.body;
        
        console.log('--- Início do Processo de Atualização (Versão Final Reforçada) ---');
        console.log('Dados recebidos do frontend para atualização:', { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate });

        if (rowIndex === undefined || rowIndex < 2) { 
            console.error('Validation Error: O índice da linha é inválido. Valor recebido:', rowIndex);
            return res.status(400).json({ success: false, message: 'O índice da linha é inválido.' });
        }
        
        // 1. Calculate 'To Pay'
        const serviceValue = parseToNumeric(serviceShowed); 
        const percentageValueRaw = ensurePercentageString(percentage);
        const percentageValue = parseToNumeric(percentageValueRaw) / 100;
        const tipsValue = parseToNumeric(tips);
        
        let commissionValue = 0;
        if (serviceValue > 0 && percentageValue > 0) {
            commissionValue = serviceValue * percentageValue;
        }
        
        let toPayValue = commissionValue + tipsValue;

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

        if (!sheet) {
            console.error(`Spreadsheet Error: Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        
        // 2. Mapeamento de Cabeçalhos e Colunas (Mais Robusto)
        await sheet.loadHeaderRow();
        const headerMap = {};
        sheet.headerValues.forEach((header, index) => {
            headerMap[header] = index;
        });

        // Mapeia os dados de entrada para o nome da coluna no Sheets
        const colsToUpdate = {
            'Date (Appointment)': formatToSheetDate(appointmentDate),
            'Verification': verification,
            'Service Showed': ensureNumericString(serviceShowed),
            'Technician': technician,
            'Pet Showed': ensureNumericString(petShowed),
            'Tips': ensureNumericString(tips),
            'Percentage': percentageValueRaw, 
            'Method': paymentMethod,
            'To Pay': toPayValue.toFixed(2),
        };
        
        // 3. Carrega e atualiza as células diretamente (MÉTODO REFORÇADO)
        const rowNum = rowIndex; // Índice da linha baseado em 1

        // Carrega todas as células da linha específica para garantir a atualização em lote.
        const numCols = sheet.headerValues.length;
        const range = `A${rowNum}:${String.fromCharCode(65 + numCols - 1)}${rowNum}`;
        await sheet.loadCells(range); 
        
        let updateCount = 0;
        
        // Aplica os novos valores às células
        for (const header in colsToUpdate) {
            const colIndex = headerMap[header];
            if (colIndex !== undefined) {
                // sheet.getCell usa índice baseado em 0 para linha e coluna
                const cell = sheet.getCell(rowNum - 1, colIndex); 
                
                // LOG DE DEBUG DO SERVIDOR
                console.log(`[DEBUG UPDATE] Updating cell R${rowNum} C${colIndex + 1} (${header}): '${cell.value}' -> '${colsToUpdate[header]}'`);
                
                cell.value = colsToUpdate[header];
                updateCount++;
            } else {
                console.warn(`[DEBUG WARNING] Header '${header}' not found in sheet. Skipping update for this column.`);
            }
        }
        
        // 4. Salva todas as células modificadas de uma vez
        if (updateCount > 0) {
            await sheet.saveUpdatedCells();
            console.log(`[DEBUG SUCCESS] Total de ${updateCount} células atualizadas em lote.`);
        }

        console.log('Dados atualizados com sucesso na planilha para o índice:', rowIndex);
        console.log(`Valor de 'To Pay' calculado e salvo: ${toPayValue.toFixed(2)}`);
        console.log('--- Fim do Processo de Atualização (Versão Final Reforçada) ---');
        
        // Retorna sucesso para o frontend recarregar.
        return res.status(200).json({ success: true, message: 'Dados e cálculo de "To Pay" atualizados com sucesso!' });
    } catch (error) {
        console.error('ERRO CRÍTICO ao atualizar agendamento no Sheets. Stack Trace:', error.stack);
        
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
