import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/hooks';
import { Notification } from '../../components/common/NotificationBell';
import { 
  getNotificationsForUser, 
  markNotificationAsRead, 
  markAllNotificationsAsRead as markAllAsReadFirebase,
  addNotification as addNotificationFirebase,
  NotificationType
} from '../../lib/firebase/notifications';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";

/**
 * Type pour le contexte de notifications
 */
interface NotificationContextType {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Hook pour accéder au contexte de notifications
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

/**
 * Provider pour le contexte de notifications
 * Gère les notifications de l'utilisateur
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les notifications de l'utilisateur
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Utiliser onSnapshot pour obtenir les mises à jour en temps réel
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationsList: Notification[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          notificationsList.push({
            id: doc.id,
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type,
            read: data.read,
            createdAt: data.createdAt.toDate().toISOString(),
            relatedId: data.relatedId,
            link: data.link
          });
        });
        setNotifications(notificationsList);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading notifications:', err);
        setError('Erreur lors du chargement des notifications');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /**
   * Ajouter une notification
   * @param notification - La notification à ajouter
   */
  const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    if (!user) return;

    try {
      // Convertir le type de notification en NotificationType
      let notificationType: NotificationType;
      switch (notification.type) {
        case 'exchange':
          notificationType = NotificationType.EXCHANGE_PROPOSED;
          break;
        case 'give':
          notificationType = NotificationType.GIVE_PROPOSED;
          break;
        case 'interested':
          notificationType = NotificationType.INTERESTED_USER;
          break;
        case 'accepted':
          notificationType = NotificationType.EXCHANGE_ACCEPTED;
          break;
        case 'rejected':
          notificationType = NotificationType.EXCHANGE_REJECTED;
          break;
        case 'completed':
          notificationType = NotificationType.EXCHANGE_COMPLETED;
          break;
        case 'system':
        default:
          notificationType = NotificationType.SYSTEM;
          break;
      }

      await addNotificationFirebase({
        ...notification,
        type: notificationType
      });
    } catch (err) {
      console.error('Error adding notification:', err);
      setError('Erreur lors de l\'ajout de la notification');
    }
  };

  /**
   * Marquer une notification comme lue
   * @param notificationId - L'identifiant de la notification
   */
  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      await markNotificationAsRead(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Erreur lors de la mise à jour de la notification');
    }
  };

  /**
   * Marquer toutes les notifications comme lues
   */
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await markAllAsReadFirebase(user.id);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Erreur lors de la mise à jour des notifications');
    }
  };

  const value = {
    notifications,
    loading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
