// api/save-tech-coverage.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_TECH_COVERAGE } from './configs/sheets-config.js';

dotenv.config();

// Permissão de leitura e escrita é NECESSÁRIA
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], 
});

const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const updatedTechs = req.body; // Array de objetos JSON do frontend

        if (!updatedTechs || !Array.isArray(updatedTechs)) {
            return res.status(400).json({ success: false, message: 'Invalid data format provided.' });
        }
        
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        
        if (!sheet) {
            return res.status(500).json({ success: false, message: `Sheet "${SHEET_NAME_TECH_COVERAGE}" not found. Cannot save.` });
        }

        // 1. Mapeia os dados do frontend para o formato de colunas da planilha
        const rowsToSave = updatedTechs.map(tech => ({
            Name: tech.nome || '', // Nome
            Category: tech.categoria || '', // Categoria
            Restrictions: tech.tipo_atendimento || '', // Restrições
            OriginZipCode: tech.zip_code || '', // Zip Code
            Cities: JSON.stringify(tech.cidades || []), // CONVERTE O ARRAY DE CIDADES PARA JSON STRING
        }));

        // 2. Limpa todas as linhas existentes (método mais simples para sobrescrever tudo)
        await sheet.clearRows();

        // 3. Adiciona os novos cabeçalhos (para garantir)
        await sheet.setHeaderRow(['Name', 'Category', 'Restrictions', 'OriginZipCode', 'Cities']);


        // 4. Adiciona as novas linhas
        if (rowsToSave.length > 0) {
            await sheet.addRows(rowsToSave);
        }

        return res.status(200).json({ success: true, message: 'Technician coverage data saved to Google Sheets successfully.' });

    } catch (error) {
        console.error('Error saving tech coverage data to Sheets:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error during data saving.' });
    }
}
