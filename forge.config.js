const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './resources/AppIcon.icns',
    setupIcon: './resources/AppIcon.icns',
    background: './resources/dmg_background.png',
    appBundleId: 'com.digitalindividuals.sonnetstudio',
    appVersion: '1.0.0',
    buildVersion: '1.0.0',
    osxSign: {
      optionsForFile: (filePath) => {
        return {
          entitlements: './resources/build/entitlements.mac.plist'
        };
      },
      hardenedRuntime: true,
      gatekeeperAssess: false
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: './resources/AppIcon.ico',
        options: {
          icon: './resources/AppIcon.ico'
        },
        name: 'Sonnet Studio',
        version: '1.0.0',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        name: 'Sonnet Studio',
        version: '1.0.0',
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
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {
    //     options: {
    //       bin: 'sonnet-desktop',
    //       icon: './resources/icons/png'
    //     }
    //   }
    // },
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
