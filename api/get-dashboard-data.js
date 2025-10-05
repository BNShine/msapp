// api/get-dashboard-data.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToYYYYMMDD } from './utils.js';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_EMPLOYEES, SHEET_NAME_FRANCHISES, SHEET_NAME_TECHNICIANS } from './configs/sheets-config.js';

dotenv.config();

const getAuth = () => new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;
const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;

export default async function handler(req, res) {
    // --- INÍCIO DO LOG DE DEBUG ---
    console.log("==============================================");
    console.log("===== INICIANDO DEBUG: get-dashboard-data ====");
    console.log("==============================================");

    res.setHeader('Content-Type', 'application/json');

    let technicians = [];
    let appointments = [];
    let employees = [];
    let franchises = [];

    try {
        console.log(`[DEBUG] Verificando variáveis de ambiente...`);
        if (!process.env.CLIENT_EMAIL || !process.env.PRIVATE_KEY || !SPREADSHEET_ID_DATA) {
            console.error("[FATAL] Variáveis de ambiente essenciais (CLIENT_EMAIL, PRIVATE_KEY, SHEET_ID_DATA) não foram encontradas.");
            return res.status(500).json({ error: "Configuração do servidor incompleta." });
        }
        console.log(`[DEBUG] Variáveis de ambiente OK.`);

        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, getAuth());
        
        console.log(`[DEBUG] Carregando informações da planilha de DADOS (ID: ${SPREADSHEET_ID_DATA})...`);
        await docData.loadInfo();
        console.log(`[DEBUG] Planilha de DADOS carregada com sucesso. Título: "${docData.title}"`);

        const allSheetTitles = Object.keys(docData.sheetsByTitle);
        console.log(`[DEBUG] Abas encontradas nesta planilha: [${allSheetTitles.join(', ')}]`);

        // --- Busca de Técnicos ---
        const sheetTechnicians = docData.sheetsByTitle[SHEET_NAME_TECHNICIANS];
        
        if (sheetTechnicians) {
            console.log(`[DEBUG] Aba "${SHEET_NAME_TECHNICIANS}" encontrada.`);
            const rows = await sheetTechnicians.getRows();
            console.log(`[DEBUG] Encontradas ${rows.length} linhas na aba de técnicos.`);
            
            const headerValues = sheetTechnicians.headerValues;
            console.log(`[DEBUG] Cabeçalhos da aba de técnicos: [${headerValues.join(', ')}]`);

            const headerValue = headerValues.find(h => h.toLowerCase() === 'technician' || h.toLowerCase() === 'name');

            if (headerValue) {
                 console.log(`[DEBUG] Usando o cabeçalho "${headerValue}" para extrair os nomes.`);
                 rows.forEach((row, index) => {
                    const techName = row.get(headerValue);
                    if (techName) {
                        technicians.push(techName);
                    } else {
                        console.log(`[DEBUG] Linha ${index + 2} da planilha não possui um nome de técnico na coluna "${headerValue}".`);
                    }
                });
                console.log(`[SUCCESS] Extraídos ${technicians.length} técnicos.`);
            } else {
                 console.error(`[ERROR] Não foi possível encontrar uma coluna com o cabeçalho 'Technician' ou 'Name' na aba "${SHEET_NAME_TECHNICIANS}".`);
            }
        } else {
            console.error(`[ERROR] A aba com o nome "${SHEET_NAME_TECHNICIANS}" NÃO FOI ENCONTRADA na planilha.`);
        }
    } catch (error) {
        console.error('[FATAL] Ocorreu um erro crítico ao tentar buscar os dados dos técnicos:', error);
        // Mesmo com erro, continua para tentar buscar os outros dados e retorna o que conseguir
    }
    
    // As outras buscas (employees, franchises, etc.) foram omitidas para focar no problema principal
    // ...

    console.log("===== FIM DO DEBUG =====");
    res.status(200).json({ appointments, employees, technicians, franchises });
}
