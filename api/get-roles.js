import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_ROLES } from './configs/sheets-config.js';

dotenv.config();

// Configuração da autenticação com as chaves do ambiente
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Acessa a planilha usando o ID da variável de ambiente
const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);

export default async function handler(req, res) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_ROLES];
        if (!sheet) {
            // Retorna um erro se a aba 'Roles' não for encontrada
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_ROLES}" não encontrada.` });
        }
        
        // Carrega as células da coluna A, ignorando o cabeçalho
        await sheet.loadCells('A1:A' + sheet.rowCount);
        const rows = [];
        for (let i = 1; i < sheet.rowCount; i++) {
            const cell = sheet.getCell(i, 0);
            if (cell.value) {
                rows.push(cell.value);
            }
        }
        
        // Retorna a lista de roles
        return res.status(200).json(rows);

    } catch (error) {
        console.error('Erro ao buscar dados das Roles:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
