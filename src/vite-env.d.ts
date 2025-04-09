/// <reference types="vite/client" />

interface Window {
  gapi: {
    load: (api: string, callback: () => void) => void;
    client: {
      init: (config: { clientId: string; scope: string }) => Promise<void>;
      load: (api: string, version: string) => Promise<void>;
      calendar: {
        events: {
          insert: (params: any) => Promise<any>;
        };
      };
    };
    auth2: {
      getAuthInstance: () => {
        isSignedIn: {
          get: () => boolean;
        };
        signIn: () => Promise<void>;
      };
    };
  };
}
