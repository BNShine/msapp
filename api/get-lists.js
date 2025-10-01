import { dynamicLists } from './utils.js';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        return res.status(200).json(dynamicLists);
    } catch (error) {
        console.error('Erro ao buscar listas dinâmicas:', error);
        res.status(500).json({ error: 'Falha ao buscar dados.' });
    }
}
