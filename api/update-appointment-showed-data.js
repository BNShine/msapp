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
    // Remove R$, %, espaços, e substitui vírgula por ponto (caso frontend envie R$1,00)
    const cleanedValue = value.replace(/R\$/, '').replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed;
}

// Função auxiliar para converter YYYY-MM-DDTHH:MM (de input HTML type=datetime-local) para YYYY/MM/DD HH:MM (para consistência na planilha)
function formatToSheetDate(isoDate) {
    if (!isoDate) return '';
    return isoDate.replace('T', ' ').replace(/-/g, '/');
}

// Helper para garantir que valores numéricos/de quantidade vazios sejam salvos como '0'
const ensureNumericString = (value) => {
    if (value === '' || value === undefined || value === null) return '0';
    // Remove qualquer formatação de moeda ou vírgulas que possam ter sido injetadas pelo frontend
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    return cleaned === '' ? '0' : cleaned;
};

// Helper para garantir que o valor de porcentagem vazio seja salvo como '0%'
const ensurePercentageString = (value) => {
    if (value === '' || value === undefined || value === null || String(value).toLowerCase() === 'select') return '0%';
    const stringValue = String(value);
    // Se for um número puro (ex: '20' ou '25'), adiciona %
    if (!stringValue.includes('%')) return `${stringValue}%`;
    return stringValue;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate } = req.body;
        
        console.log('--- Início do Processo de Atualização (Versão Final) ---');
        console.log('Dados recebidos do frontend para atualização:', { rowIndex, technician, petShowed, serviceShowed, tips, percentage, paymentMethod, verification, appointmentDate });

        if (rowIndex === undefined || rowIndex < 2) { 
            console.error('Validation Error: O índice da linha é inválido. Valor recebido:', rowIndex);
            return res.status(400).json({ success: false, message: 'O índice da linha é inválido.' });
        }
        
        // 1. Calculate 'To Pay'
        const serviceValue = parseToNumeric(serviceShowed); 
        const percentageValueRaw = ensurePercentageString(percentage); // Garante '20%' ou '0%'
        const percentageValue = parseToNumeric(percentageValueRaw) / 100; // Converte '20%' -> 0.20
        const tipsValue = parseToNumeric(tips);

        // LOG DE DEBUG DO CÁLCULO
        console.log(`[DEBUG CALC] Service Value: ${serviceValue}, Percentage Raw: ${percentageValueRaw}, Percentage Decimal: ${percentageValue}, Tips: ${tipsValue}`);


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
        
        // 2. Carrega todas as linhas e encontra a linha alvo por 'rowNumber'
        // NOTA: Para aumentar a resiliência, vamos buscar as linhas mais frescas.
        const rows = await sheet.getRows();
        
        const targetRow = rows.find(row => row.rowNumber === rowIndex);

        if (!targetRow) {
            console.error(`Row Not Found Error: A linha com rowIndex ${rowIndex} não foi encontrada.`);
             return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
        }
        
        // 3. Atualiza as propriedades do objeto da linha (usando nomes de cabeçalho)
        targetRow['Date (Appointment)'] = formatToSheetDate(appointmentDate); // ATUALIZA DATA/HORA
        targetRow['Verification'] = verification; // ATUALIZA STATUS
        targetRow['Service Showed'] = ensureNumericString(serviceShowed); // ATUALIZA VALOR DO SERVIÇO
        
        // Campos que não deveriam ter mudado no modal, mas devem ser salvos de volta:
        targetRow['Technician'] = technician;
        targetRow['Pet Showed'] = ensureNumericString(petShowed);
        targetRow['Tips'] = ensureNumericString(tips);
        targetRow['Percentage'] = percentageValueRaw; // Salva o valor com % para uso futuro (se o campo estava vazio antes, pode ter sido salvo 0%)
        targetRow['Method'] = paymentMethod;
        
        // Campo calculado:
        targetRow['To Pay'] = toPayValue.toFixed(2);
        
        // 4. Salva a linha atualizada
        await targetRow.save();

        console.log('Dados atualizados com sucesso na planilha para o índice:', rowIndex);
        console.log(`Valor de 'To Pay' calculado e salvo: ${toPayValue.toFixed(2)}`);
        console.log('--- Fim do Processo de Atualização (Versão Final) ---');
        return res.status(200).json({ success: true, message: 'Dados e cálculo de "To Pay" atualizados com sucesso!' });
    } catch (error) {
        console.error('ERRO CRÍTICO ao atualizar agendamento no Sheets. Stack Trace:', error.stack);
        console.error('Objeto de Erro Completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
