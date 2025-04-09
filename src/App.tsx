import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { ProtectedRoute } from './features/auth';
import { PlanningProvider } from './context/planning';
import { UserProvider } from './context/auth';
import { BagPhaseProvider } from './context/shiftExchange';
import { PlanningPeriodProvider } from './context/planning';
import { NotificationProvider } from './context/notifications';
import { ExchangeProvider } from './context/exchange';
import { ConnectionStatus, LoadingSpinner } from './components/common';

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
const ValidatedPlanningsPage = lazy(() => import('./features/planning/pages/ValidatedPlanningsPage'));
const PlanningPreviewPage = lazy(() => import('./features/planning/pages/PlanningPreviewPage'));
const ReplacementsPage = lazy(() => import('./pages/ReplacementsPage'));
const DirectExchangePage = lazy(() => import('./features/directExchange/pages/DirectExchangePage'));

// Import des pages migrées
const ShiftExchangePage = lazy(() => import('./features/shiftExchange/pages/ShiftExchangePage'));
const AdminShiftExchangePage = lazy(() => import('./features/shiftExchange/pages/AdminShiftExchangePage'));

const App: React.FC = () => {
  return (
    <Router>
      <UserProvider>
        <PlanningProvider>
          <BagPhaseProvider>
            <PlanningPeriodProvider>
              <NotificationProvider>
                <ExchangeProvider>
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
                              <Route path="*" element={<Navbar />} />
                            </Routes>
                            <Routes>
                              <Route 
                                path="/admin" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin', 'isManager']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <AdminPage />
                                    </Suspense>
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
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <GeneratedPlanningPage />
                                    </Suspense>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/users" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <UsersManagementPage />
                                    </Suspense>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/admin-shift-exchange" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <AdminShiftExchangePage />
                                    </Suspense>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/validated-plannings" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <ValidatedPlanningsPage />
                                    </Suspense>
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/remplacements" 
                                element={
                                  <ProtectedRoute requiredRoles={['isAdmin']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <ReplacementsPage />
                                    </Suspense>
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
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <UserPage />
                                    </Suspense>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/planning" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <UserPlanningPage />
                                    </Suspense>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/shift-exchange" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <ShiftExchangePage />
                                    </Suspense>
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/direct-exchange" 
                                element={
                                  <ProtectedRoute requiredRoles={['isUser']}>
                                    <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                                      <DirectExchangePage />
                                    </Suspense>
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
                              <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                            <ConnectionStatus />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </ExchangeProvider>
              </NotificationProvider>
            </PlanningPeriodProvider>
          </BagPhaseProvider>
        </PlanningProvider>
      </UserProvider>
    </Router>
  );
};

export default App;
