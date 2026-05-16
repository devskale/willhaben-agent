import { checkAuth } from "./auth.js";

import { BASE_URL } from '../lib/constants.js';
const MESSAGING_API = `${BASE_URL}/webapi/iad-messaging/sendrequest/chat`;
const CONVERSATIONS_API = `${BASE_URL}/webapi/chat-api/v1/conversations`;

const getHeaders = (cookies: string) => ({
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Cookie: cookies,
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
  Origin: BASE_URL,
  Referer: `${BASE_URL}/`,
});

export interface SendMessageOptions {
  adId: string | number;
  message: string;
  copyToSender?: boolean;
  showPhone?: boolean;
  phone?: string;
}

export interface SendMessageResult {
  success: boolean;
  message: string;
  error?: string;
  data?: unknown;
}

export interface ConversationMessage {
  id: string;
  message: string;
  isMine: boolean;
  read: boolean;
  timestamp: string;
  attachmentsCount: number;
}

export interface Conversation {
  id: string;
  adId: number;
  adUuid?: string;
  adTitle: string;
  adImageUrl?: string;
  adPrice?: string;
  adStatus: string;
  adUrl?: string;
  partnerName: string;
  partnerId: string;
  partnerAvatar?: string;
  unseen: number;
  lastMessage?: ConversationMessage;
  totalMessages: number;
  createdAt: string;
  updatedAt?: string;
  messages?: ConversationMessage[];
}

export interface ConversationsResult {
  success: boolean;
  conversations: Conversation[];
  total: number;
  error?: string;
}

/**
 * Get all conversations
 */
export const getConversations = async (
  limit: number = 50,
  offset: number = 0
): Promise<ConversationsResult> => {
  const auth = await checkAuth();

  if (!auth.isAuthenticated) {
    return {
      success: false,
      conversations: [],
      total: 0,
      error: "Not authenticated. Please log in to willhaben.at in your browser first.",
    };
  }

  try {
    const url = `${CONVERSATIONS_API}?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(auth.cookies),
    });

    if (!response.ok) {
      return {
        success: false,
        conversations: [],
        total: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Parse the actual API response structure
    const conversations = (data.conversations || []).map((c: any): Conversation => ({
      id: c.conversation_id,
      adId: c.ad_info?.id,
      adUuid: c.ad_info?.uuid,
      adTitle: c.ad_info?.subject || "Unknown",
      adImageUrl: c.ad_info?.image_url,
      adPrice: c.ad_info?.price_eur,
      adStatus: c.ad_info?.status || "unknown",
      adUrl: c.ad_info?.id ? `https://www.willhaben.at/iad/object?adId=${c.ad_info.id}` : undefined,
      partnerName: c.participant_info?.name || "Unknown",
      partnerId: c.participant_info?.id,
      partnerAvatar: c.participant_info?.avatar_url,
      unseen: c.unseen || 0,
      lastMessage: c.last_message ? {
        id: c.last_message.id,
        message: c.last_message.preview || "",
        isMine: c.last_message.is_mine || false,
        read: c.last_message.read || false,
        timestamp: c.last_message.timestamp,
        attachmentsCount: c.last_message.attachments_count || 0,
      } : undefined,
      totalMessages: c.total_messages_count || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return {
      success: true,
      conversations,
      total: data.items || conversations.length,
    };
  } catch (error) {
    return {
      success: false,
      conversations: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get messages for a specific conversation
 */
export const getMessages = async (
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Conversation> => {
  const auth = await checkAuth();

  if (!auth.isAuthenticated) {
    throw new Error("Not authenticated. Please log in to willhaben.at in your browser first.");
  }

  const url = `${CONVERSATIONS_API}/${conversationId}/messages?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(auth.cookies),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: HTTP ${response.status}`);
  }

  const data = await response.json();
  
  // Parse conversation info
  const info = data.conversation_info || {};
  const rawMessages = data.messages || [];
  const messages: ConversationMessage[] = rawMessages.map((m: any): ConversationMessage => ({
    id: m.message_id || m.id,
    message: m.text || m.message || m.preview || "",
    isMine: m.is_mine || m.isMine || false,
    read: m.read || false,
    timestamp: m.created_at || m.timestamp || m.sent_at,
    attachmentsCount: m.attachments_count || 0,
  }));

  return {
    id: conversationId,
    adId: info.ad_info?.id,
    adUuid: info.ad_info?.uuid,
    adTitle: info.ad_info?.subject || "Unknown",
    adImageUrl: info.ad_info?.image_url,
    adPrice: info.ad_info?.price_eur,
    adStatus: info.ad_info?.status || "unknown",
    adUrl: info.ad_info?.id 
      ? `https://www.willhaben.at/iad/object?adId=${info.ad_info.id}` 
      : undefined,
    partnerName: info.participant_info?.name || "Unknown",
    partnerId: info.participant_info?.id,
    partnerAvatar: info.participant_info?.avatar_url,
    unseen: info.unseen || 0,
    totalMessages: info.total_messages_count || messages.length,
    createdAt: info.created_at,
    updatedAt: info.updated_at,
    messages,
  };
};

/**
 * Send a message to a seller on willhaben.at
 */
export const sendMessage = async (
  options: SendMessageOptions
): Promise<SendMessageResult> => {
  const { adId, message, copyToSender = false, showPhone = false, phone = "" } = options;

  // Check authentication and get user info
  const auth = await checkAuth();

  if (!auth.isAuthenticated || !auth.user) {
    return {
      success: false,
      message: "Not authenticated. Please log in to willhaben.at in your browser first.",
      error: "AUTH_REQUIRED",
    };
  }

  const { cookies, user } = auth;

  // Parse user name
  const nameParts = user.name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const payload = {
    fromFullName: user.name,
    firstName,
    lastName,
    shareTenantProfile: false,
    from: user.email || "",
    adId: typeof adId === "string" ? parseInt(adId, 10) : adId,
    copyToSender,
    showTelephoneNumber: showPhone,
    telephone: phone,
    selectedContactSuggestions: [],
    mailContent: message,
  };

  try {
    const response = await fetch(MESSAGING_API, {
      method: "POST",
      headers: getHeaders(cookies),
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorData.error || errorMsg;
      } catch {
        // Ignore JSON parse errors
      }
      return {
        success: false,
        message: `Failed to send message: ${errorMsg}`,
        error: "API_ERROR",
      };
    }

    const result = await response.json();

    return {
      success: true,
      message: "Message sent successfully!",
      ...(result && { data: result }),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
      error: "NETWORK_ERROR",
    };
  }
};
