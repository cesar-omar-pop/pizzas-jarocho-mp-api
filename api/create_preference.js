// api/create_preference.js (Versión CORREGIDA para SDK v2.x)

// 🚨 CAMBIO CRÍTICO: Inicializamos el SDK de MP con el token directamente
// No se usa .configure() en las versiones modernas
const mercadopago = require('mercadopago');

// Configuración de Mercado Pago
if (process.env.MP_ACCESS_TOKEN) {
    mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);
} 
// Dejamos que falle más adelante si no hay token (error 500)

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    // ------------------------------------------------------------------
    // 💥 CORS (Manejo de Preflight OPTIONS) 💥
    // ------------------------------------------------------------------
    if (req.method === 'OPTIONS') {
        // En un OPTIONS (preflight), respondemos 200 OK y terminamos
        // Las reglas de CORS en vercel.json ya deberían manejar los headers
        return res.status(200).end();
    }
    // ------------------------------------------------------------------
    
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido. Solo POST.');
    }
    
    // Si el token no está configurado (debería estarlo), devolvemos error.
    if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'Token de acceso de MP no configurado en Vercel.' });
    }
    // Si la configuración falla, se debe a que no se usó setAccessToken arriba
    // Esto lo borramos o comentamos:
    /*
    mercadopago.configure({
        access_token: process.env.MP_ACCESS_TOKEN 
    });
    */ 
    
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

        // USAMOS VERCEL_URL para el dominio si existe
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

        // NOTA: Con el SDK v2.x el objeto de preferencia es accesible a través de 'preferences'
        const result = await mercadopago.preferences.create(preference);
        
        return res.status(200).json({ 
            id: result.body.id,
            init_point: result.body.init_point 
        });

    } catch (error) {
        // Intentamos devolver un JSON de error 500
        console.error("Error al crear la preferencia de pago:", error.cause || error.message);
        return res.status(500).json({ 
            error: 'Error interno al crear la preferencia de pago.',
            detail: error.message || 'Error desconocido. Revisar logs de Vercel.'
        });
    }
};