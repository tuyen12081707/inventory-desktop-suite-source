/// <reference types="vite/client" />

interface Window {
  inventoryDesktop: {
    secureStore: {
      getRefreshToken(): Promise<string | null>;
      setRefreshToken(token: string | null): Promise<void>;
    };
    printCurrentWindow(): Promise<{ success: boolean; reason?: string }>;
    platform: string;
  };
}
