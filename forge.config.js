module.exports = {
    makers: [
      {
        name: '@electron-forge/maker-dmg',
        config: {
          background: './resources/dmg-background.png',
          format: 'ULFO'
        }
      }
    ]
  };