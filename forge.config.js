const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './resources/AppIcon.icns',
    setupIcon: './resources/AppIcon.icns',
    background: './resources/dmg_background.png',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        options: {
          icon: './resources/AppIcon.icns'
        },
        name: 'Sonnet Studio',
        version: '1.0.1',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        name: 'Sonnet Studio',
        version: '1.0.1',
        options: {
          icon: './resources/AppIcon.icns'
        },
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'Sonnet Studio',
        version: '1.0.0',
        background: './resources/dmg_background.png',
        icon: './resources/AppIcon.icns',
        options: {
          icon: './resources/AppIcon.icns',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        name: 'Sonnet Studio',
        version: '1.0.1',
        options: {
          icon: './resources/AppIcon.icns'
        },
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'DI-Benjamin',
          name: 'sonnet-desktop'
        },
        prerelease: false,
        authToken: process.env.GH_TOKEN,
        draft: true,
        force: true,
        generateReleaseNotes: true
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
