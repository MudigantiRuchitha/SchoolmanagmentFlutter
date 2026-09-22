import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      const savedOrg = localStorage.getItem('org');

      if (!token || !savedUser || !savedOrg) {
        setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        setOrg(JSON.parse(savedOrg));

        // Do not render protected pages until the database-backed branch scope
        // replaces any stale local-storage value.
        const response = await getMe();
        const serverUser = response.data.user;
        const currentUser = {
          ...parsedUser,
          ...serverUser,
          fullName: serverUser.fullName || serverUser.full_name || parsedUser.fullName,
          branchAccess: serverUser.branchAccess || serverUser.branch_access || parsedUser.branchAccess || 'all'
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        setUser(currentUser);
      } catch {
        localStorage.clear();
        setUser(null);
        setOrg(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (token, userData, orgData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('org', JSON.stringify(orgData));

    try {
      const response = await getMe();
      const serverUser = response.data.user;
      const currentUser = {
        ...userData,
        ...serverUser,
        fullName: serverUser.fullName || serverUser.full_name || userData.fullName || userData.full_name,
        branchAccess: serverUser.branchAccess || serverUser.branch_access || userData.branchAccess || userData.branch_access || 'all'
      };
      localStorage.setItem('user', JSON.stringify(currentUser));
      setUser(currentUser);
      setOrg(orgData);
      return currentUser;
    } catch {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setOrg(orgData);
      return userData;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('org');
    setUser(null);
    setOrg(null);
  };

  return (
    <AuthContext.Provider value={{ user, org, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
