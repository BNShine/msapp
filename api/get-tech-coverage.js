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
        
        // --- LOG 1: INSPECIONA DADOS BRUTOS E CABEÇALHOS ESPERADOS ---
        console.log(`[DEBUG LOG] Linhas brutas encontradas: ${rows.length}`);
        if (rows.length > 0) {
            // Este log mostrará os valores da linha de cabeçalho (se estiver na primeira linha)
            // ou os dados brutos da primeira linha lida, útil para verificar se as colunas estão sendo lidas corretamente.
            const headerValues = sheet.headerValues || ['N/A'];
            console.log(`[DEBUG LOG] Cabeçalhos lidos pela biblioteca:`, headerValues);
            console.log(`[DEBUG LOG] Dados da primeira linha lida (indice 0):`, rows[0]._rawData);
        }
        // -----------------------------------------------------------

        const techCoverageData = rows.map(row => {
            
            const citiesRaw = row.Cities || '[]';
            let parsedCities = [];
            
            // Tenta fazer o parse do JSON
            try {
                parsedCities = JSON.parse(citiesRaw);
            } catch (e) {
                // --- LOG 2: ERRO NO PARSE JSON (PROVAVELMENTE A CAUSA DO SEU PROBLEMA) ---
                console.error(`[ERROR LOG] Falha ao converter Cities para JSON para o técnico: ${row.Name || 'Sem Nome'} (Zip: ${row.OriginZipCode || 'N/A'}). Raw Cities: ${citiesRaw}`, e);
                // --------------------------------------------------------------------------
                parsedCities = [];
            }
            
            // Os nomes das propriedades devem bater com os cabeçalhos da planilha (em inglês)
            return {
                nome: row.Name,
                categoria: row.Category,
                tipo_atendimento: row.Restrictions,
                zip_code: row.OriginZipCode,
                // CONVERTE A STRING JSON DA CÉLULA DE VOLTA PARA ARRAY
                cidades: parsedCities,
            };
        }).filter(t => t.nome);
        
        // --- LOG 3: VERIFICA O RESULTADO FINAL ---
        console.log(`[DEBUG LOG] Total de técnicos mapeados e filtrados: ${techCoverageData.length}`);
        if (techCoverageData.length > 0) {
             console.log(`[DEBUG LOG] Primeiro técnico mapeado (Resultado final):`, techCoverageData[0]);
        }
        // -----------------------------------------

        return res.status(200).json(techCoverageData);

    } catch (error) {
        console.error('Error fetching tech coverage data from Sheets:', error);
        res.status(500).json({ error: 'Failed to fetch technician coverage data.' });
    }
}
