import 'package:flutter/material.dart';

import 'api_client.dart';
import 'screens/home_screen.dart';
import 'screens/products_screen.dart';
import 'screens/settings_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProducaoScanApp());
}

class ProducaoScanApp extends StatelessWidget {
  const ProducaoScanApp({super.key});

  @override
  Widget build(BuildContext context) {
    const blue = Color(0xFF1565C0);
    return MaterialApp(
      title: 'DAMA · Controle de Produção',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: const ColorScheme.light(
          primary: blue,
          onPrimary: Colors.white,
          primaryContainer: Color(0xFFD6E4F7),
          onPrimaryContainer: Color(0xFF0D3B75),
          secondary: Color(0xFFE3F2FD),
          onSecondary: Color(0xFF0D47A1),
          surface: Colors.white,
          onSurface: Color(0xFF0F172A),
          outline: Color(0xFF90CAF9),
        ),
        scaffoldBackgroundColor: Colors.white,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: blue,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: Color(0xFFD6E4F7),
        ),
        cardTheme: const CardTheme(
          color: Colors.white,
          surfaceTintColor: Colors.transparent,
        ),
      ),
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final started = DateTime.now();
    try {
      await ApiClient.instance.load();
    } catch (_) {
      // Continua para o app; a tela inicial trata falha de conexão.
    }
    final elapsed = DateTime.now().difference(started);
    final remaining = const Duration(milliseconds: 900) - elapsed;
    if (remaining > Duration.zero) {
      await Future<void>.delayed(remaining);
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const Shell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 48),
          child: Image(
            image: AssetImage('assets/branding/dama_logo.png'),
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}

class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _index = 0;
  int _productsTick = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      const HomeScreen(),
      ProductsScreen(key: ValueKey(_productsTick)),
      const SettingsScreen(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('DAMA · Controle de Produção'),
      ),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) {
          setState(() {
            _index = value;
            if (value == 1) _productsTick++;
          });
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.qr_code_scanner), label: 'Produção'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), label: 'Produtos'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'Configurações'),
        ],
      ),
    );
  }
}
