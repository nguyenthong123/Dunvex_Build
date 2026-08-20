import React from 'react';
import OrderLineItems from './OrderLineItems';

interface OrderProductLinesProps {
	lineItems: any[];
	updateLineItem: (index: number, field: string, value: any) => void;
	removeLineItem: (index: number) => void;
	addLineItem: () => void;
	activeRow: number | null;
	setActiveRow: (index: number | null) => void;
	activeField: string | null;
	setActiveField: (field: string | null) => void;
	dropdownRef: React.RefObject<HTMLDivElement | null>;
	lineSearchQuery: string;
	setLineSearchQuery: (query: string) => void;
	categories: any[];
	products: any[];
	getEffectiveStock: (product: any) => number;
	copyToClipboard: (text: string, label: string) => void;
	setShowScanner: (show: boolean) => void;
	normalizeText: (text: string) => string;
	isMatch: (str: string, query: string) => boolean;
}

export const OrderProductLines: React.FC<OrderProductLinesProps> = (props) => {
	return <OrderLineItems {...props} />;
};
