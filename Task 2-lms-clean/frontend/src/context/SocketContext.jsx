import { createContext, useContext } from 'react';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  return (
    <SocketContext.Provider value={{ socket: null, connected: false }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);