"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type User = any;

type UserContextType = {
    user: User | null;
    setUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children, userD }: { children: ReactNode, userD: any | null }) => {
    const [user, setUser] = useState<User | null>(userD);

    useEffect(() => {
        setUser(userD);
    }, [userD]);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};