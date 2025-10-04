// api/update-appointment-showed-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_APPOINTMENTS } from './configs/sheets-config.js';

dotenv.config();

// --- INÍCIO: Bloco de Configuração e Autenticação ---
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
// --- FIM: Bloco de Configuração e Autenticação ---


// --- INÍCIO: Funções Auxiliares ---
function parseToNumeric(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const cleanedValue = String(value).replace(/[R$$,]/g, '').trim();
    const parsed = parseFloat(cleanedValue);
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
// --- FIM: Funções Auxiliares ---


export default async function handler(req, res) {
    console.log("=============================================");
    console.log("====== INICIANDO PROCESSO DE ATUALIZAÇÃO =====");
    console.log("=============================================");

    if (req.method !== 'POST') {
        console.error('[LOG-ERROR] Método HTTP não permitido:', req.method);
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate } = req.body;
        
        // LOG 1: Dados brutos recebidos do frontend
        console.log('[LOG 1] Dados recebidos do frontend:', JSON.stringify(req.body, null, 2));

        if (rowIndex === undefined || rowIndex < 2) { 
            console.error(`[LOG-ERROR] RowIndex inválido recebido: ${rowIndex}`);
            return res.status(400).json({ success: false, message: `O índice da linha é inválido: ${rowIndex}` });
        }
        
        // LOG 2: Conversão e Cálculo de Valores
        const serviceValue = parseToNumeric(serviceShowed);
        const tipsValue = parseToNumeric(tips);
        const petShowedValue = parseToNumeric(petShowed);
        const percentageValueRaw = ensurePercentageString(percentage);
        const percentageValue = parseToNumeric(percentageValueRaw) / 100;
        const toPayValue = (serviceValue * percentageValue) + tipsValue;

        console.log('[LOG 2] Valores numéricos calculados:', {
            serviceValue,
            tipsValue,
            petShowedValue,
            percentageValue,
            toPayValue
        });

        // LOG 3: Conectando com a Planilha
        console.log('[LOG 3] Conectando à planilha com ID:', SPREADSHEET_ID_APPOINTMENTS);
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

        if (!sheet) {
            console.error(`[LOG-ERROR] A planilha com o título "${SHEET_NAME_APPOINTMENTS}" não foi encontrada.`);
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        console.log(`[LOG 3.1] Planilha "${sheet.title}" encontrada com sucesso.`);

        // LOG 4: Buscando a linha para atualizar
        console.log(`[LOG 4] Buscando pela linha com rowIndex: ${rowIndex}`);
        const rows = await sheet.getRows();
        const targetRow = rows.find(row => row.rowNumber === rowIndex);

        if (!targetRow) {
            console.error(`[LOG-ERROR] A linha com rowIndex ${rowIndex} não foi encontrada na planilha.`);
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
        }
        console.log(`[LOG 4.1] Linha ${rowIndex} encontrada. Cliente:`, targetRow.get('Customers'));
        
        // LOG 5: Preparando para salvar os dados
        console.log('[LOG 5] Atualizando os valores na linha encontrada...');
        targetRow.set('Date (Appointment)', formatToSheetDate(appointmentDate));
        targetRow.set('Verification', verification);
        targetRow.set('Technician', technician);
        targetRow.set('Method', paymentMethod);
        targetRow.set('Percentage', percentageValueRaw);
        targetRow.set('Service Showed', serviceValue);
        targetRow.set('Tips', tipsValue);
        targetRow.set('Pet Showed', petShowedValue);
        targetRow.set('To Pay', toPayValue);
        
        console.log('[LOG 5.1] Dados prontos para serem salvos:', JSON.stringify({
            'Date (Appointment)': formatToSheetDate(appointmentDate),
            'Verification': verification,
            'Technician': technician,
            'Method': paymentMethod,
            'Percentage': percentageValueRaw,
            'Service Showed': serviceValue,
            'Tips': tipsValue,
            'Pet Showed': petShowedValue,
            'To Pay': toPayValue
        }, null, 2));

        // LOG 6: Salvando
        await targetRow.save();
        console.log(`[LOG 6] SUCESSO! Linha ${rowIndex} salva na planilha.`);
        
        return res.status(200).json({ success: true, message: 'Dados atualizados com sucesso!' });

    } catch (error) {
        // LOG 7: Tratamento de erro crítico
        console.error('[LOG 7 - ERRO CRÍTICO] Ocorreu uma exceção no processo:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Verifique os logs.' });
    }
}
