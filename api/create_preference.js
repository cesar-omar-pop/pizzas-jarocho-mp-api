// api/create_preference.js

const mercadopago = require('mercadopago');

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    // Si req.method es OPTIONS, Vercel ya lo maneja con vercel.json, 
    // pero mantenemos el check POST para seguridad.
    if (req.method !== 'POST') {
        // Devolvemos 405 Method Not Allowed si no es POST
        return res.status(405).send('Método no permitido. Solo POST.');
    }
    
    // Configurar Mercado Pago usando la variable de entorno de Vercel
    if (!process.env.MP_ACCESS_TOKEN) {
        // En un error de token, devolvemos un error interno
        return res.status(500).json({ error: 'Token de acceso de MP no configurado.' });
    }
    mercadopago.configure({
        access_token: process.env.MP_ACCESS_TOKEN 
    });

    try {
        const { items, orderId } = req.body; // Recibimos el carrito y el ID de Firestore
        
        if (!items || items.length === 0 || !orderId) {
            return res.status(400).json({ error: 'Faltan datos (items o orderId) para crear la preferencia.' });
        }

        // --- CORRECCIÓN CRÍTICA ---
        // Usamos item.cantidad en lugar de item.quantity, pues es lo que envía el frontend.
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: parseFloat(item.price) || 0, // Aseguramos que sea número
            quantity: parseInt(item.cantidad) || 1, // <--- USAR item.cantidad
            currency_id: 'MXN' 
        }));

        // Verificación de ítems válidos (todos deben tener precio y cantidad > 0)
        if (mpItems.some(item => item.unit_price <= 0 || item.quantity <= 0)) {
            return res.status(400).json({ error: 'Todos los ítems deben tener precio y cantidad positiva.' });
        }
        
        // NOTA: Para probar localmente (XAMPP), debes usar las URL de tu entorno
        const DOMAIN = "http://localhost/Pizzas%20Jarocho"; // Cambia esto si tienes un dominio real

        const preference = {
            items: mpItems,
            external_reference: orderId, 
            back_urls: {
                success: `${DOMAIN}/notifications.html?payment=success&orderId=${orderId}`, 
                failure: `${DOMAIN}/cart.html?payment=failure`,
                pending: `${DOMAIN}/cart.html?payment=pending`,
            },
            notification_url: `${DOMAIN}/api/mp_webhook?source_topic=merchant_order`, 
            auto_return: "approved"
        };

        const result = await mercadopago.preferences.create(preference);
        
        // Devolver la URL de redirección
        return res.status(200).json({ 
            id: result.body.id,
            init_point: result.body.init_point // La URL de pago de MP
        });

    } catch (error) {
        console.error("Error al crear la preferencia de pago:", error);
        // Devolvemos un error 500 para el frontend si la llamada a MP falla
        return res.status(500).json({ error: 'Error interno al crear la preferencia de pago. (Revisar logs de Vercel)' });
    }
};