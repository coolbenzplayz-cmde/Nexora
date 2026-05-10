import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';

export interface NexoraConfig {
  apiKey: string;
  apiUrl?: string;
  wsUrl?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  followers: number;
  following: number;
  isVerified: boolean;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  content: string;
  type: string;
  mediaUrl?: string;
  likes: number;
  comments: number;
  tags: string[];
  createdAt: string;
}

export interface Livestream {
  id: string;
  broadcasterId: string;
  broadcasterName: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  status: string;
  viewerCount: number;
  likes: number;
  hlsUrl?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

export class NexoraSDK {
  private apiKey: string;
  private apiUrl: string;
  private wsUrl: string;
  private axios: AxiosInstance;
  private socket: Socket | null = null;

  constructor(config: NexoraConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.nexora.com';
    this.wsUrl = config.wsUrl || 'https://api.nexora.com';

    this.axios = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Authentication
  async authenticate(token: string): Promise<User> {
    const response = await this.axios.post('/auth/validate', { token });
    return response.data.user;
  }

  // Users
  async getUser(userId: string): Promise<User> {
    const response = await this.axios.get(`/users/${userId}`);
    return response.data;
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await this.axios.put(`/users/${userId}`, data);
    return response.data;
  }

  async followUser(userId: string, followUserId: string): Promise<void> {
    await this.axios.post(`/users/${followUserId}/follow`);
  }

  async unfollowUser(userId: string, followUserId: string): Promise<void> {
    await this.axios.delete(`/users/${followUserId}/follow`);
  }

  async searchUsers(query: string, limit?: number): Promise<User[]> {
    const response = await this.axios.get('/search/users', {
      params: { q: query, limit },
    });
    return response.data;
  }

  // Feed
  async getFeed(limit?: number, offset?: number): Promise<Post[]> {
    const response = await this.axios.get('/feed', {
      params: { limit, offset },
    });
    return response.data;
  }

  async createPost(content: string, mediaUrl?: string, tags?: string[]): Promise<Post> {
    const response = await this.axios.post('/feed/posts', {
      content,
      mediaUrl,
      tags,
    });
    return response.data;
  }

  async likePost(postId: string): Promise<void> {
    await this.axios.post(`/feed/posts/${postId}/like`);
  }

  async unlikePost(postId: string): Promise<void> {
    await this.axios.delete(`/feed/posts/${postId}/like`);
  }

  async commentOnPost(postId: string, content: string): Promise<void> {
    await this.axios.post(`/feed/posts/${postId}/comments`, { content });
  }

  async getPostComments(postId: string, limit?: number): Promise<any[]> {
    const response = await this.axios.get(`/feed/posts/${postId}/comments`, {
      params: { limit },
    });
    return response.data;
  }

  // Messaging
  async getConversations(): Promise<any[]> {
    const response = await this.axios.get('/conversations');
    return response.data;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const response = await this.axios.get(`/messages/conversation/${conversationId}`);
    return response.data;
  }

  async sendMessage(receiverId: string, content: string): Promise<Message> {
    const response = await this.axios.post('/messages/direct', {
      receiverId,
      content,
    });
    return response.data;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.axios.post(`/messages/${messageId}/read`);
  }

  // Livestreams
  async getActiveLivestreams(): Promise<Livestream[]> {
    const response = await this.axios.get('/livestreams/active');
    return response.data;
  }

  async getLivestream(streamId: string): Promise<Livestream> {
    const response = await this.axios.get(`/livestream/${streamId}`);
    return response.data;
  }

  async startLivestream(data: {
    title: string;
    description?: string;
    category?: string;
  }): Promise<Livestream> {
    const response = await this.axios.post('/livestreams/start', data);
    return response.data;
  }

  async endLivestream(streamId: string): Promise<void> {
    await this.axios.post(`/livestreams/${streamId}/end`);
  }

  async likeLivestream(streamId: string): Promise<void> {
    await this.axios.post(`/livestream/${streamId}/like`);
  }

  async sendStreamChat(streamId: string, content: string): Promise<void> {
    await this.axios.post(`/livestream/${streamId}/chat`, { content });
  }

  async getStreamChat(streamId: string): Promise<any[]> {
    const response = await this.axios.get(`/livestream/${streamId}/chat`);
    return response.data;
  }

  // Notifications
  async getNotifications(limit?: number): Promise<Notification[]> {
    const response = await this.axios.get('/notifications', {
      params: { limit },
    });
    return response.data;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.axios.post(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.axios.post('/notifications/read-all');
  }

  // Search
  async search(query: string, type?: string): Promise<{
    users: User[];
    posts: Post[];
    livestreams: Livestream[];
  }> {
    const response = await this.axios.get('/search', {
      params: { q: query, type },
    });
    return response.data;
  }

  // Recommendations
  async getRecommendations(limit?: number): Promise<Post[]> {
    const response = await this.axios.get('/recommendations', {
      params: { limit },
    });
    return response.data;
  }

  async recordBehavior(data: {
    contentId: string;
    action: string;
    duration?: number;
  }): Promise<void> {
    await this.axios.post('/recommendations/behavior', data);
  }

  // WebSocket / Real-time
  connectWebSocket(): Socket {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(this.wsUrl, {
      auth: {
        apiKey: this.apiKey,
      },
    });

    this.socket.on('connect', () => {
      console.log('Connected to Nexora WebSocket');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Nexora WebSocket');
    });

    return this.socket;
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onMessage(callback: (message: Message) => void): void {
    if (this.socket) {
      this.socket.on('message', callback);
    }
  }

  onNotification(callback: (notification: Notification) => void): void {
    if (this.socket) {
      this.socket.on('notification', callback);
    }
  }

  onLivestreamUpdate(callback: (stream: Livestream) => void): void {
    if (this.socket) {
      this.socket.on('livestream_update', callback);
    }
  }

  // Webhooks
  async createWebhook(url: string, events: string[]): Promise<any> {
    const response = await this.axios.post('/webhooks', { url, events });
    return response.data;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.axios.delete(`/webhooks/${webhookId}`);
  }

  async getWebhooks(): Promise<any[]> {
    const response = await this.axios.get('/webhooks');
    return response.data;
  }
}

export default NexoraSDK;
