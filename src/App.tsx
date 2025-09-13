import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
// import Navbar from './components/Navbar';
import ModernNavbar from './components/ModernNavbar';
import { ProtectedRoute, FeatureProtectedRoute } from './features/auth';
import { FEATURES } from './types/featureFlags';
import { PlanningProvider } from './context/planning';
import { UserProvider } from './context/auth';
import { BagPhaseProvider, ShiftExchangeProvider } from './context/shiftExchange';
import { PlanningPeriodProvider } from './context/planning';
import { NotificationProvider } from './context/notifications';
import { ExchangeProvider } from './context/exchange';
import { ConnectionStatus, LoadingSpinner } from './components/common';
import { AssociationProvider } from './context/association/AssociationContext';
import { FeatureFlagsProvider } from './context/featureFlags/FeatureFlagsContext';
import { SuperAdminProvider } from './context/superAdmin/SuperAdminContext';
import NotificationPermissionManager from './components/notifications/NotificationPermissionManager';
import WelcomeNotificationPrompt from './components/notifications/WelcomeNotificationPrompt';
import { ToastProvider } from './context/toast';
import { GoogleCalendarProvider } from './context/googleCalendar/GoogleCalendarContext';
import { DirectExchangeProvider } from './context/directExchange/DirectExchangeContext';

// Import des utilitaires de debug (développement uniquement)
import './utils/debugShiftExchanges';
import './utils/exchangeHistoryDiagnostic';
import './utils/migrateExchangeHistory';

// Import des outils de test des notifications en développement
if (import.meta.env.DEV) {
  import('./utils/testNotifications').then(() => {
    console.log('🔧 Outils de test des notifications chargés - utilisez testNotifications.test() ou testNotifications.checkStatus()');
  });
  
  import('./utils/fcmTokenManager').then(() => {
    console.log('🔧 FCM Token Manager chargé - utilisez fcmManager.help() pour l\'aide');
  });
}

// Import des pages critiques directement (utiles dès le début)
import LoginPage from './features/auth/pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Importations dynamiques des pages moins critiques
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const UserPage = lazy(() => import('./features/users/pages/UserPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const UserPlanningPage = lazy(() => import('./features/planning/pages/UserPlanningPage'));
const GeneratedPlanningPage = lazy(() => import('./features/planning/pages/GeneratedPlanningPage'));
const UsersManagementPage = lazy(() => import('./pages/UsersManagementPage'));
const PlanningPreviewPage = lazy(() => import('./features/planning/pages/PlanningPreviewPage'));
const ReplacementsPage = lazy(() => import('./pages/ReplacementsPage'));
const DirectExchangePage = lazy(() => import('./features/directExchange/pages/DirectExchangePage'));
const HistoryPage = lazy(() => import('./features/history/pages/HistoryPage'));

// Import des pages migrées
const ShiftExchangePage = lazy(() => import('./features/shiftExchange/pages/ShiftExchangePage'));
const AdminShiftExchangePage = lazy(() => import('./features/shiftExchange/pages/AdminShiftExchangePage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
// const AllPlanningsPage = lazy(() => import('./pages/AllPlanningsPage')); // Désactivé temporairement

const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <AssociationProvider>
          <GoogleCalendarProvider>
            <UserProvider>
              <SuperAdminProvider>
                <FeatureFlagsProvider>
                  <PlanningProvider>
                    <BagPhaseProvider>
                      <PlanningPeriodProvider>
                        <NotificationProvider>
                          <ExchangeProvider>
                            <DirectExchangeProvider>
                              <ShiftExchangeProvider>
                  <Routes>
                    {/* Routes publiques accessibles sans authentification */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/terms" element={
                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                        <TermsPage />
                      </Suspense>
                    } />
                    <Route path="/privacy" element={
                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                        <PrivacyPage />
                      </Suspense>
                    } />

                    {/* Routes protégées nécessitant une authentification */}
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <div className="min-h-screen bg-gray-100 max-w-screen overflow-x-hidden">
                            {/* Ne pas afficher la navbar sur le dashboard */}
                            <Routes>
                              <Route path="/dashboard" element={null} />
                              <Route path="*" element={<ModernNavbar />} />
                            </Routes>
                            <Routes>
                              <Route 
                                path="/admin" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin', 'isManager']}>
                                    <FeatureProtectedRoute feature={FEATURES.ADMIN_DESIDERATA}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <AdminPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/dashboard" 
                                element={<DashboardPage />} 
                              />
                              <Route 
                                path="/generated-planning" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <FeatureProtectedRoute feature={FEATURES.GENERATED_PLANNING}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <GeneratedPlanningPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/users" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <FeatureProtectedRoute feature={FEATURES.USER_MANAGEMENT}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <UsersManagementPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/admin-shift-exchange" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <FeatureProtectedRoute feature={FEATURES.ADMIN_SHIFT_EXCHANGE}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <AdminShiftExchangePage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/validated-plannings" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <Navigate to="/admin?tab=validated-plannings" replace />
                                    </Suspense>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/remplacements" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <FeatureProtectedRoute feature={FEATURES.REPLACEMENTS}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <ReplacementsPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/planning/:userId" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <PlanningPreviewPage />
                                    </Suspense>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/user" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <FeatureProtectedRoute feature={FEATURES.DESIDERATA}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <UserPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/planning" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <FeatureProtectedRoute feature={FEATURES.PLANNING}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <UserPlanningPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/shift-exchange" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <FeatureProtectedRoute feature={FEATURES.SHIFT_EXCHANGE}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <ShiftExchangePage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/direct-exchange" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <FeatureProtectedRoute feature={FEATURES.DIRECT_EXCHANGE}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <DirectExchangePage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/history" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <FeatureProtectedRoute feature={FEATURES.HISTORY}>
                                      <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                        <HistoryPage />
                                      </Suspense>
                                    </FeatureProtectedRoute>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/profile" 
                                element={
                                  <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                    <ProfilePage />
                                  </Suspense>
                                } 
                              />
                              <Route 
                                path="/super-admin" 
                                element={
                                  <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                    <SuperAdminPage />
                                  </Suspense>
                                } 
                              />
                              {/* Route désactivée temporairement
                              <Route 
                                path="/all-plannings" 
                                element={
                                  <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                    <AllPlanningsPage />
                                  </Suspense>
                                } 
                              />
                              */}
                              <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                            <ConnectionStatus />
                            {/* Gestionnaire de permissions pour les notifications push */}
                            <NotificationPermissionManager />
                            <WelcomeNotificationPrompt />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                              </ShiftExchangeProvider>
                            </DirectExchangeProvider>
                          </ExchangeProvider>
                        </NotificationProvider>
                      </PlanningPeriodProvider>
                    </BagPhaseProvider>
                  </PlanningProvider>
                </FeatureFlagsProvider>
              </SuperAdminProvider>
            </UserProvider>
          </GoogleCalendarProvider>
        </AssociationProvider>
      </ToastProvider>
    </Router>
  );
};

export default App;
