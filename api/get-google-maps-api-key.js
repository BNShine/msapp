import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            console.error('Environment variable GOOGLE_MAPS_API_KEY is not set.');
            return res.status(500).json({ error: 'Chave da API do Google Maps não encontrada.' });
        }

        return res.status(200).json({ apiKey });

    } catch (error) {
        console.error('Erro ao buscar a chave da API do Google Maps:', error);
        res.status(500).json({ error: 'Falha ao buscar a chave da API.' });
    }
}
