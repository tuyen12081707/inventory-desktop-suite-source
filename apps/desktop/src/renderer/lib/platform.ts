const browserFallback = {
  secureStore: {
    async getRefreshToken(): Promise<string | null> {
      const token =
        localStorage.getItem('inventory.refreshToken') ??
        sessionStorage.getItem('inventory.refreshToken');
      if (token && !localStorage.getItem('inventory.refreshToken')) {
        localStorage.setItem('inventory.refreshToken', token);
        sessionStorage.removeItem('inventory.refreshToken');
      }
      return token;
    },
    async setRefreshToken(token: string | null): Promise<void> {
      if (token) {
        localStorage.setItem('inventory.refreshToken', token);
        sessionStorage.removeItem('inventory.refreshToken');
      } else {
        localStorage.removeItem('inventory.refreshToken');
        sessionStorage.removeItem('inventory.refreshToken');
      }
    },
  },
  async printCurrentWindow(): Promise<{ success: boolean; reason?: string }> {
    window.print();
    return { success: true };
  },
  platform: 'browser',
};

export const desktop = window.inventoryDesktop ?? browserFallback;
