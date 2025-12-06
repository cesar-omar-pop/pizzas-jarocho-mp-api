// api/create_preference.js (Versión CORREGIDA con Inicialización de Cliente V2)

// 💥 FIX CRÍTICO #1: Importar MercadoPagoConfig y Preference para el cliente
const { MercadoPagoConfig, Preference } = require('mercadopago'); 

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    // ------------------------------------------------------------------
    // CORS - Mantenemos esta sección que resolvió el error anterior
    // ------------------------------------------------------------------
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido. Solo POST.');
    }
    
    // 1. Configuración de Mercado Pago: Usamos el método de Cliente
    if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'Token de acceso de MP no configurado en Vercel.' });
    }
    
    // 💥 FIX CRÍTICO #2: Creación de la instancia del Cliente
    const client = new MercadoPagoConfig({ 
        accessToken: process.env.MP_ACCESS_TOKEN 
    });
    
    // Instancia del servicio de Preferencias usando el cliente
    const preferenceService = new Preference(client);

    try {
        const { items, orderId } = req.body; 
        
        if (!items || items.length === 0 || !orderId) {
            return res.status(400).json({ error: 'Faltan datos (items o orderId) para crear la preferencia.' });
        }

        // Mapeo de items
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: parseFloat(item.price) || 0, 
            quantity: parseInt(item.cantidad) || 1, 
            currency_id: 'MXN' 
        }));

        const VERCEL_DOMAIN = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : "http://localhost:80/Pizzas%20Jarocho"; 

        const preference = {
            items: mpItems,
            external_reference: orderId, 
            back_urls: {
                success: `${VERCEL_DOMAIN}/notifications.html?payment=success&orderId=${orderId}`, 
                failure: `${VERCEL_DOMAIN}/cart.html?payment=failure`,
                pending: `${VERCEL_DOMAIN}/cart.html?payment=pending`,
            },
            notification_url: `${VERCEL_DOMAIN}/api/mp_webhook?source_topic=merchant_order`, 
            auto_return: "approved"
        };

        // 💥 FIX CRÍTICO #3: Usamos el servicio de preferencias instanciado
        const result = await preferenceService.create({ body: preference }); 
        
        return res.status(200).json({ 
            id: result.body.id,
            init_point: result.body.init_point 
        });

    } catch (error) {
        // Devolvemos el error detallado para ayudar en la depuración
        console.error("Error al crear la preferencia de pago (MP):", error.cause || error.message);
        return res.status(500).json({ 
            error: 'Error interno al crear la preferencia de pago.',
            detail: error.message || 'Error desconocido. Revisar logs de Vercel.'
        });
    }
};