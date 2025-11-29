import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function sanitizePublicUrl(rawUrl, { allowLoopback } = { allowLoopback: false }) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (!allowLoopback && LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) return null;
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  } catch { return null; }
}

const allowLoopback = process.env.NODE_ENV !== 'production';
const resolvedPublicUrl =
  sanitizePublicUrl(process.env.NEXT_PUBLIC_APP_URL, { allowLoopback }) ??
  sanitizePublicUrl(process.env.NEXT_PUBLIC_BASE_URL, { allowLoopback }) ??
  sanitizePublicUrl(process.env.NEXTAUTH_URL, { allowLoopback }) ??
  'https://dintrafikskolahlm.se';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ============================================
  // 🚀 BUILD SPEED OPTIMIZATIONS
  // ============================================
  
  // Skip linting and type checking during build
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // Disable source maps for faster builds
  productionBrowserSourceMaps: false,
  
  // ============================================
  // 📦 PACKAGE OPTIMIZATION (KEY FOR SPEED!)
  // ============================================
  
  experimental: {
    optimizeCss: false,
    // Optimize barrel file imports - HUGE speed boost (up to 70% faster)
    // This prevents loading thousands of unused modules from icon/component libraries
    optimizePackageImports: [
      // Icon libraries (biggest impact - can have 10k+ exports)
      'lucide-react',
      '@radix-ui/react-icons',
      '@heroicons/react',
      '@tabler/icons-react',
      'react-icons',
      // Radix UI components
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      // Drag and drop
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      '@dnd-kit/modifiers',
      '@hello-pangea/dnd',
      // Utility libraries
      'lodash',
      'lodash-es',
      'date-fns',
      'framer-motion',
      'recharts',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
  },
  
  // ============================================
  // 🖼️ IMAGE OPTIMIZATION
  // ============================================
  
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.dintrafikskolahlm.se' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  
  // ============================================
  // 🔧 COMPILER SETTINGS
  // ============================================
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  
  // ============================================
  // 🌐 ENVIRONMENT VARIABLES
  // ============================================
  
  env: {
    REDIS_DISABLED_AT_BUILD: 'true',
    NEXT_PUBLIC_APP_URL: resolvedPublicUrl,
    NEXT_PUBLIC_BASE_URL: resolvedPublicUrl,
  },
  
  // ============================================
  // 📦 EXTERNAL PACKAGES (Server-side)
  // ============================================
  
  serverExternalPackages: [
    'redis', '@redis/client', 'ioredis',
    'postgres', 'pg', 'drizzle-orm',
    'nodemailer', '@usewaypoint/email-builder',
    'bcrypt', 'bcryptjs',
    'sharp',
  ],
  
  // ============================================
  // 🔨 WEBPACK - MINIMAL CONFIG (avoid breaking changes)
  // ============================================
  
  webpack: (config, { isServer, dev }) => {
    // Only apply caching in production
    if (!dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: join(__dirname, '.next', 'cache', 'webpack'),
      };
    }
    
    return config;
  },
};

export default nextConfig;
