// api/update-appointment-showed-data.js

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

// Função auxiliar para limpar e analisar strings para um número puro (float ou int)
function parseToNumeric(value) {
    // Retorna 0 se o valor for nulo, indefinido ou uma string vazia.
    if (value === null || value === undefined || value === '') return 0;
    // Se já for um número, retorna ele mesmo.
    if (typeof value === 'number') return value;
    // Remove símbolos de moeda (R$ ou $), vírgulas de milhares e espaços.
    const cleanedValue = String(value).replace(/[R$$,]/g, '').trim();
    // Converte para float.
    const parsed = parseFloat(cleanedValue);
    // Retorna o número ou 0 se a conversão falhar.
    return isNaN(parsed) ? 0 : parsed;
}

function formatToSheetDate(isoDate) {
    if (!isoDate) return '';
    return isoDate.replace('T', ' ').replace(/-/g, '/');
}

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

        if (rowIndex === undefined || rowIndex < 2) { 
            return res.status(400).json({ success: false, message: `O índice da linha é inválido: ${rowIndex}` });
        }
        
        // Converte os valores para NÚMEROS antes de qualquer cálculo ou salvamento.
        const serviceValue = parseToNumeric(serviceShowed);
        const tipsValue = parseToNumeric(tips);
        const petShowedValue = parseToNumeric(petShowed);
        
        const percentageValueRaw = ensurePercentageString(percentage);
        const percentageValue = parseToNumeric(percentageValueRaw) / 100;
        const toPayValue = (serviceValue * percentageValue) + tipsValue;

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        
        const rows = await sheet.getRows();
        const targetRow = rows.find(row => row.rowNumber === rowIndex);

        if (!targetRow) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
        }
        
        // Define os valores na linha. A biblioteca enviará os tipos corretos (número, string) para a planilha.
        targetRow.set('Date (Appointment)', formatToSheetDate(appointmentDate));
        targetRow.set('Verification', verification);
        targetRow.set('Technician', technician);
        targetRow.set('Method', paymentMethod);
        targetRow.set('Percentage', percentageValueRaw);
        targetRow.set('Service Showed', serviceValue); // Salvo como número
        targetRow.set('Tips', tipsValue); // Salvo como número
        targetRow.set('Pet Showed', petShowedValue); // Salvo como número
        targetRow.set('To Pay', toPayValue);
        
        await targetRow.save();
        
        return res.status(200).json({ success: true, message: 'Dados atualizados com sucesso!' });

    } catch (error) {
        console.error('[ERRO CRÍTICO] Falha ao atualizar planilha:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Verifique os logs.' });
    }
}

