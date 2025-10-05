// api/get-technicians.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_TECHNICIANS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    
    try {
        if (!SPREADSHEET_ID_DATA) {
            throw new Error("A variável de ambiente SPREADSHEET_ID_DATA não está definida.");
        }

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByTitle[SHEET_NAME_TECHNICIANS];
        if (!sheet) {
            console.error(`[API ERROR] A aba "${SHEET_NAME_TECHNICIANS}" não foi encontrada.`);
            return res.status(200).json([]); // Retorna array vazio se a aba não existe
        }

        const rows = await sheet.getRows();
        const headerValue = sheet.headerValues.find(h => h.toLowerCase() === 'technician' || h.toLowerCase() === 'name');

        if (!headerValue) {
            console.error(`[API ERROR] Nenhum cabeçalho 'Technician' ou 'Name' encontrado na aba "${SHEET_NAME_TECHNICIANS}".`);
            return res.status(200).json([]);
        }

        const technicians = rows
            .map(row => row.get(headerValue))
            .filter(Boolean); // Filtra quaisquer nomes vazios ou nulos

        console.log(`[API LOG /get-technicians] Sucesso: ${technicians.length} técnicos encontrados.`);
        return res.status(200).json(technicians);

    } catch (error) {
        console.error('[API FATAL /get-technicians] Falha ao buscar técnicos:', error);
        // Retorna um erro 500 para que o frontend possa exibir a mensagem "Error loading!"
        return res.status(500).json({ error: 'Falha ao conectar com a planilha de técnicos.' });
    }
}
