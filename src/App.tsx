import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import DashboardPage from './pages/DashboardPage';
import AdminShiftExchangePage from './pages/AdminShiftExchangePage';
import AdminPage from './pages/AdminPage';
import UserPage from './pages/UserPage';
import ProfilePage from './pages/ProfilePage';
import ShiftExchangePage from './pages/ShiftExchangePage';
import UserPlanningPage from './pages/UserPlanningPage';
import GeneratedPlanningPage from './pages/GeneratedPlanningPage';
import UsersManagementPage from './pages/UsersManagementPage';
import ValidatedPlanningsPage from './pages/ValidatedPlanningsPage';
import PlanningPreviewPage from './pages/PlanningPreviewPage';
import ProtectedRoute from './components/ProtectedRoute';
import { PlanningProvider } from './context/PlanningContext';
import { UserProvider } from './context/UserContext';
import { BagPhaseProvider } from './context/BagPhaseContext';
import { ConnectionStatus } from './components/common/ConnectionStatus';

const App: React.FC = () => {
  return (
    <UserProvider>
      <PlanningProvider>
        <BagPhaseProvider>
        <Router>
          <Routes>
            {/* Routes publiques accessibles sans authentification */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* Routes protégées nécessitant une authentification */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-100">
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
                            <AdminPage />
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
                            <GeneratedPlanningPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route 
                        path="/users" 
                        element={
                          <ProtectedRoute requiredRoles={['isAdmin']}>
                            <UsersManagementPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route 
                        path="/admin-shift-exchange" 
                        element={
                          <ProtectedRoute requiredRoles={['isAdmin']}>
                            <AdminShiftExchangePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route 
                        path="/validated-plannings" 
                        element={
                          <ProtectedRoute requiredRoles={['isAdmin']}>
                            <ValidatedPlanningsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route 
                        path="/planning/:userId" 
                        element={
                          <ProtectedRoute requiredRoles={['isAdmin']}>
                            <PlanningPreviewPage />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/user" 
                        element={
                          <ProtectedRoute requiredRoles={['isUser']}>
                            <UserPage />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/planning" 
                        element={
                          <ProtectedRoute requiredRoles={['isUser']}>
                            <UserPlanningPage />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/shift-exchange" 
                        element={
                          <ProtectedRoute requiredRoles={['isUser']}>
                            <ShiftExchangePage />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/profile" 
                        element={<ProfilePage />} 
                      />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                    <ConnectionStatus />
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
        </BagPhaseProvider>
      </PlanningProvider>
    </UserProvider>
  );
};

export default App;