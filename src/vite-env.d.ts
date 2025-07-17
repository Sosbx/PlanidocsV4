/// <reference types="vite/client" />

interface Window {
  gapi: {
    load: (api: string, callback: () => void) => void;
    auth: {
      setToken: (token: { access_token: string }) => void;
    };
    client: {
      init: (config: { 
        clientId?: string; 
        scope?: string;
        discoveryDocs?: string[];
      }) => Promise<void>;
      load: (api: string, version: string) => Promise<void>;
      setToken: (token: { access_token: string }) => void;
      getToken: () => { access_token: string } | null;
      newBatch: () => any;
      calendar: {
        events: {
          insert: (params: any) => Promise<any>;
          list: (params: any) => Promise<any>;
          delete: (params: any) => Promise<any>;
          update: (params: any) => Promise<any>;
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
