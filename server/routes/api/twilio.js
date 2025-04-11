/* eslint-disable no-unused-vars */
/* 
Task
To apply the principle of least privilege to this code, we can refactor by limiting access to sensitive data (e.g., Twilio credentials) and restricting how the database and Twilio are used. Here's how:

1. Limit Environment Variable Exposure:
Only use the Twilio credentials when necessary and avoid storing them in variables accessible throughout the code.


2. Scoped Access:
Ensure only specific roles or users can send SMS through Twilio, instead of making this functionality available to all users.
*/
const express = require('express');
const { createClient } = require('../../db');
const router = express.Router();
const db = createClient();

// Middleware de autorização para verificar se o usuário tem permissão para usar o Twilio
const checkTwilioAccess = async (req, res, next) => {
  try {
    // Verifica se o usuário está autenticado
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Consulta o banco de dados para verificar o papel/permissão do usuário
    const userRole = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    // Lista de papéis permitidos a usar o serviço Twilio
    const allowedRoles = ['admin', 'notification_manager', 'sms_sender'];
    
    // Verifica se o usuário tem um papel permitido
    if (userRole.rows.length === 0 || !allowedRoles.includes(userRole.rows[0].role)) {
      return res.status(403).json({ 
        error: 'Acesso negado. Você não tem permissão para enviar SMS.' 
      });
    }
    
    // Registra o uso da API para audigtoria
    await db.query(
      'INSERT INTO api_access_logs (user_id, service, action, timestamp) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'twilio', 'send_sms', new Date()]
    );
    
    // Se tudo estiver ok, prossegue para o próximo middleware/handler
    next();
  } catch (error) {
    console.error('Erro de autorização:', error);
    res.status(500).json({ error: 'Falha na verificação de autorização' });
  }
};

// Função que cria e retorna um cliente Twilio apenas quando necessário
function getTwilioClient() {
  // Carrega as credenciais apenas quando a função é chamada
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  // Verifica se as credenciais existem
  if (!accountSid || !authToken) {
    throw new Error('As credenciais do Twilio não estão configuradas');
  }
  
  // Cria e retorna o cliente Twilio
  return require('twilio')(accountSid, authToken);
}

// Rota para enviar SMS com verificação de permissões
router.post('/send-sms', checkTwilioAccess, async (req, res) => {
  try {
    // As credenciais só são carregadas quando efetivamente precisamos enviar uma mensagem
    const twilioClient = getTwilioClient();
    
    const { to, body } = req.body;
    
    // Validação básica dos dados da mensagem
    if (!to || !body) {
      return res.status(400).json({ error: 'Destinatário e corpo da mensagem são obrigatórios' });
    }
    
    const message = await twilioClient.messages.create({
      body: body,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    // Registra o SMS enviado no banco de dados para auditoria
    await db.query(
      'INSERT INTO sms_logs (user_id, to_number, message_sid, sent_at) VALUES ($1, $2, $3, $4)',
      [req.user.id, to, message.sid, new Date()]
    );
    
    res.json({ success: true, messageSid: message.sid });
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    res.status(500).json({ error: 'Falha ao enviar mensagem' });
  }
});

module.exports = router;
