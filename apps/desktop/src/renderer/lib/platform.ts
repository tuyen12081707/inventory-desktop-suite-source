const browserFallback = {
  secureStore: {
    async getRefreshToken(): Promise<string | null> {
      return sessionStorage.getItem('inventory.refreshToken');
    },
    async setRefreshToken(token: string | null): Promise<void> {
      if (token) sessionStorage.setItem('inventory.refreshToken', token);
      else sessionStorage.removeItem('inventory.refreshToken');
    },
  },
  async printCurrentWindow(): Promise<{ success: boolean; reason?: string }> {
    window.print();
    return { success: true };
  },
  platform: 'browser',
};

export const desktop = window.inventoryDesktop ?? browserFallback;
