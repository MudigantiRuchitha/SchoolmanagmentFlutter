import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedOrg = localStorage.getItem('org');

    if (token && savedUser && savedOrg) {
      try {
        setUser(JSON.parse(savedUser));
        setOrg(JSON.parse(savedOrg));
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = (token, userData, orgData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('org', JSON.stringify(orgData));
    setUser(userData);
    setOrg(orgData);
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
