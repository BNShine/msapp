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

// Função auxiliar para analisar strings monetárias/percentuais para um número
function parseToNumeric(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return value;
    }
    // Remove R$, %, espaços, e substitui vírgula por ponto
    const cleanedValue = String(value).replace(/R\$/, '').replace(/%/g, '').replace(/[.]/g, '').replace(/,/g, '.').trim();
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed;
}

// Função auxiliar para converter YYYY-MM-DDTHH:MM para YYYY/MM/DD HH:MM
function formatToSheetDate(isoDate) {
    if (!isoDate) return '';
    return isoDate.replace('T', ' ').replace(/-/g, '/');
}

// Helper para garantir que o valor de porcentagem tenha o formato de string correto
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
        
        console.log('[API LOG] Dados recebidos para atualização:', { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate });

        if (rowIndex === undefined || rowIndex < 2) { 
            console.error('[API ERROR] Índice da linha é inválido:', rowIndex);
            return res.status(400).json({ success: false, message: 'O índice da linha é inválido.' });
        }
        
        // 1. Converter e calcular valores numéricos PRIMEIRO
        const serviceValue = parseToNumeric(serviceShowed);
        const tipsValue = parseToNumeric(tips);
        const petShowedValue = parseToNumeric(petShowed);
        const percentageValueRaw = ensurePercentageString(percentage);
        const percentageValue = parseToNumeric(percentageValueRaw) / 100;
        
        let commissionValue = 0;
        if (serviceValue > 0 && percentageValue > 0) {
            commissionValue = serviceValue * percentageValue;
        }
        
        let toPayValue = commissionValue + tipsValue;

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

        if (!sheet) {
            console.error(`[API ERROR] Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        
        // 2. Carregar linhas e encontrar a linha alvo pelo 'rowNumber'
        await sheet.loadCells(); // Carrega todas as células para garantir a consistência
        const rows = await sheet.getRows();
        
        const targetRow = rows.find(row => row.rowNumber === rowIndex);

        if (!targetRow) {
            console.error(`[API ERROR] A linha com rowIndex ${rowIndex} não foi encontrada.`);
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
        }
        
        // 3. Atualizar as propriedades do objeto da linha com os TIPOS DE DADOS CORRETOS
        console.log(`[API LOG] Atualizando linha ${rowIndex}...`);

        // Campos de Texto (String)
        targetRow['Date (Appointment)'] = formatToSheetDate(appointmentDate);
        targetRow['Verification'] = verification;
        targetRow['Technician'] = technician;
        targetRow['Method'] = paymentMethod;
        targetRow['Percentage'] = percentageValueRaw; // Salva como string "25%"
        
        // --- CORREÇÃO: Usar NÚMEROS para colunas numéricas ---
        targetRow['Service Showed'] = serviceValue;
        targetRow['Tips'] = tipsValue;
        targetRow['Pet Showed'] = petShowedValue;
        targetRow['To Pay'] = toPayValue; // Salva o valor calculado como número
        
        // 4. Salvar a linha atualizada
        await targetRow.save();

        console.log(`[API LOG] Linha ${rowIndex} atualizada com sucesso na planilha.`);
        
        return res.status(200).json({ success: true, message: 'Dados e cálculo de "To Pay" atualizados com sucesso!' });

    } catch (error) {
        console.error('[API CRITICAL ERROR] Erro ao atualizar agendamento no Sheets:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
