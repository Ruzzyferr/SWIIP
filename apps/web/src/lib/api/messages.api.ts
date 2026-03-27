import { apiClient } from './client';
import type { MessagePayload, EmojiRef, AttachmentRef } from '@constchat/protocol';

export interface GetMessagesParams {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}

export interface SendMessageRequest {
  content?: string;
  nonce?: string;
  replyToId?: string;
  attachmentIds?: string[];
  attachments?: AttachmentRef[];
  mentionedUserIds?: string[];
}

export interface EditMessageRequest {
  content: string;
}

export async function getMessages(
  channelId: string,
  params?: GetMessagesParams
): Promise<MessagePayload[]> {
  const res = await apiClient.get<MessagePayload[]>(
    `/channels/${channelId}/messages`,
    { params }
  );
  return res.data;
}

export async function getMessage(
  channelId: string,
  messageId: string
): Promise<MessagePayload> {
  const res = await apiClient.get<MessagePayload>(
    `/channels/${channelId}/messages/${messageId}`
  );
  return res.data;
}

export async function sendMessage(
  channelId: string,
  data: SendMessageRequest
): Promise<MessagePayload> {
  const res = await apiClient.post<MessagePayload>(
    `/channels/${channelId}/messages`,
    {
      content: data.content,
      nonce: data.nonce,
      referencedMessageId: data.replyToId,
      attachmentIds: data.attachmentIds,
      mentionedUserIds: data.mentionedUserIds,
    }
  );
  return res.data;
}

export async function editMessage(
  channelId: string,
  messageId: string,
  data: EditMessageRequest
): Promise<MessagePayload> {
  const res = await apiClient.patch<MessagePayload>(
    `/channels/${channelId}/messages/${messageId}`,
    data
  );
  return res.data;
}

export async function deleteMessage(
  channelId: string,
  messageId: string
): Promise<void> {
  await apiClient.delete(`/channels/${channelId}/messages/${messageId}`);
}

export async function addReaction(
  channelId: string,
  messageId: string,
  emoji: EmojiRef
): Promise<void> {
  const emojiKey = emoji.id ? `${emoji.name}:${emoji.id}` : encodeURIComponent(emoji.name);
  await apiClient.put(
    `/channels/${channelId}/messages/${messageId}/reactions/${emojiKey}/@me`
  );
}

export async function removeReaction(
  channelId: string,
  messageId: string,
  emoji: EmojiRef,
  userId = '@me'
): Promise<void> {
  const emojiKey = emoji.id ? `${emoji.name}:${emoji.id}` : encodeURIComponent(emoji.name);
  await apiClient.delete(
    `/channels/${channelId}/messages/${messageId}/reactions/${emojiKey}/${userId}`
  );
}

export async function searchMessages(
  guildId: string,
  query: string,
  channelId?: string
): Promise<MessagePayload[]> {
  const res = await apiClient.get<MessagePayload[]>(
    `/guilds/${guildId}/messages/search`,
    { params: { q: query, channelId } }
  );
  return res.data;
}

export interface UploadAttachmentResponse {
  uploadUrl: string;
  uploadId: string;
  filename: string;
}

export async function requestAttachmentUpload(
  channelId: string,
  files: Array<{ filename: string; fileSize: number; contentType: string }>
): Promise<UploadAttachmentResponse[]> {
  const res = await apiClient.post<UploadAttachmentResponse[]>(
    `/uploads/channels/${channelId}/attachments`,
    { files }
  );
  return res.data;
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}
