import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_TECH_COVERAGE } from './configs/sheets-config.js';

dotenv.config();

// Permissão de leitura é suficiente
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA; 

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        
        if (!sheet) {
            return res.status(500).json({ error: `Sheet "${SHEET_NAME_TECH_COVERAGE}" not found.` });
        }

        const rows = await sheet.getRows();

        const techCoverageData = rows.map(row => {
            // Os nomes das propriedades devem bater com os cabeçalhos da planilha (em inglês)
            return {
                nome: row.Name,
                categoria: row.Category,
                tipo_atendimento: row.Restrictions,
                zip_code: row.OriginZipCode,
                // CONVERTE A STRING JSON DA CÉLULA DE VOLTA PARA ARRAY
                cidades: JSON.parse(row.Cities || '[]'),
            };
        }).filter(t => t.nome);

        return res.status(200).json(techCoverageData);

    } catch (error) {
        console.error('Error fetching tech coverage data from Sheets:', error);
        res.status(500).json({ error: 'Failed to fetch technician coverage data.' });
    }
}
