/**
 * Message and Chats command handlers.
 */

import { sendMessage, getConversations, getMessages } from '../agents/messaging.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdMessage(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const adId = positional[0];
  const message = positional.slice(1).join(' ');

  if (!adId) {
    output({ error: 'Missing listing ID. Usage: whcli message <adId> <message>' }, format);
    process.exit(1);
  }
  if (!message) {
    output({ error: 'Missing message. Usage: whcli message <adId> <message>' }, format);
    process.exit(1);
  }

  try {
    const result = await sendMessage({
      adId,
      message,
      copyToSender: flags['copy'] === true,
      showPhone: flags['show-phone'] === true,
      phone: typeof flags.phone === 'string' ? flags.phone : undefined,
    });
    output(result, format);
    if (!result.success) process.exit(1);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to send message' }, format);
    process.exit(1);
  }
}

export async function cmdChats(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  // Ignore "list" keyword — it just means "show all conversations"
  const conversationId = positional[0] && positional[0] !== 'list' ? positional[0] : undefined;
  try {
    if (conversationId) {
      output(await getMessages(conversationId), format);
      return;
    }

    const result = await getConversations();
    if (!result.success) {
      output({ error: result.error }, format);
      process.exit(1);
    }

    const simplified = result.conversations.map(c => ({
      id: c.id,
      partner: c.partnerName,
      adTitle: c.adTitle,
      adId: c.adId,
      adStatus: c.adStatus,
      price: c.adPrice,
      lastMessage: c.lastMessage?.message?.substring(0, 100),
      lastMessageAt: c.lastMessage?.timestamp,
      isMine: c.lastMessage?.isMine,
      unseen: c.unseen,
    }));

    output({ total: result.total, conversations: simplified }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to fetch chats' }, format);
    process.exit(1);
  }
}
