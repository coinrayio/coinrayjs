import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'coinrayjs',
  tagline: 'Official JavaScript client library for Coinray.io',
  favicon: 'img/favicon.png',

  future: {v4: true},

  url: 'https://coinrayio.github.io',
  baseUrl: '/coinrayjs/',
  organizationName: 'coinrayio',
  projectName: 'coinrayjs',

  onBrokenLinks: 'warn',
  markdown: {hooks: {onBrokenMarkdownLinks: 'warn'}},

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/coinrayio/coinrayjs/tree/master/website/',
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: ['../lib/index.ts'],
        tsconfig: '../tsconfig.types.json',
        out: 'docs/api',
        sidebar: {pretty: true},
        readme: 'none',
      },
    ],
  ],

  themes: ['@docusaurus/theme-live-codeblock'],

  themeConfig: {
    colorMode: {respectPrefersColorScheme: true},
    navbar: {
      title: 'coinrayjs',
      logo: {
        alt: 'Coinray',
        src: 'img/coinray-logo.png',
      },
      items: [
        {type: 'docSidebar', sidebarId: 'guides', position: 'left', label: 'Guides'},
        {type: 'docSidebar', sidebarId: 'api', position: 'left', label: 'API Reference'},
        {to: '/playground', label: 'Playground', position: 'left'},
        {href: 'https://github.com/coinrayio/coinrayjs', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Guides', to: '/getting-started'},
            {label: 'API Reference', to: '/api'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/coinrayio/coinrayjs'},
            {label: 'npm', href: 'https://www.npmjs.com/package/coinrayjs'},
          ],
        },
      ],
      copyright: `Coinray.io · MIT licensed`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
