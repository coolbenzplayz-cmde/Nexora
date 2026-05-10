import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:nexora_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:nexora_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:nexora_mobile/features/auth/presentation/pages/register_page.dart';
import 'package:nexora_mobile/features/home/presentation/pages/home_page.dart';
import 'package:nexora_mobile/features/feed/presentation/pages/feed_page.dart';
import 'package:nexora_mobile/features/profile/presentation/pages/profile_page.dart';
import 'package:nexora_mobile/features/messages/presentation/pages/messages_page.dart';
import 'package:nexora_mobile/features/livestream/presentation/pages/livestream_page.dart';
import 'package:nexora_mobile/features/settings/presentation/pages/settings_page.dart';
import 'package:nexora_mobile/core/theme/app_theme.dart';

void main() {
  runApp(const NexoraApp());
}

class NexoraApp extends StatelessWidget {
  const NexoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => AuthBloc()),
      ],
      child: MaterialApp.router(
        title: 'Nexora',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        routerConfig: _router,
      ),
    );
  }
}

final GoRouter _router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginPage(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterPage(),
    ),
    GoRoute(
      path: '/',
      builder: (context, state) => const HomePage(),
      routes: [
        GoRoute(
          path: 'feed',
          builder: (context, state) => const FeedPage(),
        ),
        GoRoute(
          path: 'profile/:userId',
          builder: (context, state) => ProfilePage(
            userId: state.pathParameters['userId']!,
          ),
        ),
        GoRoute(
          path: 'messages',
          builder: (context, state) => const MessagesPage(),
        ),
        GoRoute(
          path: 'livestream',
          builder: (context, state) => const LivestreamPage(),
        ),
        GoRoute(
          path: 'livestream/:streamId',
          builder: (context, state) => LivestreamPage(
            streamId: state.pathParameters['streamId'],
          ),
        ),
        GoRoute(
          path: 'settings',
          builder: (context, state) => const SettingsPage(),
        ),
      ],
    ),
  ],
);
