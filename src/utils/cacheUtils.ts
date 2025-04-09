/**
 * Utilitaire de cache amélioré pour réduire les appels Firebase redondants
 */

// Type pour les entrées du cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  listeners: Set<() => void>;
}

// Type pour les options de configuration du cache
interface CacheOptions {
  expirationTime?: number; // Temps d'expiration en millisecondes
  prefix?: string; // Préfixe pour les clés de cache
}

/**
 * Classe utilitaire pour la gestion du cache
 */
export class CacheUtils {
  private static cache: Record<string, CacheEntry<any>> = {};
  private static expirationTime = 5 * 60 * 1000; // 5 minutes par défaut
  private static prefix = '';

  /**
   * Configure les options du cache
   * @param options Options de configuration
   */
  static configure(options: CacheOptions): void {
    if (options.expirationTime !== undefined) {
      this.expirationTime = options.expirationTime;
    }
    if (options.prefix !== undefined) {
      this.prefix = options.prefix;
    }
  }

  /**
   * Génère une clé de cache avec le préfixe configuré
   * @param key Clé de base
   * @returns Clé avec préfixe
   */
  private static getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  /**
   * Récupère des données du cache
   * @param key Clé du cache
   * @returns Données du cache ou null si non trouvées ou expirées
   */
  static get<T>(key: string): T | null {
    const fullKey = this.getKey(key);
    const entry = this.cache[fullKey];
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > this.expirationTime) {
      // Données expirées
      delete this.cache[fullKey];
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Stocke des données dans le cache
   * @param key Clé du cache
   * @param data Données à stocker
   */
  static set<T>(key: string, data: T): void {
    const fullKey = this.getKey(key);
    const entry = this.cache[fullKey] || { data: null, timestamp: 0, listeners: new Set() };
    
    entry.data = data;
    entry.timestamp = Date.now();
    
    this.cache[fullKey] = entry;
    
    // Notifier les listeners
    entry.listeners.forEach(listener => listener());
  }
  
  /**
   * Invalide une entrée du cache
   * @param key Clé du cache à invalider
   */
  static invalidate(key: string): void {
    const fullKey = this.getKey(key);
    delete this.cache[fullKey];
  }
  
  /**
   * Invalide toutes les entrées du cache qui commencent par un préfixe
   * @param prefix Préfixe des clés à invalider
   */
  static invalidateByPrefix(prefix: string): void {
    const fullPrefix = this.getKey(prefix);
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(fullPrefix)) {
        delete this.cache[key];
      }
    });
  }
  
  /**
   * Ajoute un listener pour une clé du cache
   * @param key Clé du cache
   * @param listener Fonction à appeler lorsque les données sont mises à jour
   * @returns Fonction pour supprimer le listener
   */
  static addListener(key: string, listener: () => void): () => void {
    const fullKey = this.getKey(key);
    const entry = this.cache[fullKey] || { data: null, timestamp: 0, listeners: new Set() };
    
    entry.listeners.add(listener);
    this.cache[fullKey] = entry;
    
    return () => {
      if (this.cache[fullKey]) {
        this.cache[fullKey].listeners.delete(listener);
      }
    };
  }

  /**
   * Récupère des données du cache ou les charge si elles ne sont pas présentes
   * @param key Clé du cache
   * @param loader Fonction pour charger les données si elles ne sont pas dans le cache
   * @returns Données du cache ou chargées
   */
  static async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cachedData = this.get<T>(key);
    if (cachedData !== null) {
      return cachedData;
    }

    // Charger les données
    const data = await loader();
    this.set(key, data);
    return data;
  }

  /**
   * Vide complètement le cache
   */
  static clear(): void {
    this.cache = {};
  }
}

/**
 * Classe utilitaire spécifique pour le cache Firestore
 * Étend CacheUtils avec des fonctionnalités spécifiques à Firestore
 */
export class FirestoreCacheUtils extends CacheUtils {
  // Configurer le cache avec un préfixe pour Firestore
  static {
    CacheUtils.configure({ prefix: 'firestore' });
  }

  /**
   * Génère une clé de cache pour une collection Firestore
   * @param collectionName Nom de la collection
   * @param queryParams Paramètres de requête (optionnel)
   * @returns Clé de cache
   */
  static getCollectionKey(collectionName: string, queryParams?: Record<string, any>): string {
    if (!queryParams) {
      return collectionName;
    }
    
    // Trier les paramètres pour assurer la cohérence des clés
    const sortedParams = Object.entries(queryParams)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('&');
    
    return `${collectionName}?${sortedParams}`;
  }

  /**
   * Génère une clé de cache pour un document Firestore
   * @param collectionName Nom de la collection
   * @param documentId ID du document
   * @returns Clé de cache
   */
  static getDocumentKey(collectionName: string, documentId: string): string {
    return `${collectionName}/${documentId}`;
  }

  /**
   * Invalide le cache pour une collection entière
   * @param collectionName Nom de la collection
   */
  static invalidateCollection(collectionName: string): void {
    this.invalidateByPrefix(collectionName);
  }

  /**
   * Invalide le cache pour un document spécifique
   * @param collectionName Nom de la collection
   * @param documentId ID du document
   */
  static invalidateDocument(collectionName: string, documentId: string): void {
    this.invalidate(this.getDocumentKey(collectionName, documentId));
  }
}
