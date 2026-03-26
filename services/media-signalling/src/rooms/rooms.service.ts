import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RoomServiceClient,
  AccessToken,
  VideoGrant,
  TrackSource,
  Room,
} from 'livekit-server-sdk';

export type QualityProfile = '720p30' | '1080p30' | '1080p60' | 'auto';

export interface JoinRoomResult {
  token: string;
  endpoint: string;
}

export interface RoomInfo {
  id: string;
  guildId: string;
  channelId: string;
  participants: RoomParticipant[];
  createdAt: Date;
}

export interface RoomParticipant {
  userId: string;
  identity: string;
  joinedAt: Date;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  screenShareQuality?: QualityProfile;
  tracks: string[];
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  private readonly livekitUrl: string;
  private readonly livekitApiKey: string;
  private readonly livekitApiSecret: string;
  private readonly roomServiceClient: RoomServiceClient;

  constructor(private readonly config: ConfigService) {
    this.livekitUrl = this.config.getOrThrow('LIVEKIT_URL');
    this.livekitApiKey = this.config.getOrThrow('LIVEKIT_API_KEY');
    this.livekitApiSecret = this.config.getOrThrow('LIVEKIT_API_SECRET');

    this.roomServiceClient = new RoomServiceClient(
      this.livekitUrl,
      this.livekitApiKey,
      this.livekitApiSecret,
    );
  }

  /**
   * Issue a LiveKit access token for a user to join a voice/video channel room.
   * Room name is deterministic: constchat-{guildId}-{channelId}
   */
  async joinRoom(params: {
    userId: string;
    username: string;
    guildId: string;
    channelId: string;
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
    canPublishSources?: TrackSource[];
    screenShareQuality?: QualityProfile;
  }): Promise<JoinRoomResult> {
    const roomName = this.buildRoomName(params.guildId, params.channelId);
    const identity = params.userId;

    // Ensure room exists
    await this.ensureRoomExists(roomName);

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: params.canPublish,
      canSubscribe: params.canSubscribe,
      canPublishData: params.canPublishData,
      canPublishSources: params.canPublishSources,
    };

    const token = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
      identity,
      name: params.username,
      ttl: '4h',
    });
    token.addGrant(grant);

    // Attach screen share quality profile as metadata
    if (params.screenShareQuality) {
      token.metadata = JSON.stringify({
        screenShareQuality: params.screenShareQuality,
        guildId: params.guildId,
        channelId: params.channelId,
      });
    }

    const jwt = await token.toJwt();

    this.logger.log(`Token issued for user ${params.userId} in room ${roomName}`);

    return {
      token: jwt,
      endpoint: this.livekitUrl,
    };
  }

  /**
   * Issue a screen share token with appropriate quality constraints.
   * Desktop app uses this to start high-quality screen share.
   */
  async startScreenShare(params: {
    userId: string;
    username: string;
    guildId: string;
    channelId: string;
    quality: QualityProfile;
  }): Promise<JoinRoomResult> {
    return this.joinRoom({
      ...params,
      canPublish: true,
      canSubscribe: false,
      canPublishData: true,
      canPublishSources: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
      screenShareQuality: params.quality,
    });
  }

  /**
   * Get current room participants for a channel.
   */
  async getRoomParticipants(guildId: string, channelId: string): Promise<RoomParticipant[]> {
    const roomName = this.buildRoomName(guildId, channelId);
    try {
      const participants = await this.roomServiceClient.listParticipants(roomName);
      return participants.map((p) => this.mapParticipant(p));
    } catch {
      return [];
    }
  }

  /**
   * Force-remove a participant from a room (mod action).
   */
  async removeParticipant(guildId: string, channelId: string, userId: string): Promise<void> {
    const roomName = this.buildRoomName(guildId, channelId);
    await this.roomServiceClient.removeParticipant(roomName, userId);
    this.logger.log(`Removed participant ${userId} from room ${roomName}`);
  }

  /**
   * Mute a participant server-side.
   */
  async muteParticipant(guildId: string, channelId: string, userId: string, trackSid: string): Promise<void> {
    const roomName = this.buildRoomName(guildId, channelId);
    await this.roomServiceClient.mutePublishedTrack(roomName, userId, trackSid, true);
  }

  /**
   * Delete a room (when channel is deleted or guild is purged).
   */
  async deleteRoom(guildId: string, channelId: string): Promise<void> {
    const roomName = this.buildRoomName(guildId, channelId);
    try {
      await this.roomServiceClient.deleteRoom(roomName);
    } catch {
      // Room may not exist
    }
  }

  /**
   * Build quality constraints for screen share track publishing.
   * These are sent as metadata; the client SDK applies them when publishing.
   */
  getScreenShareConstraints(quality: QualityProfile): {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
  } {
    const profiles: Record<QualityProfile, { width: number; height: number; frameRate: number; bitrate: number }> = {
      '720p30': { width: 1280, height: 720, frameRate: 30, bitrate: 2_500_000 },
      '1080p30': { width: 1920, height: 1080, frameRate: 30, bitrate: 5_000_000 },
      '1080p60': { width: 1920, height: 1080, frameRate: 60, bitrate: 8_000_000 },
      auto: { width: 1920, height: 1080, frameRate: 60, bitrate: 8_000_000 },
    };
    return profiles[quality];
  }

  private buildRoomName(guildId: string, channelId: string): string {
    return `guild-${guildId}-${channelId}`;
  }

  private async ensureRoomExists(roomName: string): Promise<Room> {
    const rooms = await this.roomServiceClient.listRooms([roomName]);
    if (rooms.length > 0 && rooms[0]) return rooms[0];

    // Create room with sensible defaults
    return await this.roomServiceClient.createRoom({
      name: roomName,
      maxParticipants: 500,
      emptyTimeout: 300, // 5min empty before auto-delete
      metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
    });
  }

  private mapParticipant(p: any): RoomParticipant {
    const tracks = p.tracks?.map((t: any) => t.sid) ?? [];
    const hasScreenShare = p.tracks?.some((t: any) =>
      t.source === 'SCREEN_SHARE' || t.source === 'SCREEN_SHARE_AUDIO'
    ) ?? false;
    const hasCam = p.tracks?.some((t: any) => t.source === 'CAMERA') ?? false;
    const hasMic = p.tracks?.some((t: any) => t.source === 'MICROPHONE') ?? false;

    return {
      userId: p.identity,
      identity: p.identity,
      joinedAt: new Date(Number(p.joinedAt) * 1000),
      isSpeaking: false, // updated via webhook events
      isMuted: !hasMic,
      isDeafened: false,
      isVideoEnabled: hasCam,
      isScreenSharing: hasScreenShare,
      tracks,
    };
  }
}
