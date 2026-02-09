import { getDb } from '@/lib/db';
import type { Conversation } from '@/lib/types';

type ClientProfileData = {
  client: any;
  appointments: any[];
  conversations: Array<Conversation & { message_count: number }>;
};

type ClientStats = {
  total_spent: number;
  total_appointments: number;
  completed_appointments: number;
  no_show_count: number;
  no_show_rate: number;
  average_appointment_value: number;
  visit_frequency: number;
  last_appointment_date: string | null;
  first_appointment_date: string | null;
  preferred_services: Array<{
    id: number;
    name: string;
    count: number;
    total_spent: number;
  }>;
  total_conversations: number;
  last_conversation_date: string | null;
};

export async function getClientProfileData(clientId: number): Promise<ClientProfileData | null> {
  const db = getDb();

  const clientResult = await db.query(
    `SELECT * FROM clients WHERE id = $1`,
    [clientId]
  );

  if (clientResult.rows.length === 0) {
    return null;
  }

  const client = clientResult.rows[0];
  const parsedTags = typeof client.tags === 'string'
    ? JSON.parse(client.tags || '[]')
    : (client.tags || []);

  const appointmentsResult = await db.query(
    `SELECT a.*, s.name as service_name, s.price as service_price
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.id
     WHERE a.client_id = $1
     ORDER BY a.start_time DESC`,
    [clientId]
  );

  const conversationsResult = await db.query(
    `SELECT * FROM conversations
     WHERE client_id = $1
     ORDER BY updated_at DESC`,
    [clientId]
  );

  const conversationsWithCounts = await Promise.all(
    conversationsResult.rows.map(async (conv: Conversation) => {
      const messagesResult = await db.query(
        `SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1`,
        [conv.id]
      );
      return {
        ...conv,
        message_count: parseInt(messagesResult.rows[0]?.count || '0'),
      };
    })
  );

  return {
    client: {
      ...client,
      tags: parsedTags,
    },
    appointments: appointmentsResult.rows || [],
    conversations: conversationsWithCounts,
  };
}

export async function getClientStatsData(clientId: number): Promise<ClientStats | null> {
  const db = getDb();

  const clientResult = await db.query(
    `SELECT id FROM clients WHERE id = $1`,
    [clientId]
  );

  if (clientResult.rows.length === 0) {
    return null;
  }

  const spentResult = await db.query(
    `SELECT COALESCE(SUM(s.price), 0) as total
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.client_id = $1 AND a.status = 'completed'`,
    [clientId]
  );
  const totalSpent = parseFloat(spentResult.rows[0]?.total || '0');

  const countResult = await db.query(
    `SELECT COUNT(*) as count
     FROM appointments
     WHERE client_id = $1 AND status IN ('scheduled', 'completed')`,
    [clientId]
  );
  const totalAppointments = parseInt(countResult.rows[0]?.count || '0');

  const completedResult = await db.query(
    `SELECT COUNT(*) as count
     FROM appointments
     WHERE client_id = $1 AND status = 'completed'`,
    [clientId]
  );
  const completedAppointments = parseInt(completedResult.rows[0]?.count || '0');

  const noShowResult = await db.query(
    `SELECT COUNT(*) as count
     FROM appointments
     WHERE client_id = $1 AND status = 'no-show'`,
    [clientId]
  );
  const noShowCount = parseInt(noShowResult.rows[0]?.count || '0');

  const totalScheduled = completedAppointments + noShowCount;
  const noShowRate = totalScheduled > 0 ? (noShowCount / totalScheduled) * 100 : 0;

  const lastAppResult = await db.query(
    `SELECT MAX(start_time) as last_date
     FROM appointments
     WHERE client_id = $1 AND status IN ('scheduled', 'completed')`,
    [clientId]
  );
  const lastAppointmentDate = lastAppResult.rows[0]?.last_date || null;

  const firstAppResult = await db.query(
    `SELECT MIN(start_time) as first_date
     FROM appointments
     WHERE client_id = $1 AND status IN ('scheduled', 'completed')`,
    [clientId]
  );
  const firstAppointmentDate = firstAppResult.rows[0]?.first_date || null;

  let visitFrequency = 0;
  if (firstAppointmentDate && lastAppointmentDate) {
    const firstDate = new Date(firstAppointmentDate);
    const lastDate = new Date(lastAppointmentDate);
    const monthsDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsDiff > 0) {
      visitFrequency = totalAppointments / monthsDiff;
    } else if (totalAppointments > 0) {
      visitFrequency = totalAppointments;
    }
  }

  const preferredServicesResult = await db.query(
    `SELECT 
      s.id,
      s.name,
      COUNT(*) as count,
      SUM(s.price) as total_spent
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.client_id = $1 AND a.status = 'completed'
     GROUP BY s.id, s.name
     ORDER BY count DESC, total_spent DESC
     LIMIT 3`,
    [clientId]
  );

  const preferredServices = preferredServicesResult.rows.map((s: { id: number; name: string; count: string; total_spent: string | null }) => ({
    id: s.id,
    name: s.name,
    count: parseInt(s.count),
    total_spent: parseFloat(s.total_spent || '0'),
  }));

  const avgValue = completedAppointments > 0 ? totalSpent / completedAppointments : 0;

  const conversationsResult = await db.query(
    `SELECT COUNT(*) as count
     FROM conversations
     WHERE client_id = $1`,
    [clientId]
  );
  const totalConversations = parseInt(conversationsResult.rows[0]?.count || '0');

  const lastConvResult = await db.query(
    `SELECT MAX(updated_at) as last_date
     FROM conversations
     WHERE client_id = $1`,
    [clientId]
  );
  const lastConversationDate = lastConvResult.rows[0]?.last_date || null;

  return {
    total_spent: totalSpent,
    total_appointments: totalAppointments,
    completed_appointments: completedAppointments,
    no_show_count: noShowCount,
    no_show_rate: Math.round(noShowRate * 100) / 100,
    average_appointment_value: Math.round(avgValue * 100) / 100,
    visit_frequency: Math.round(visitFrequency * 100) / 100,
    last_appointment_date: lastAppointmentDate,
    first_appointment_date: firstAppointmentDate,
    preferred_services: preferredServices,
    total_conversations: totalConversations,
    last_conversation_date: lastConversationDate,
  };
}
