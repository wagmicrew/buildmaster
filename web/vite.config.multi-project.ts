/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Multi-project test configuration for BuildMaster
// Handles tests for both BuildMaster and external projects

const PROJECTS = {
  buildmaster: {
    path: path.resolve(__dirname, './src'),
    tests: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  },
  dintrafikskola_dev: {
    path: '/var/www/dintrafikskolax_dev',
    tests: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    env: 'development'
  },
  dintrafikskola_prod: {
    path: '/var/www/dintrafikskolax_prod', 
    tests: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    env: 'production'
  },
  trafikapp: {
    path: '/var/www/trafikapp',
    tests: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    env: 'production'
  }
}

function getProjectConfig() {
  const projectName = process.env.TEST_PROJECT || 'buildmaster'
  const project = PROJECTS[projectName as keyof typeof PROJECTS]
  
  if (!project) {
    throw new Error(`Unknown project: ${projectName}. Available: ${Object.keys(PROJECTS).join(', ')}`)
  }

  return {
    projectName,
    projectPath: project.path,
    testEnv: (project as any).env || process.env.TEST_ENV || 'dev'
  }
}

export default defineConfig(({ mode }) => {
  const { projectName, projectPath, testEnv } = getProjectConfig()
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@dintrafikskola': '/var/www/dintrafikskolax_dev',
        '@trafikapp': '/var/www/trafikapp'
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [
        './src/test/setup.ts',
        ...(projectName !== 'buildmaster' ? [
          path.join(projectPath, 'test/setup.ts'),
          path.join(projectPath, 'vitest.setup.ts')
        ].filter(Boolean) : [])
      ],
      css: true,
      include: [
        ...PROJECTS.buildmaster.tests,
        ...(PROJECTS[projectName as keyof typeof PROJECTS]?.tests || [])
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.config.*',
        '**/mockData'
      ],
      env: {
        TEST_PROJECT: projectName,
        TEST_ENV: testEnv,
        NODE_ENV: testEnv === 'prod' ? 'production' : 'development',
        PROJECT_PATH: projectPath
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          'tests/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData',
          'dist/',
          'build/',
        ],
      },
      testTimeout: 30000,
      hookTimeout: 30000,
    },
    define: {
      __PROJECT__: JSON.stringify(projectName),
      __PROJECT_PATH__: JSON.stringify(projectPath)
    }
  }
})
