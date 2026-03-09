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
		const scrollDelta = currentScrollY - lastScrollY.current;

		// Increased threshold to 20px for stability
		if (Math.abs(scrollDelta) < 20) return;

		// Only hide if scrolling down significantly and past top area
		if (scrollDelta > 0 && currentScrollY > 100) {
			if (isNavVisible) setIsNavVisible(false);
		} else if (scrollDelta < -15) {
			// Show immediately if scrolling up a bit
			if (!isNavVisible) setIsNavVisible(true);
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
