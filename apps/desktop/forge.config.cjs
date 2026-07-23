const { join } = require('node:path');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'InventoryPro',
    download: {
      cacheRoot: process.env.INVENTORY_ELECTRON_CACHE || join(__dirname, '.electron-cache'),
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'inventory_pro',
        setupExe: 'InventoryPro-Setup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
  ],
};
