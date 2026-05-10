import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:retrofit/retrofit.dart';

part 'api_client.g.dart';

@RestApi(baseUrl: 'http://localhost:8080/api')
abstract class ApiClient {
  factory ApiClient(Dio dio, {String baseUrl}) = _ApiClient;

  static final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
  ));

  static final secureStorage = const FlutterSecureStorage();

  static ApiClient create() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await secureStorage.read(key: 'token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await secureStorage.delete(key: 'token');
          await secureStorage.delete(key: 'user');
        }
        return handler.next(error);
      },
    ));
    return ApiClient(_dio);
  }

  @POST('/auth/login')
  Future<AuthResponse> login(@Body() LoginRequest request);

  @POST('/auth/register')
  Future<AuthResponse> register(@Body() RegisterRequest request);

  @GET('/feed')
  Future<List<FeedItem>> getFeed();

  @POST('/feed/posts')
  Future<FeedItem> createPost(@Body() CreatePostRequest request);

  @GET('/users/:userId')
  Future<User> getUser(@Path('userId') String userId);

  @GET('/messages/conversation/:conversationId')
  Future<List<Message>> getMessages(@Path('conversationId') String conversationId);

  @POST('/messages/direct')
  Future<Message> sendMessage(@Body() SendMessageRequest request);

  @GET('/livestreams/active')
  Future<List<Livestream>> getActiveLivestreams();

  @GET('/livestream/:streamId')
  Future<Livestream> getLivestream(@Path('streamId') String streamId);
}

class LoginRequest {
  final String email;
  final String password;

  LoginRequest({required this.email, required this.password});

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
  };
}

class RegisterRequest {
  final String email;
  final String username;
  final String password;

  RegisterRequest({
    required this.email,
    required this.username,
    required this.password,
  });

  Map<String, dynamic> toJson() => {
    'email': email,
    'username': username,
    'password': password,
  };
}

class AuthResponse {
  final User user;
  final String token;

  AuthResponse({required this.user, required this.token});

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      user: User.fromJson(json['user']),
      token: json['token'],
    );
  }
}

class User {
  final String id;
  final String email;
  final String username;
  final String? displayName;
  final String? avatar;
  final String? bio;
  final int followers;
  final int following;
  final bool isVerified;

  User({
    required this.id,
    required this.email,
    required this.username,
    this.displayName,
    this.avatar,
    this.bio,
    required this.followers,
    required this.following,
    required this.isVerified,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      username: json['username'],
      displayName: json['displayName'],
      avatar: json['avatar'],
      bio: json['bio'],
      followers: json['followers'] ?? 0,
      following: json['following'] ?? 0,
      isVerified: json['isVerified'] ?? false,
    );
  }
}

class FeedItem {
  final String id;
  final User user;
  final String content;
  final String? mediaUrl;
  final int likes;
  final int comments;
  final DateTime createdAt;

  FeedItem({
    required this.id,
    required this.user,
    required this.content,
    this.mediaUrl,
    required this.likes,
    required this.comments,
    required this.createdAt,
  });

  factory FeedItem.fromJson(Map<String, dynamic> json) {
    return FeedItem(
      id: json['id'],
      user: User.fromJson(json['user']),
      content: json['content'],
      mediaUrl: json['mediaUrl'],
      likes: json['likes'] ?? 0,
      comments: json['comments'] ?? 0,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

class CreatePostRequest {
  final String content;
  final String? mediaUrl;

  CreatePostRequest({required this.content, this.mediaUrl});

  Map<String, dynamic> toJson() => {
    'content': content,
    if (mediaUrl != null) 'mediaUrl': mediaUrl,
  };
}

class Message {
  final String id;
  final String senderId;
  final String receiverId;
  final String content;
  final DateTime timestamp;
  final bool read;

  Message({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.timestamp,
    required this.read,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'],
      senderId: json['senderId'],
      receiverId: json['receiverId'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      read: json['read'] ?? false,
    );
  }
}

class SendMessageRequest {
  final String senderId;
  final String receiverId;
  final String content;

  SendMessageRequest({
    required this.senderId,
    required this.receiverId,
    required this.content,
  });

  Map<String, dynamic> toJson() => {
    'senderId': senderId,
    'receiverId': receiverId,
    'content': content,
  };
}

class Livestream {
  final String id;
  final String broadcasterId;
  final String title;
  final String description;
  final String? thumbnailUrl;
  final String status;
  final int viewerCount;
  final String hlsUrl;

  Livestream({
    required this.id,
    required this.broadcasterId,
    required this.title,
    required this.description,
    this.thumbnailUrl,
    required this.status,
    required this.viewerCount,
    required this.hlsUrl,
  });

  factory Livestream.fromJson(Map<String, dynamic> json) {
    return Livestream(
      id: json['id'],
      broadcasterId: json['broadcasterId'],
      title: json['title'],
      description: json['description'],
      thumbnailUrl: json['thumbnailUrl'],
      status: json['status'],
      viewerCount: json['viewerCount'] ?? 0,
      hlsUrl: json['hlsUrl'],
    );
  }
}
