import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    title: 'File Search Documentation',
    description:
      'Technical documentation for the File Search project - a comprehensive file scanning and search system',
    base: '/file-search/',
    vite: {
      optimizeDeps: {
        include: ['dayjs', 'mermaid'],
      },
      ssr: {
        noExternal: ['dayjs', 'mermaid'],
      },
    },
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Quick Start', link: '/quick-start' },
        { text: 'HLD - NestJS Server', link: '/HLD-NestJS-Server' },
        { text: 'HLD - File Scanner Agent', link: '/HLD-Go-File-Scanner' },
      ],

      sidebar: [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Quick Start', link: '/quick-start' },
            { text: 'HLD - NestJS Server', link: '/HLD-NestJS-Server' },
            { text: 'HLD - File Scanner Agent', link: '/HLD-Go-File-Scanner' },
          ],
        },
      ],

      socialLinks: [
        { icon: 'github', link: 'https://github.com/yedidyar/file-search' },
      ],
    },
    // Mermaid configuration
    mermaid: {
      // refer https://mermaid.js.org/config/setup/modules/mermaidAPI.html#mermaidapi-configuration-defaults for options
    },
    // optionally set additional config for plugin itself with MermaidPluginConfig
    mermaidPlugin: {
      class: 'mermaid my-class', // set additional css classes for parent container
    },
  }),
);
