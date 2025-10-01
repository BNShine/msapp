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
    // Remove R$, %, pontos (separador de milhar), e substitui a vírgula por ponto (separador decimal)
    const cleanedValue = value.replace(/R\$/, '').replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
    const parsed = parseFloat(cleanedValue);
    // Retorna 0 se for NaN, caso contrário retorna o valor
    return isNaN(parsed) ? 0 : parsed;
}

// Função auxiliar para converter YYYY-MM-DD (de input HTML) para YYYY/MM/DD (para consistência na planilha)
function formatToSheetDate(isoDate) {
    if (!isoDate) return '';
    return isoDate.replace(/-/g, '/');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate } = req.body;
        
        console.log('--- Início do Processo de Atualização (Versão Final) ---');
        console.log('Dados recebidos do frontend para atualização:', { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate });

        if (rowIndex === undefined || rowIndex < 0) {
            console.error('Validation Error: O índice da linha é inválido. Valor recebido:', rowIndex);
            return res.status(400).json({ success: false, message: 'O índice da linha é inválido.' });
        }
        
        // 1. Calculate 'To Pay'
        const serviceValue = parseToNumeric(serviceShowed);
        const percentageValue = parseToNumeric(percentage) / 100;
        const tipsValue = parseToNumeric(tips);

        let commissionValue = 0;
        if (serviceValue > 0 && percentageValue > 0) {
            commissionValue = serviceValue * percentageValue;
        }
        
        // NOVO CÁLCULO: To Pay = Comissão (Service * Percentage) + Tips
        let toPayValue = commissionValue + tipsValue;

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

        if (!sheet) {
            console.error(`Spreadsheet Error: Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        
        await sheet.loadHeaderRow();

        await sheet.loadCells(`A${rowIndex}:Z${rowIndex}`);
        
        // Mapeamento dos nomes de cabeçalho para os índices de coluna.
        const headerRow = sheet.headerValues;
        const headersToIndex = {};
        headerRow.forEach((header, index) => {
            headersToIndex[header] = index;
        });

        const getCell = (header) => {
             const colIndex = headersToIndex[header];
             if (colIndex === undefined) {
                 console.warn(`Header not found: ${header}. This field will not be updated.`);
                 return null;
             }
             return sheet.getCell(rowIndex - 1, colIndex);
        }

        // Obtém e atualiza as células.
        const appointmentDateCell = getCell('Date (Appointment)');
        const technicianCell = getCell('Technician');
        const petShowedCell = getCell('Pet Showed');
        const serviceShowedCell = getCell('Service Showed');
        const tipsCell = getCell('Tips');
        const percentageCell = getCell('Percentage');
        const toPayCell = getCell('To Pay');
        const methodCell = getCell('Method');
        const verificationCell = getCell('Verification');

        if (appointmentDateCell) appointmentDateCell.value = formatToSheetDate(appointmentDate);
        if (technicianCell) technicianCell.value = technician;
        if (petShowedCell) petShowedCell.value = petShowed;
        if (serviceShowedCell) serviceShowedCell.value = serviceShowed;
        if (tipsCell) tipsCell.value = tips;
        if (percentageCell) percentageCell.value = percentage;
        if (methodCell) methodCell.value = paymentMethod;
        if (verificationCell) verificationCell.value = verification;
        
        // Salva o resultado do cálculo na coluna 'To Pay'
        if (toPayCell) toPayCell.value = toPayValue.toFixed(2);


        // Salva todas as células atualizadas em uma única requisição.
        await sheet.saveUpdatedCells();

        console.log('Dados atualizados com sucesso na planilha para o índice:', rowIndex);
        console.log(`Valor de 'To Pay' calculado e salvo: ${toPayValue.toFixed(2)}`);
        console.log('--- Fim do Processo de Atualização (Versão Final) ---');
        return res.status(200).json({ success: true, message: 'Dados e cálculo de "To Pay" atualizados com sucesso!' });
    } catch (error) {
        console.error('Erro geral ao atualizar agendamento:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
