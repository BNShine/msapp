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
    // Remove R$, %, espaços, e substitui vírgula por ponto (para formatos brasileiros)
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
        
        console.log('--- Início do Processo de Atualização (Versão Final Reforçada - REVERTIDO) ---');
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
        
        // 2. Carrega todas as linhas e encontra a linha alvo por 'rowNumber' (MÉTODO ROBUSTO)
        const rows = await sheet.getRows();
        
        const targetRow = rows.find(row => row.rowNumber === rowIndex);

        if (!targetRow) {
            console.error(`Row Not Found Error: A linha com rowIndex ${rowIndex} não foi encontrada.`);
             return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
        }
        
        // 3. Atualiza as propriedades do objeto da linha (usando nomes de cabeçalho)
        // ESSAS TRÊS ATUALIZAÇÕES ERAM O FOCO (Requisito anterior)
        targetRow['Date (Appointment)'] = formatToSheetDate(appointmentDate);
        targetRow['Verification'] = verification;
        targetRow['Service Showed'] = ensureNumericString(serviceShowed);
        
        // ATUALIZAÇÃO DE TODOS OS CAMPOS DE DADOS DO MODAL (Para evitar conflitos de salvamento)
        targetRow['Technician'] = technician;
        targetRow['Pet Showed'] = ensureNumericString(petShowed);
        targetRow['Tips'] = ensureNumericString(tips);
        targetRow['Percentage'] = percentageValueRaw;
        targetRow['Method'] = paymentMethod;
        
        // Campo calculado:
        targetRow['To Pay'] = toPayValue.toFixed(2);
        
        // 4. Salva a linha atualizada (Utilizando o método row.save() mais seguro)
        await targetRow.save();

        console.log('Dados atualizados com sucesso na planilha para o índice:', rowIndex);
        console.log(`Valor de 'To Pay' calculado e salvo: ${toPayValue.toFixed(2)}`);
        console.log('--- Fim do Processo de Atualização (Versão Final Reforçada - REVERTIDO) ---');
        
        // Retorna sucesso para o frontend recarregar.
        return res.status(200).json({ success: true, message: 'Dados e cálculo de "To Pay" atualizados com sucesso!' });
    } catch (error) {
        // Se este bloco for alcançado, significa que houve um erro real na API.
        console.error('ERRO CRÍTICO ao atualizar agendamento no Sheets. Stack Trace:', error.stack);
        
        // Retornamos 500 para garantir que o Vercel registre a falha.
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
