import { describe, expect, it } from 'vitest';
import { getOfficeCoordinates } from '../attendanceLocation';

describe('getOfficeCoordinates', () => {
	it('accepts numeric coordinates', () => {
		expect(getOfficeCoordinates({ lat: 11.9087054, lng: 107.5541436 })).toEqual({
			lat: 11.9087054,
			lng: 107.5541436,
		});
	});

	it('normalizes numeric coordinates returned as strings', () => {
		expect(getOfficeCoordinates({ lat: '11.9087054', lng: '107.5541436' })).toEqual({
			lat: 11.9087054,
			lng: 107.5541436,
		});
	});

	it.each([
		null,
		{},
		{ lat: '', lng: '107.5' },
		{ lat: 'NaN', lng: '107.5' },
		{ lat: 91, lng: 107.5 },
		{ lat: 11, lng: 181 },
	])('rejects missing or invalid coordinates: %s', (settings) => {
		expect(getOfficeCoordinates(settings)).toBeNull();
	});
});
