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
            
            const citiesRaw = row.cities || '[]'; // Corrigido para minúsculas: row.cities
            let parsedCities = [];
            
            try {
                parsedCities = JSON.parse(citiesRaw);
            } catch (e) {
                console.error(`[ERROR LOG] Falha ao converter Cities para JSON para o técnico: ${row.name || 'Sem Nome'} (Zip: ${row.originzipcode || 'N/A'}). Raw Cities: ${citiesRaw}`, e); // Logs atualizados
                parsedCities = [];
            }
            
            // ATENÇÃO: As propriedades Name, Category, Restrictions e OriginZipCode 
            // DEVEM ser acessadas em minúsculas ou no formato camelCase (se tiver espaços)
            return {
                nome: row.name, // CORRIGIDO: de row.Name para row.name
                categoria: row.category, // CORRIGIDO: de row.Category para row.category
                tipo_atendimento: row.restrictions, // CORRIGIDO: de row.Restrictions para row.restrictions
                zip_code: row.originzipcode, // CORRIGIDO: de row.OriginZipCode para row.originzipcode
                cidades: parsedCities,
            };
        }).filter(t => t.nome);

        // ... Logs de debug removidos para o código final, mas o filtro agora deve funcionar: filter(t => t.nome)

        return res.status(200).json(techCoverageData);

    } catch (error) {
        console.error('Error fetching tech coverage data from Sheets:', error);
        res.status(500).json({ error: 'Failed to fetch technician coverage data.' });
    }
}
