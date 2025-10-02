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
        
        // --- LOG DE DEBUG REMOVIDO NO CÓDIGO FINAL ---

        const techCoverageData = rows.map(row => {
            
            // ACESSO DIRETO VIA ÍNDICE DO ARRAY _rawData
            const name = row._rawData[0]; 
            const category = row._rawData[1]; 
            const restrictions = row._rawData[2]; 
            const zipCode = row._rawData[3]; 
            const citiesRaw = row._rawData[4] || '[]'; // Cities é o 5º elemento (índice 4)
            
            let parsedCities = [];
            
            try {
                parsedCities = JSON.parse(citiesRaw);
                // Garantir que é um array, mesmo que vazio
                if (!Array.isArray(parsedCities)) {
                    parsedCities = [];
                }
            } catch (e) {
                // Manter o log de erro para strings JSON inválidas
                console.error(`[ERROR LOG] Falha ao converter Cities para JSON para o técnico: ${name || 'Sem Nome'} (Zip: ${zipCode || 'N/A'}). Raw Cities: ${citiesRaw}`, e); 
                parsedCities = [];
            }
            
            return {
                nome: name,
                categoria: category,
                tipo_atendimento: restrictions,
                zip_code: zipCode,
                cidades: parsedCities,
            };
        }).filter(t => t.nome); // O filtro agora usa 'name' (índice 0), que deve ser válido.

        // --- LOG DE DEBUG REMOVIDO NO CÓDIGO FINAL ---

        return res.status(200).json(techCoverageData);

    } catch (error) {
        console.error('Error fetching tech coverage data from Sheets:', error);
        res.status(500).json({ error: 'Failed to fetch technician coverage data.' });
    }
}
