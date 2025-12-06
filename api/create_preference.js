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
    
    // ... Código anterior (CORS, POST check, Inicialización de Cliente MP) ...

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

        const result = await preferenceService.create({ body: preference }); 
        
        // El resultado es exitoso, devolvemos los datos
        return res.status(200).json({ 
            id: result.id, // 🚨 FIX CRÍTICO: El SDK V2 devuelve 'id' directamente en 'result'
            init_point: result.init_point 
        });

    } catch (error) {
        // 🚨 FIX CRÍTICO: Capturamos el error de Mercado Pago y devolvemos su mensaje
        console.error("Error al crear la preferencia de pago (MP):", error);
        
        let errorMessage = 'Error desconocido al procesar el pago.';
        if (error.status && error.message) {
             // Si el error viene de Mercado Pago (ej: 401 Unauthorized), usamos su mensaje
            errorMessage = `MP Error ${error.status}: ${error.message}`;
            return res.status(error.status).json({
                error: 'Error de la API de Mercado Pago',
                detail: errorMessage
            });
        }
        
        // Fallback para otros errores internos
        return res.status(500).json({ 
            error: 'Error interno del servidor.',
            detail: error.message || errorMessage 
        });
    }
};