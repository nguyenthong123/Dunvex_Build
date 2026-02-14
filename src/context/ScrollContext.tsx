import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

interface ScrollContextType {
	isNavVisible: boolean;
	setIsNavVisible: (visible: boolean) => void;
	handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [isNavVisible, setIsNavVisible] = useState(true);
	const lastScrollY = useRef(0);

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const currentScrollY = e.currentTarget.scrollTop;

		if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

		if (currentScrollY > lastScrollY.current && currentScrollY > 70) {
			setIsNavVisible(false);
		} else {
			setIsNavVisible(true);
		}

		lastScrollY.current = currentScrollY;
	};

	return (
		<ScrollContext.Provider value={{ isNavVisible, setIsNavVisible, handleScroll }}>
			{children}
		</ScrollContext.Provider>
	);
};

export const useScroll = () => {
	const context = useContext(ScrollContext);
	if (context === undefined) {
		throw new Error('useScroll must be used within a ScrollProvider');
	}
	return context;
};
