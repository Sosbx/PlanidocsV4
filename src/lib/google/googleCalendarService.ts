import { 
  DISCOVERY_DOC, 
  PLANIDOCS_EVENT_PROPERTIES,
  PLANIDOCS_EVENT_COLOR_ID,
  PLANIDOCS_CALENDAR_NAME,
  PLANIDOCS_CALENDAR_DESCRIPTION,
  PLANIDOCS_CALENDAR_COLOR
} from './googleCalendarConfig';
import type { ShiftAssignment } from '../../types/planning';
import type { GoogleCalendarEvent, GoogleCalendarSyncResult, CalendarSyncRecord, ConvertedEventDetail } from '../../types/googleCalendar';
import { 
  getUserSyncRecords, 
  saveSyncRecordsBatch, 
  deleteSyncRecordsBatch 
} from '../firebase/googleCalendarSync';
import { parseParisDate, createParisDate, formatParisDate } from '../../utils/timezoneUtils';

class GoogleCalendarService {
  private isInitialized = false;
  private accessToken: string | null = null;
  private planiDocsCalendarId: string | null = null;

  // Initialiser l'API Google
  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Charger la bibliothèque GAPI
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              discoveryDocs: [DISCOVERY_DOC],
            });
            this.isInitialized = true;
            resolve();
          } catch (error) {
            console.error('Error initializing Google API:', error);
            reject(error);
          }
        });
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  // Définir le token d'accès
  setAccessToken(token: string): void {
    this.accessToken = token;
    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken({ access_token: token });
      // Forcer la mise à jour du header Authorization
      window.gapi.auth.setToken({
        access_token: token
      });
      console.log('Token set in gapi client');
    } else {
      console.error('GAPI client not initialized when setting token');
    }
  }
  
  // Réinitialiser le calendrier PlaniDocs (utile en cas de problème)
  async resetPlaniDocsCalendar(): Promise<void> {
    console.log('Réinitialisation du calendrier PlaniDocs...');
    this.planiDocsCalendarId = null;
    localStorage.removeItem('planidocs_calendar_id');
    console.log('Cache du calendrier effacé');
  }
  
  // Vérifier et configurer l'authentification
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    if (!this.isInitialized) {
      await this.init();
    }
    
    // S'assurer que le token est configuré dans gapi
    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken({ access_token: this.accessToken });
      // Vérifier que le token est bien configuré
      const currentToken = window.gapi.client.getToken();
      if (!currentToken || currentToken.access_token !== this.accessToken) {
        console.warn('Token mismatch, resetting token');
        window.gapi.client.setToken({ access_token: this.accessToken });
      }
    }
  }

  // Obtenir ou créer le calendrier PlaniDocs
  private async getOrCreatePlaniDocsCalendar(): Promise<string> {
    // Vérifier si on a déjà l'ID en cache mémoire
    if (this.planiDocsCalendarId) {
      return this.planiDocsCalendarId;
    }

    console.log('Recherche du calendrier PlaniDocs...');

    // ÉTAPE 1: Rechercher d'abord dans la liste des calendriers de l'utilisateur (calendarList)
    let foundInList = false;
    let calendarIdFromList: string | null = null;
    
    try {
      const listResponse = await window.gapi.client.calendar.calendarList.list({
        minAccessRole: 'writer',
        showHidden: true
      });

      const calendars = listResponse.result.items || [];
      const planiDocsCalendar = calendars.find(
        cal => cal.summary === PLANIDOCS_CALENDAR_NAME
      );

      if (planiDocsCalendar && planiDocsCalendar.id) {
        console.log('Calendrier trouvé dans la liste:', planiDocsCalendar.id);
        foundInList = true;
        calendarIdFromList = planiDocsCalendar.id;
        // Sauvegarder et retourner
        this.planiDocsCalendarId = planiDocsCalendar.id;
        localStorage.setItem('planidocs_calendar_id', planiDocsCalendar.id);
        return planiDocsCalendar.id;
      }
    } catch (error) {
      console.error('Erreur lors de la recherche dans calendarList:', error);
    }

    // ÉTAPE 2: Vérifier le cache localStorage
    const cachedCalendarId = localStorage.getItem('planidocs_calendar_id');
    if (cachedCalendarId && !foundInList) {
      console.log('ID trouvé en cache mais pas dans la liste. Tentative de ré-inscription...');
      
      // Vérifier d'abord que le calendrier existe toujours
      let calendarExists = false;
      try {
        await window.gapi.client.calendar.calendars.get({
          calendarId: cachedCalendarId
        });
        calendarExists = true;
        console.log('Le calendrier existe toujours, tentative de ré-abonnement...');
      } catch (error: any) {
        if (error?.status === 404) {
          console.log('Le calendrier n\'existe plus, il faut le recréer');
        } else {
          console.error('Erreur lors de la vérification du calendrier:', error);
        }
      }

      // Si le calendrier existe, essayer de se ré-abonner
      if (calendarExists) {
        try {
          // Ré-ajouter le calendrier à la liste
          await window.gapi.client.calendar.calendarList.insert({
            resource: {
              id: cachedCalendarId
            }
          });
          console.log('Ré-abonnement réussi');

          // Mettre à jour les paramètres d'affichage
          try {
            await window.gapi.client.calendar.calendarList.update({
              calendarId: cachedCalendarId,
              colorRgbFormat: true,
              resource: {
                backgroundColor: PLANIDOCS_CALENDAR_COLOR,
                foregroundColor: '#ffffff',
                selected: true
              }
            });
          } catch (colorError) {
            console.warn('Impossible de mettre à jour les couleurs:', colorError);
          }

          this.planiDocsCalendarId = cachedCalendarId;
          return cachedCalendarId;
        } catch (error) {
          console.error('Impossible de se ré-abonner au calendrier:', error);
          localStorage.removeItem('planidocs_calendar_id');
        }
      } else {
        localStorage.removeItem('planidocs_calendar_id');
      }
    }

    // ÉTAPE 3: Créer un nouveau calendrier
    console.log('Création d\'un nouveau calendrier Gardes-SOS...');
    try {
      const newCalendar = await window.gapi.client.calendar.calendars.insert({
        resource: {
          summary: PLANIDOCS_CALENDAR_NAME,
          description: PLANIDOCS_CALENDAR_DESCRIPTION,
          timeZone: 'Europe/Paris'
        }
      });

      if (newCalendar.result && newCalendar.result.id) {
        console.log('Nouveau calendrier créé avec succès:', newCalendar.result.id);
        
        // Attendre un peu pour que le calendrier soit bien créé
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mettre à jour la couleur du calendrier dans la liste
        try {
          await window.gapi.client.calendar.calendarList.update({
            calendarId: newCalendar.result.id,
            colorRgbFormat: true,
            resource: {
              backgroundColor: PLANIDOCS_CALENDAR_COLOR,
              foregroundColor: '#ffffff',
              selected: true
            }
          });
          console.log('Couleurs et paramètres du calendrier mis à jour');
        } catch (colorError) {
          console.warn('Impossible de mettre à jour les couleurs du calendrier:', colorError);
        }

        this.planiDocsCalendarId = newCalendar.result.id;
        localStorage.setItem('planidocs_calendar_id', newCalendar.result.id);
        console.log('Calendrier PlaniDocs prêt à l\'utilisation');
        return newCalendar.result.id;
      } else {
        console.error('La création du calendrier n\'a pas retourné d\'ID');
        throw new Error('Pas d\'ID de calendrier retourné');
      }
    } catch (error: any) {
      console.error('Erreur lors de la création du calendrier:', error);
      console.error('Détails de l\'erreur:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        details: error?.result?.error
      });
      
      // En cas d'échec, utiliser le calendrier principal
      console.warn('Impossible de créer le calendrier Gardes-SOS. Utilisation du calendrier principal.');
      return 'primary';
    }
  }

  // Convertir les assignments en événements Google Calendar
  private convertAssignmentsToEvents(
    assignments: Record<string, ShiftAssignment>,
    mode: 'grouped' | 'separated' = 'grouped',
    colorId: string = PLANIDOCS_EVENT_COLOR_ID
  ): GoogleCalendarEvent[] {
    if (mode === 'separated') {
      return this.convertAssignmentsToSeparatedEvents(assignments, colorId);
    }
    // Grouper par date
    const eventsByDate = new Map<string, string[]>();
    
    Object.entries(assignments)
      .filter(([_, assignment]) => assignment && assignment.shiftType && assignment.date)
      .forEach(([_, assignment]) => {
        const { date, shiftType } = assignment;
        
        if (!eventsByDate.has(date)) {
          eventsByDate.set(date, []);
        }
        
        eventsByDate.get(date)!.push(shiftType);
      });

    // Créer un événement par jour
    const events: GoogleCalendarEvent[] = [];
    
    eventsByDate.forEach((shiftTypes, date) => {
      // Trier les gardes dans l'ordre M -> AM -> S
      const sortedShifts = this.sortShiftsByPeriod(date, shiftTypes, assignments);
      
      // Date de fin = jour suivant pour événement journée entière
      const endDate = parseParisDate(date);
      endDate.setDate(endDate.getDate() + 1);
      
      events.push({
        summary: sortedShifts.join(' '),
        description: `Gardes PlaniDocs: ${sortedShifts.join(', ')}`,
        start: {
          date: date, // Format YYYY-MM-DD pour journée entière
        },
        end: {
          date: formatParisDate(endDate, 'yyyy-MM-dd'),
        },
        reminders: {
          useDefault: false,
          overrides: [
            {
              method: 'popup',
              minutes: 24 * 60, // 1 jour avant
            },
          ],
        },
        colorId: colorId,
        extendedProperties: {
          private: {
            ...PLANIDOCS_EVENT_PROPERTIES,
            date: date,
            shifts: sortedShifts.join(','),
            eventMode: 'grouped'
          },
        },
      });
    });

    return events;
  }

  // Trier les gardes par période
  private sortShiftsByPeriod(
    date: string, 
    shiftTypes: string[], 
    assignments: Record<string, ShiftAssignment>
  ): string[] {
    const periodOrder = { M: 1, AM: 2, S: 3 };
    
    // Récupérer les types de période pour chaque garde
    const shiftsWithPeriod = shiftTypes.map(shiftType => {
      // Trouver l'assignment correspondant
      const assignment = Object.values(assignments).find(
        a => a.date === date && a.shiftType === shiftType
      );
      return {
        shiftType,
        period: assignment?.type || 'M'
      };
    });

    // Trier par période puis retourner juste les shiftTypes
    return shiftsWithPeriod
      .sort((a, b) => periodOrder[a.period] - periodOrder[b.period])
      .map(s => s.shiftType);
  }

  // Convertir les assignments en événements séparés avec horaires
  private convertAssignmentsToSeparatedEvents(
    assignments: Record<string, ShiftAssignment>,
    colorId: string = PLANIDOCS_EVENT_COLOR_ID
  ): GoogleCalendarEvent[] {
    const events: GoogleCalendarEvent[] = [];
    
    // Définir les horaires pour chaque période
    const periodHours: Record<string, { start: string; end: string }> = {
      M: { start: '07:00:00', end: '12:59:59' },   // 7h00 - 12h59
      AM: { start: '13:00:00', end: '17:59:59' },  // 13h00 - 17h59
      S: { start: '18:00:00', end: '23:59:59' }    // 18h00 - 23h59
    };

    Object.entries(assignments)
      .filter(([_, assignment]) => assignment && assignment.shiftType && assignment.date && assignment.type)
      .forEach(([_, assignment]) => {
        const { date, type, shiftType } = assignment;
        const hours = periodHours[type];
        
        // Vérifier que la période est valide
        if (!hours) {
          console.warn(`Période invalide: ${type} pour l'assignment`, assignment);
          return;
        }
        
        events.push({
          summary: shiftType,
          description: `Garde PlaniDocs: ${shiftType} (${type === 'M' ? 'Matin' : type === 'AM' ? 'Après-midi' : 'Soir'})`,
          start: {
            dateTime: `${date}T${hours.start}`,
            timeZone: 'Europe/Paris'
          },
          end: {
            dateTime: `${date}T${hours.end}`,
            timeZone: 'Europe/Paris'
          },
          reminders: {
            useDefault: false,
            overrides: [
              {
                method: 'popup',
                minutes: 24 * 60, // 1 jour avant
              },
            ],
          },
          colorId: colorId,
          extendedProperties: {
            private: {
              ...PLANIDOCS_EVENT_PROPERTIES,
              date: date,
              period: type,
              shiftType: shiftType,
              eventMode: 'separated'
            },
          },
        });
      });

    return events;
  }


  // Récupérer tous les événements PlaniDocs
  async getPlaniDocsEvents(
    startDate?: Date,
    endDate?: Date
  ): Promise<GoogleCalendarEvent[]> {
    await this.ensureAuthenticated();
    const calendarId = await this.getOrCreatePlaniDocsCalendar();

    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId,
        timeMin: startDate ? formatParisDate(startDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : undefined,
        timeMax: endDate ? formatParisDate(endDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : undefined,
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
        // Rechercher uniquement les événements avec nos propriétés étendues
        privateExtendedProperty: `source=${PLANIDOCS_EVENT_PROPERTIES.source}`,
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  // Récupérer TOUS les événements du calendrier (pas seulement PlaniDocs)
  async getAllCalendarEvents(
    startDate?: Date,
    endDate?: Date
  ): Promise<GoogleCalendarEvent[]> {
    await this.ensureAuthenticated();
    const calendarId = await this.getOrCreatePlaniDocsCalendar();

    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId,
        timeMin: startDate ? formatParisDate(startDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : undefined,
        timeMax: endDate ? formatParisDate(endDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : undefined,
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
        // Pas de filtre sur les propriétés étendues - on veut TOUS les événements
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Error fetching all calendar events:', error);
      return [];
    }
  }

  // Récupérer les événements PlaniDocs du calendrier principal (pour migration)
  async getPlaniDocsEventsFromPrimary(
    startDate?: Date,
    endDate?: Date
  ): Promise<GoogleCalendarEvent[]> {
    await this.ensureAuthenticated();

    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary', // Toujours chercher dans le principal
        timeMin: startDate ? formatParisDate(startDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : undefined,
        timeMax: endDate ? formatParisDate(endDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : undefined,
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
        // Rechercher uniquement les événements avec nos propriétés étendues
        privateExtendedProperty: `source=${PLANIDOCS_EVENT_PROPERTIES.source}`,
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Error fetching PlaniDocs events from primary calendar:', error);
      return [];
    }
  }

  // Extraire la date et créer une clé d'assignment selon le mode
  private extractDateAndKey(event: GoogleCalendarEvent): { date: string; assignmentKey: string } {
    // Vérifier si c'est un événement en mode séparé (avec dateTime)
    if (event.start.dateTime) {
      const date = event.start.dateTime.split('T')[0];
      const period = event.extendedProperties?.private?.period || '';
      // Pour le mode séparé, inclure la période dans la clé
      return { 
        date, 
        assignmentKey: period ? `${date}-${period}` : date 
      };
    }
    
    // Mode groupé (avec date)
    const date = event.start.date || '';
    return { date, assignmentKey: date };
  }

  // Comparer si deux titres d'événements contiennent les mêmes gardes
  private areShiftsEquivalent(
    title1: string, 
    title2: string,
    event1Mode?: 'grouped' | 'separated',
    event2Mode?: 'grouped' | 'separated'
  ): boolean {
    // Normaliser et extraire les codes de garde
    const extractShifts = (title: string) => {
      // Supprimer les caractères spéciaux et diviser par espaces
      return title
        .replace(/[^\w\s]/g, '') // Supprimer ponctuation
        .split(/\s+/) // Diviser par espaces
        .filter(s => s.length > 0) // Filtrer les chaînes vides
        .map(s => s.toUpperCase()) // Normaliser en majuscules
        .sort(); // Trier pour comparaison
    };

    const shifts1 = extractShifts(title1);
    const shifts2 = extractShifts(title2);

    // Si les deux sont dans le même mode, comparer directement
    if (event1Mode === event2Mode) {
      return JSON.stringify(shifts1) === JSON.stringify(shifts2);
    }

    // Si modes différents, comparer plus intelligemment
    // Par exemple, "ML CA" (groupé) devrait matcher "ML" et "CA" (séparés) sur la même date
    // Cette comparaison sera faite au niveau de la date dans la méthode appelante
    
    // Pour l'instant, on compare juste les gardes individuelles
    return JSON.stringify(shifts1) === JSON.stringify(shifts2);
  }

  // Extraire toutes les gardes d'une date donnée pour un ensemble d'événements
  private extractShiftsForDate(events: GoogleCalendarEvent[], date: string): Set<string> {
    const shifts = new Set<string>();
    
    events.forEach(event => {
      const eventDate = this.extractDateAndKey(event).date;
      if (eventDate === date && event.summary) {
        // Extraire les gardes du titre
        const eventShifts = event.summary
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(s => s.length > 0)
          .map(s => s.toUpperCase());
        
        eventShifts.forEach(shift => shifts.add(shift));
      }
    });
    
    return shifts;
  }

  // Trouver TOUS les événements PlaniDocs à supprimer (doublons et conflits cross-mode)
  private findAllPlaniDocsEventsToDelete(
    currentEvents: GoogleCalendarEvent[],
    eventMode: 'grouped' | 'separated',
    planiDocsEvents: GoogleCalendarEvent[]
  ): Set<string> {
    const eventsToDelete = new Set<string>();
    
    // Grouper les événements PlaniDocs par date
    const planiDocsEventsByDate = new Map<string, GoogleCalendarEvent[]>();
    planiDocsEvents.forEach(event => {
      const { date } = this.extractDateAndKey(event);
      if (!planiDocsEventsByDate.has(date)) {
        planiDocsEventsByDate.set(date, []);
      }
      planiDocsEventsByDate.get(date)!.push(event);
    });
    
    // Pour chaque date où on veut synchroniser
    currentEvents.forEach(currentEvent => {
      const { date } = this.extractDateAndKey(currentEvent);
      const eventsOnDate = planiDocsEventsByDate.get(date) || [];
      
      if (eventsOnDate.length === 0) return;
      
      // Extraire les gardes qu'on veut pour cette date
      const targetShifts = new Set<string>();
      if (currentEvent.summary) {
        currentEvent.summary
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(s => s.length > 0)
          .map(s => s.toUpperCase())
          .forEach(shift => targetShifts.add(shift));
      }
      
      // Grouper les événements existants par mode et contenu
      const groupedEvents = new Map<string, GoogleCalendarEvent[]>();
      
      eventsOnDate.forEach(event => {
        if (!event.id) return;
        
        const existingMode = event.extendedProperties?.private?.eventMode === 'separated' 
          ? 'separated' 
          : 'grouped';
        
        // Créer une clé unique basée sur le mode et les gardes
        const shifts = event.summary ? 
          event.summary
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(s => s.length > 0)
            .map(s => s.toUpperCase())
            .sort()
            .join(',') : '';
        
        const key = `${existingMode}:${shifts}`;
        
        if (!groupedEvents.has(key)) {
          groupedEvents.set(key, []);
        }
        groupedEvents.get(key)!.push(event);
      });
      
      // Pour chaque groupe d'événements identiques
      groupedEvents.forEach((events, key) => {
        const [mode, shiftsStr] = key.split(':');
        const existingShifts = new Set(shiftsStr ? shiftsStr.split(',') : []);
        
        // Si c'est un mode différent avec les mêmes gardes, tous doivent être supprimés
        if (mode !== eventMode && 
            targetShifts.size === existingShifts.size &&
            [...targetShifts].every(shift => existingShifts.has(shift))) {
          events.forEach(event => {
            if (event.id) eventsToDelete.add(event.id);
          });
        }
        // Si c'est le même mode et les mêmes gardes, garder seulement le plus récent
        else if (mode === eventMode && 
                 targetShifts.size === existingShifts.size &&
                 [...targetShifts].every(shift => existingShifts.has(shift))) {
          // Trier par date de création (ou ID comme proxy)
          const sortedEvents = [...events].sort((a, b) => {
            // Utiliser l'ID comme proxy de l'ordre de création
            return (b.id || '').localeCompare(a.id || '');
          });
          
          // Marquer tous sauf le premier pour suppression
          for (let i = 1; i < sortedEvents.length; i++) {
            const eventId = sortedEvents[i].id;
            if (eventId) {
              eventsToDelete.add(eventId);
              console.log(`Doublon PlaniDocs détecté: "${sortedEvents[i].summary}" le ${date}, marqué pour suppression`);
            }
          }
        }
      });
    });
    
    return eventsToDelete;
  }

  // Supprimer un événement
  async deleteEvent(eventId: string): Promise<boolean | 'rate_limited' | 'already_deleted'> {
    await this.ensureAuthenticated();
    const calendarId = await this.getOrCreatePlaniDocsCalendar();

    try {
      await window.gapi.client.calendar.events.delete({
        calendarId,
        eventId: eventId,
      });
      return true;
    } catch (error: any) {
      // Ignorer les erreurs 410 (Gone) - l'événement a déjà été supprimé
      if (error?.status === 410 || error?.result?.error?.code === 410) {
        // Ne pas logger pour réduire le bruit dans la console
        return 'already_deleted'; // Retourner un statut spécifique
      }
      
      // Gérer les erreurs de rate limiting
      if (error?.status === 403 || error?.result?.error?.code === 403) {
        console.warn(`Rate limit reached for event ${eventId}`);
        return 'rate_limited';
      }
      
      console.error('Error deleting event:', error);
      return false;
    }
  }

  // Mettre à jour un événement
  async updateEvent(
    eventId: string,
    event: GoogleCalendarEvent
  ): Promise<boolean> {
    await this.ensureAuthenticated();
    const calendarId = await this.getOrCreatePlaniDocsCalendar();

    try {
      await window.gapi.client.calendar.events.update({
        calendarId,
        eventId: eventId,
        resource: event,
      });
      return true;
    } catch (error) {
      console.error('Error updating event:', error);
      return false;
    }
  }


  // Synchronisation intelligente avec détection de doublons
  async smartSyncWithDuplicateDetection(
    userId: string,
    assignments: Record<string, ShiftAssignment>,
    associationId?: string,
    detectDuplicates: boolean = true,
    eventMode: 'grouped' | 'separated' = 'grouped',
    colorId: string = PLANIDOCS_EVENT_COLOR_ID,
    onProgress?: (progress: { current: number; total: number; message: string; phase: 'analyzing' | 'migrating' | 'creating' | 'updating' | 'deleting' | 'finalizing' }) => void
  ): Promise<GoogleCalendarSyncResult & { duplicatesFound?: number }> {
    await this.ensureAuthenticated();
    const calendarId = await this.getOrCreatePlaniDocsCalendar();

    const result: GoogleCalendarSyncResult & { duplicatesFound?: number } = {
      created: 0,
      updated: 0,
      deleted: 0,
      converted: 0,
      migrated: 0,
      errors: [],
      duplicatesFound: 0,
      createdEvents: [],
      updatedEvents: [],
      deletedEvents: [],
      convertedEvents: [],
      migratedEvents: [],
    };

    try {
      // Phase 1: Analyse des calendriers
      onProgress?.({ current: 0, total: 100, message: 'Analyse des calendriers...', phase: 'analyzing' });
      
      // 1. Récupérer les enregistrements de synchronisation existants
      const syncRecords = await getUserSyncRecords(userId, associationId);
      const syncRecordsMap = new Map(
        syncRecords.map(r => [r.assignmentKey, r])
      );
      
      onProgress?.({ current: 5, total: 100, message: 'Analyse des calendriers...', phase: 'analyzing' });

      // 2. Récupérer TOUS les événements du calendrier si détection activée
      let allEvents: GoogleCalendarEvent[] = [];
      const existingEventsByDate = new Map<string, GoogleCalendarEvent[]>();
      
      if (detectDuplicates) {
        // Calculer la plage de dates à vérifier
        const dates = Object.values(assignments).map(a => new Date(a.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        
        // Ajouter une marge de sécurité
        minDate.setDate(minDate.getDate() - 1);
        maxDate.setDate(maxDate.getDate() + 1);
        
        allEvents = await this.getAllCalendarEvents(minDate, maxDate);
        
        // Grouper les événements par date pour recherche rapide
        allEvents.forEach(event => {
          const { date: dateKey } = this.extractDateAndKey(event);
          if (dateKey) {
            if (!existingEventsByDate.has(dateKey)) {
              existingEventsByDate.set(dateKey, []);
            }
            existingEventsByDate.get(dateKey)!.push(event);
          }
        });
      }

      // 3. Récupérer les événements PlaniDocs
      onProgress?.({ current: 10, total: 100, message: 'Récupération des événements PlaniDocs...', phase: 'analyzing' });
      const planiDocsEvents = await this.getPlaniDocsEvents();
      const planiDocsEventsMap = new Map(
        planiDocsEvents.map(e => [e.id!, e])
      );
      
      onProgress?.({ current: 15, total: 100, message: 'Analyse des événements...', phase: 'analyzing' });

      // 3.5 Détecter et migrer les événements du calendrier principal
      let primaryCalendarEvents: GoogleCalendarEvent[] = [];
      const eventsToMigrate: string[] = [];
      
      // Vérifier si on doit chercher dans le calendrier principal
      if (calendarId !== 'primary') {
        onProgress?.({ current: 20, total: 100, message: 'Recherche des événements à migrer...', phase: 'analyzing' });
        // Calculer la plage de dates pour la recherche
        const dates = Object.values(assignments).map(a => new Date(a.date));
        const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;
        
        if (minDate && maxDate) {
          // Ajouter une marge de sécurité
          minDate.setDate(minDate.getDate() - 1);
          maxDate.setDate(maxDate.getDate() + 1);
          
          // Récupérer les événements PlaniDocs du calendrier principal
          primaryCalendarEvents = await this.getPlaniDocsEventsFromPrimary(minDate, maxDate);
          console.log(`Trouvé ${primaryCalendarEvents.length} événement(s) PlaniDocs dans le calendrier principal`);
          
          // Identifier les événements à migrer (ceux qui correspondent aux assignments actuels)
          primaryCalendarEvents.forEach(primaryEvent => {
            const { date: eventDate } = this.extractDateAndKey(primaryEvent);
            
            // Vérifier si cet événement correspond à un assignment actuel
            const hasMatchingAssignment = Object.entries(assignments).some(([key, assignment]) => {
              // Extraire la date de la clé
              const assignmentDate = assignment.date;
              
              // Vérifier si les dates correspondent
              if (assignmentDate !== eventDate) return false;
              
              // Vérifier si les gardes correspondent (dans le summary)
              const eventShifts = primaryEvent.summary?.split(/\s+/).filter(s => s).map(s => s.toUpperCase()).sort().join(',') || '';
              const assignmentShifts = assignment.shiftType?.toUpperCase() || '';
              
              // Pour le mode groupé, plusieurs gardes peuvent être dans le summary
              return eventShifts.includes(assignmentShifts);
            });
            
            if (hasMatchingAssignment && primaryEvent.id) {
              eventsToMigrate.push(primaryEvent.id);
            }
          });
          
          console.log(`${eventsToMigrate.length} événement(s) à migrer du calendrier principal`);
        }
      }

      // 4. Convertir les assignments actuels en événements
      const currentEvents = this.convertAssignmentsToEvents(assignments, eventMode, colorId);
      let toCreate: GoogleCalendarEvent[] = [];
      const toUpdate: Array<{ eventId: string; event: GoogleCalendarEvent }> = [];
      let toDelete: Array<{ eventId: string; syncRecord: CalendarSyncRecord }> = [];
      const newSyncRecords: CalendarSyncRecord[] = [];

      // 4.5 Détecter TOUS les événements PlaniDocs à supprimer (doublons et conflits)
      const eventsToDelete = this.findAllPlaniDocsEventsToDelete(
        currentEvents,
        eventMode,
        planiDocsEvents
      );
      
      console.log(`Trouvé ${eventsToDelete.size} événement(s) PlaniDocs à supprimer`);
      
      // Ajouter tous les événements à supprimer à la liste
      eventsToDelete.forEach(eventId => {
        // Vérifier qu'on n'a pas déjà marqué cet événement pour suppression
        if (toDelete.some(d => d.eventId === eventId)) {
          return;
        }
        
        const syncRecord = syncRecords.find(r => r.googleEventId === eventId);
        if (syncRecord) {
          toDelete.push({
            eventId,
            syncRecord,
          });
        } else {
          // Créer un sync record temporaire pour la suppression
          const eventToDelete = planiDocsEvents.find(e => e.id === eventId);
          if (eventToDelete) {
            const { date, assignmentKey } = this.extractDateAndKey(eventToDelete);
            toDelete.push({
              eventId,
              syncRecord: {
                userId,
                assignmentKey,
                googleEventId: eventId,
                lastSyncedAt: createParisDate(),
                eventData: {
                  date,
                  shiftTypes: eventToDelete.summary?.split(' ') || [],
                },
              },
            });
          }
        }
      });

      // 5. Analyser chaque événement actuel
      currentEvents.forEach(event => {
        const { date: dateKey, assignmentKey } = this.extractDateAndKey(event);
        const existingSyncRecord = syncRecords.find(
          r => r.assignmentKey === assignmentKey
        );

        // Vérifier les doublons potentiels
        let isDuplicate = false;
        let duplicateEvent: GoogleCalendarEvent | null = null;

        if (detectDuplicates && existingEventsByDate.has(dateKey)) {
          const eventsOnDate = existingEventsByDate.get(dateKey)!;
          
          // Chercher un événement avec les mêmes gardes
          duplicateEvent = eventsOnDate.find(e => {
            // Ignorer les événements PlaniDocs (ils sont gérés par la sync normale)
            if (e.extendedProperties?.private?.source === PLANIDOCS_EVENT_PROPERTIES.source) {
              return false;
            }
            
            // Comparer les titres
            return e.summary && event.summary && 
                   this.areShiftsEquivalent(e.summary, event.summary);
          }) || null;
          
          isDuplicate = duplicateEvent !== null;
        }

        if (isDuplicate && duplicateEvent) {
          result.duplicatesFound!++;
          console.log(`Doublon détecté pour ${dateKey}: "${duplicateEvent.summary}"`);
          
          // Optionnel : Adopter l'événement existant en ajoutant les propriétés PlaniDocs
          if (duplicateEvent.id) {
            // Mettre à jour l'événement pour ajouter les propriétés PlaniDocs
            const updatedEvent = {
              ...duplicateEvent,
              extendedProperties: {
                ...duplicateEvent.extendedProperties,
                private: {
                  ...duplicateEvent.extendedProperties?.private,
                  ...PLANIDOCS_EVENT_PROPERTIES,
                  date: dateKey,
                  shifts: event.summary.split(' ').join(','),
                },
              },
            };
            
            toUpdate.push({
              eventId: duplicateEvent.id,
              event: updatedEvent,
            });
            
            // Créer un sync record pour cet événement adopté
            newSyncRecords.push({
              userId,
              assignmentKey: assignmentKey,
              googleEventId: duplicateEvent.id,
              lastSyncedAt: createParisDate(),
              eventData: {
                date: dateKey,
                shiftTypes: event.summary.split(' '),
              },
            });
          }
        } else if (existingSyncRecord) {
          // Logique existante pour les événements déjà synchronisés
          const googleEvent = planiDocsEventsMap.get(existingSyncRecord.googleEventId);
          
          if (googleEvent) {
            const hasChanged = 
              googleEvent.summary !== event.summary ||
              googleEvent.colorId !== event.colorId ||
              JSON.stringify(googleEvent.extendedProperties?.private?.shifts) !== 
              JSON.stringify(event.extendedProperties?.private?.shifts);

            if (hasChanged) {
              toUpdate.push({
                eventId: existingSyncRecord.googleEventId,
                event: { ...event, id: existingSyncRecord.googleEventId },
              });
            }
            // Si pas de changement, on ne fait rien (évite les doublons)
          } else {
            // L'événement n'existe plus dans Google mais on a un sync record
            // Vérifier s'il n'a pas été marqué pour suppression
            if (!eventsToDelete.has(existingSyncRecord.googleEventId)) {
              toCreate.push(event);
            }
          }
        } else {
          // Nouvel événement à créer
          // Mais d'abord vérifier qu'un événement PlaniDocs identique n'existe pas déjà
          const existingPlaniDocsEvent = planiDocsEvents.find(e => {
            const { date: existingDate } = this.extractDateAndKey(e);
            const existingMode = e.extendedProperties?.private?.eventMode === 'separated' 
              ? 'separated' 
              : 'grouped';
            
            // Même date, même mode, mêmes gardes
            return existingDate === dateKey &&
                   existingMode === eventMode &&
                   e.summary === event.summary &&
                   !eventsToDelete.has(e.id!); // Et pas marqué pour suppression
          });
          
          if (!existingPlaniDocsEvent) {
            toCreate.push(event);
          } else {
            console.log(`Événement PlaniDocs identique déjà existant: "${event.summary}" le ${dateKey}, pas de création`);
            // Créer quand même un sync record pour cet événement existant
            if (existingPlaniDocsEvent.id) {
              newSyncRecords.push({
                userId,
                assignmentKey: assignmentKey,
                googleEventId: existingPlaniDocsEvent.id,
                lastSyncedAt: createParisDate(),
                eventData: {
                  date: dateKey,
                  shiftTypes: event.summary.split(' '),
                },
              });
            }
          }
        }
      });

      // Vérifier les événements à supprimer
      syncRecords.forEach(syncRecord => {
        const assignmentKey = syncRecord.assignmentKey;
        const stillExists = currentEvents.some(e => {
          const { assignmentKey: eventKey } = this.extractDateAndKey(e);
          return eventKey === assignmentKey;
        });

        if (!stillExists && planiDocsEventsMap.has(syncRecord.googleEventId)) {
          toDelete.push({
            eventId: syncRecord.googleEventId,
            syncRecord,
          });
        }
      });

      // 5.5 Détecter les conversions de mode AVANT de créer/supprimer
      const conversions = new Map<string, ConvertedEventDetail>();
      const conversionUpdates: Array<{ eventId: string; event: GoogleCalendarEvent }> = [];
      
      // Créer une map des suppressions par date
      const deletesByDate = new Map<string, Array<{ eventId: string; syncRecord: CalendarSyncRecord; mode: 'grouped' | 'separated' }>>();
      toDelete.forEach(({ eventId, syncRecord }) => {
        const date = syncRecord.eventData.date;
        // Récupérer le mode depuis l'événement Google Calendar
        const googleEvent = planiDocsEventsMap.get(eventId);
        const mode = googleEvent?.extendedProperties?.private?.eventMode === 'separated' ? 'separated' : 'grouped';
        if (!deletesByDate.has(date)) {
          deletesByDate.set(date, []);
        }
        deletesByDate.get(date)!.push({ eventId, syncRecord, mode });
      });

      // Créer une map des créations par date
      const createsByDate = new Map<string, Array<{ event: GoogleCalendarEvent; mode: 'grouped' | 'separated' }>>();
      toCreate.forEach(event => {
        const { date } = this.extractDateAndKey(event);
        const mode = event.extendedProperties?.private?.eventMode as 'grouped' | 'separated' || eventMode;
        if (!createsByDate.has(date)) {
          createsByDate.set(date, []);
        }
        createsByDate.get(date)!.push({ event, mode });
      });

      // Identifier les conversions et créer les mises à jour appropriées
      const realDeletes: typeof toDelete = [];
      const realCreates: typeof toCreate = [];
      const convertedDates = new Set<string>();
      
      deletesByDate.forEach((deletes, date) => {
        const creates = createsByDate.get(date);
        if (creates) {
          // Vérifier si c'est une conversion (modes différents)
          const deleteMode = deletes[0].mode;
          const createMode = creates[0].mode;
          
          if (deleteMode !== createMode) {
            // C'est une conversion ! Au lieu de supprimer et recréer, on va mettre à jour
            convertedDates.add(date);
            const shiftTypes = new Set<string>();
            
            // Collecter tous les types de garde
            deletes.forEach(d => {
              d.syncRecord.eventData.shiftTypes.forEach(st => shiftTypes.add(st));
            });
            creates.forEach(c => {
              const shifts = c.event.summary.split(' ');
              shifts.forEach(s => shiftTypes.add(s));
            });
            
            // Créer l'entrée de conversion
            conversions.set(date, {
              date,
              fromMode: deleteMode,
              toMode: createMode,
              shiftType: Array.from(shiftTypes).join(' ')
            });
            
            // Au lieu de supprimer et créer, on va mettre à jour les événements existants
            if (createMode === 'grouped') {
              // De séparé vers groupé : on garde le premier événement et on supprime les autres
              const firstDelete = deletes[0];
              const newEvent = creates[0].event;
              
              // Mettre à jour le premier événement
              conversionUpdates.push({
                eventId: firstDelete.eventId,
                event: { ...newEvent, id: firstDelete.eventId }
              });
              
              // Supprimer les autres événements
              for (let i = 1; i < deletes.length; i++) {
                realDeletes.push({ eventId: deletes[i].eventId, syncRecord: deletes[i].syncRecord });
              }
            } else {
              // De groupé vers séparé : on doit supprimer l'événement groupé et créer les séparés
              // Car on ne peut pas transformer un événement all-day en événement avec horaire
              deletes.forEach(d => realDeletes.push({ eventId: d.eventId, syncRecord: d.syncRecord }));
              creates.forEach(c => realCreates.push(c.event));
            }
          } else {
            // Même mode, ce sont de vraies suppressions/créations
            deletes.forEach(d => realDeletes.push({ eventId: d.eventId, syncRecord: d.syncRecord }));
            creates.forEach(c => realCreates.push(c.event));
          }
        } else {
          // Pas de création pour cette date, vraie suppression
          deletes.forEach(d => realDeletes.push({ eventId: d.eventId, syncRecord: d.syncRecord }));
        }
      });

      // Ajouter les créations sans suppression correspondante
      createsByDate.forEach((creates, date) => {
        if (!deletesByDate.has(date) || !convertedDates.has(date)) {
          creates.forEach(c => realCreates.push(c.event));
        }
      });

      // Ajouter les mises à jour de conversion à la liste des mises à jour
      toUpdate.push(...conversionUpdates);
      
      // Mettre à jour les compteurs et détails
      result.converted = conversions.size;
      if (result.convertedEvents) {
        result.convertedEvents = Array.from(conversions.values());
      }

      // Remplacer les listes originales par les listes filtrées
      toDelete = realDeletes;
      toCreate = realCreates;

      // 6. Appliquer les changements
      // Créer les nouveaux événements
      if (toCreate.length > 0) {
        onProgress?.({ current: 40, total: 100, message: `Création de ${toCreate.length} événement(s)...`, phase: 'creating' });
        const batchSize = 50;
        let createdCount = 0;
        for (let i = 0; i < toCreate.length; i += batchSize) {
          const batch = toCreate.slice(i, i + batchSize);
          const batchRequest = window.gapi.client.newBatch();

          batch.forEach((event, index) => {
            const request = window.gapi.client.calendar.events.insert({
              calendarId,
              resource: event,
            });
            batchRequest.add(request, { id: `create-${i + index}` });
          });

          const batchResponse = await batchRequest;

          Object.keys(batchResponse.result).forEach((key, index) => {
            const response = batchResponse.result[key];
            const event = batch[index];
            
            console.log(`Batch response for ${key}:`, response);
            
            if (!response.error && response.result && response.result.id) {
              result.created++;
              createdCount++;
              
              // Créer l'enregistrement de synchronisation
              const { date: dateKey, assignmentKey } = this.extractDateAndKey(event);
              const googleEventId = response.result.id;
              
              // Ajouter les détails de l'événement créé
              if (result.createdEvents) {
                const period = eventMode === 'separated' && assignmentKey.includes('-') 
                  ? assignmentKey.split('-').pop() as 'M' | 'AM' | 'S' | undefined
                  : undefined;
                
                result.createdEvents.push({
                  date: dateKey,
                  shiftType: event.summary,
                  period,
                  timeSlot: event.start.dateTime ? 'Avec horaire' : 'Journée entière'
                });
              }
              
              // Vérifier que l'ID existe avant de créer le record
              if (googleEventId) {
                newSyncRecords.push({
                  userId,
                  assignmentKey: assignmentKey,
                  googleEventId: googleEventId,
                  lastSyncedAt: createParisDate(),
                  eventData: {
                    date: dateKey,
                    shiftTypes: event.summary.split(' '),
                  },
                });
              } else {
                console.error('No event ID returned for date:', dateKey);
                result.errors.push({
                  date: dateKey,
                  error: 'Pas d\'ID retourné par Google Calendar',
                });
              }
            } else {
              console.error('Failed to create event:', response);
              result.errors.push({
                date: event.start.date || event.start.dateTime?.split('T')[0] || '',
                error: response.error?.message || 'Erreur lors de la création',
              });
            }
          });
          
          // Mise à jour de la progression après chaque batch
          const progressPercent = 40 + Math.round((createdCount / toCreate.length) * 20);
          onProgress?.({ 
            current: progressPercent, 
            total: 100, 
            message: `Création: ${createdCount}/${toCreate.length} événement(s)`, 
            phase: 'creating' 
          });
        }
      }

      // Mettre à jour les événements existants
      if (toUpdate.length > 0) {
        onProgress?.({ current: 60, total: 100, message: `Mise à jour de ${toUpdate.length} événement(s)...`, phase: 'updating' });
      }
      let updatedCount = 0;
      for (const { eventId, event } of toUpdate) {
        // Récupérer l'ancien événement pour comparer
        const oldEvent = planiDocsEventsMap.get(eventId);
        const success = await this.updateEvent(eventId, event);
        if (success) {
          const { date: dateKey, assignmentKey } = this.extractDateAndKey(event);
          
          // Vérifier si c'est une conversion (déjà comptée dans result.converted)
          const isConversion = conversionUpdates.some(cu => cu.eventId === eventId);
          
          if (!isConversion) {
            result.updated++;
            updatedCount++;
            
            // Ajouter les détails de l'événement mis à jour
            if (result.updatedEvents) {
              const period = eventMode === 'separated' && assignmentKey.includes('-') 
                ? assignmentKey.split('-').pop() as 'M' | 'AM' | 'S' | undefined
                : undefined;
              
              result.updatedEvents.push({
                date: dateKey,
                shiftType: event.summary,
                previousShiftType: oldEvent?.summary,
                period,
                timeSlot: event.start.dateTime ? 'Avec horaire' : 'Journée entière'
              });
            }
          }
          
          // Créer ou mettre à jour l'enregistrement de synchronisation
          const existingRecordIndex = newSyncRecords.findIndex(
            r => r.assignmentKey === assignmentKey
          );
          
          if (existingRecordIndex === -1) {
            newSyncRecords.push({
              userId,
              assignmentKey: assignmentKey,
              googleEventId: eventId,
              lastSyncedAt: createParisDate(),
              eventData: {
                date: dateKey,
                shiftTypes: event.summary.split(' '),
              },
            });
          }
        } else {
          result.errors.push({
            date: event.start.date || event.start.dateTime?.split('T')[0] || '',
            error: 'Erreur lors de la mise à jour',
          });
        }
        
        // Mise à jour de la progression
        if (toUpdate.length > 0) {
          const progressPercent = 60 + Math.round((updatedCount / toUpdate.length) * 15);
          onProgress?.({ 
            current: progressPercent, 
            total: 100, 
            message: `Mise à jour: ${updatedCount}/${toUpdate.length} événement(s)`, 
            phase: 'updating' 
          });
        }
      }

      // Supprimer les événements à migrer du calendrier principal
      if (eventsToMigrate.length > 0) {
        console.log(`Migration de ${eventsToMigrate.length} événement(s) du calendrier principal...`);
        onProgress?.({ current: 25, total: 100, message: `Migration de ${eventsToMigrate.length} événement(s)...`, phase: 'migrating' });
        
        let migratedCount = 0;
        for (const eventId of eventsToMigrate) {
          try {
            // Supprimer directement du calendrier principal
            await window.gapi.client.calendar.events.delete({
              calendarId: 'primary',
              eventId: eventId,
            });
            
            result.migrated++;
            migratedCount++;
            
            // Ajouter les détails de l'événement migré
            const migratedEvent = primaryCalendarEvents.find(e => e.id === eventId);
            if (result.migratedEvents && migratedEvent) {
              const { date: eventDate } = this.extractDateAndKey(migratedEvent);
              result.migratedEvents.push({
                date: eventDate,
                shiftType: migratedEvent.summary || '',
                timeSlot: migratedEvent.start.dateTime ? 'Avec horaire' : 'Journée entière'
              });
            }
            
            // Mise à jour de la progression
            const progressPercent = 25 + Math.round((migratedCount / eventsToMigrate.length) * 15);
            onProgress?.({ 
              current: progressPercent, 
              total: 100, 
              message: `Migration: ${migratedCount}/${eventsToMigrate.length} événement(s)`, 
              phase: 'migrating' 
            });
          } catch (error: any) {
            // Ignorer les erreurs 410 (événement déjà supprimé)
            if (error?.status !== 410) {
              console.error(`Erreur lors de la migration de l'événement ${eventId}:`, error);
            }
          }
        }
        
        if (result.migrated > 0) {
          console.log(`${result.migrated} événement(s) migré(s) avec succès`);
        }
      }

      // Supprimer les événements obsolètes par batch avec délai
      if (toDelete.length > 0) {
        console.log(`Suppression de ${toDelete.length} événement(s)...`);
        onProgress?.({ current: 75, total: 100, message: `Suppression de ${toDelete.length} événement(s)...`, phase: 'deleting' });
        
        // Traiter par batch de 5 avec un délai de 1000ms entre chaque batch
        const batchSize = 5;
        const delayBetweenBatches = 1000; // ms
        const rateLimitedEvents: Array<{ eventId: string; syncRecord: CalendarSyncRecord }> = [];
        let deletedCount = 0;
        
        for (let i = 0; i < toDelete.length; i += batchSize) {
          const batch = toDelete.slice(i, i + batchSize);
          
          // Traiter le batch en parallèle
          const deletePromises = batch.map(async ({ eventId, syncRecord }) => {
            const result = await this.deleteEvent(eventId);
            if (result === true || result === 'already_deleted') {
              return { success: true, alreadyDeleted: result === 'already_deleted' };
            } else if (result === 'rate_limited') {
              return { rateLimited: true, eventId, syncRecord };
            } else {
              return {
                success: false,
                error: {
                  date: syncRecord.eventData.date,
                  error: 'Erreur lors de la suppression',
                },
              };
            }
          });
          
          const results = await Promise.all(deletePromises);
          
          // Compter les résultats
          let rateLimitHit = false;
          results.forEach((res, idx) => {
            const { eventId, syncRecord } = batch[idx];
            if (res.success) {
              // Ne compter que les vraies suppressions, pas les événements déjà supprimés
              if (!res.alreadyDeleted) {
                result.deleted++;
                deletedCount++;
                
                // Ajouter les détails de l'événement supprimé
                if (result.deletedEvents && syncRecord) {
                  const date = syncRecord.eventData.date;
                  const shiftType = syncRecord.eventData.shiftTypes.join(' ');
                  // Récupérer le mode depuis l'événement pour déterminer la période
                  const googleEvent = planiDocsEventsMap.get(eventId);
                  const wasInSeparatedMode = googleEvent?.extendedProperties?.private?.eventMode === 'separated';
                  const period = wasInSeparatedMode && syncRecord.assignmentKey.includes('-') 
                    ? syncRecord.assignmentKey.split('-').pop() as 'M' | 'AM' | 'S' | undefined
                    : undefined;
                  
                  result.deletedEvents.push({
                    date,
                    shiftType,
                    period,
                    timeSlot: wasInSeparatedMode ? 'Avec horaire' : 'Journée entière'
                  });
                }
              }
            } else if (res.rateLimited) {
              rateLimitedEvents.push({ eventId: res.eventId, syncRecord: res.syncRecord });
              rateLimitHit = true;
            } else if (res.error) {
              result.errors.push(res.error);
            }
          });
          
          // Mise à jour de la progression après chaque batch
          const progressPercent = 75 + Math.round((deletedCount / toDelete.length) * 20);
          onProgress?.({ 
            current: progressPercent, 
            total: 100, 
            message: `Suppression: ${deletedCount}/${toDelete.length} événement(s)`, 
            phase: 'deleting' 
          });
          
          // Si on a atteint la limite, augmenter le délai
          if (rateLimitHit) {
            console.log('Rate limit atteint, pause prolongée de 3 secondes...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else if (i + batchSize < toDelete.length) {
            // Attendre avant le prochain batch normal
            console.log(`Batch ${Math.floor(i / batchSize) + 1} terminé, pause de ${delayBetweenBatches}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          }
        }
        
        // Réessayer les événements rate limited après une pause plus longue
        if (rateLimitedEvents.length > 0) {
          console.log(`${rateLimitedEvents.length} événement(s) en attente à cause du rate limit. Nouvelle tentative dans 5 secondes...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Réessayer un par un avec des pauses
          for (const { eventId, syncRecord } of rateLimitedEvents) {
            const deleteResult = await this.deleteEvent(eventId);
            if (deleteResult === true) {
              result.deleted++;
              
              // Ajouter les détails de l'événement supprimé
              if (result.deletedEvents && syncRecord) {
                const date = syncRecord.eventData.date;
                const shiftType = syncRecord.eventData.shiftTypes.join(' ');
                // Récupérer le mode depuis l'événement pour déterminer la période
                const googleEvent = planiDocsEventsMap.get(eventId);
                const wasInSeparatedMode = googleEvent?.extendedProperties?.private?.eventMode === 'separated';
                const period = wasInSeparatedMode && syncRecord.assignmentKey.includes('-') 
                  ? syncRecord.assignmentKey.split('-').pop() as 'M' | 'AM' | 'S' | undefined
                  : undefined;
                
                result.deletedEvents.push({
                  date,
                  shiftType,
                  period,
                  timeSlot: wasInSeparatedMode ? 'Avec horaire' : 'Journée entière'
                });
              }
            } else if (deleteResult === 'already_deleted') {
              // Ne rien faire, l'événement était déjà supprimé
            } else if (deleteResult !== 'rate_limited') {
              result.errors.push({
                date: syncRecord.eventData.date,
                error: 'Erreur lors de la suppression (2ème tentative)',
              });
            }
            // Petite pause entre chaque tentative
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      // 7. Sauvegarder les enregistrements de synchronisation
      onProgress?.({ current: 95, total: 100, message: 'Finalisation...', phase: 'finalizing' });
      
      if (newSyncRecords.length > 0) {
        // Filtrer les records invalides (sans googleEventId)
        const validSyncRecords = newSyncRecords.filter(record => {
          if (!record.googleEventId || !record.userId || !record.assignmentKey) {
            console.error('Invalid sync record:', record);
            return false;
          }
          return true;
        });
        
        if (validSyncRecords.length > 0) {
          await saveSyncRecordsBatch(validSyncRecords, associationId);
        }
      }

      // Supprimer les enregistrements des événements supprimés
      if (toDelete.length > 0) {
        const recordsToDelete = toDelete.map(({ syncRecord }) => ({
          userId: syncRecord.userId,
          assignmentKey: syncRecord.assignmentKey,
        }));
        await deleteSyncRecordsBatch(recordsToDelete, associationId);
      }

      // Progression terminée
      onProgress?.({ current: 100, total: 100, message: 'Synchronisation terminée', phase: 'finalizing' });
      
      return result;
    } catch (error) {
      console.error('Smart sync with duplicate detection error:', error);
      throw error;
    }
  }
}

// Export une instance unique
export const googleCalendarService = new GoogleCalendarService();