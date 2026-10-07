export interface Coordinates {
	lat: number;
	lng: number;
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
	if (typeof value !== 'number' && typeof value !== 'string') return null;
	if (typeof value === 'string' && value.trim() === '') return null;

	const coordinate = Number(value);
	return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
		? coordinate
		: null;
}

export function getOfficeCoordinates(settings: unknown): Coordinates | null {
	if (!settings || typeof settings !== 'object') return null;

	const coordinates = settings as Record<string, unknown>;
	const lat = parseCoordinate(coordinates.lat, -90, 90);
	const lng = parseCoordinate(coordinates.lng, -180, 180);
	return lat === null || lng === null ? null : { lat, lng };
}

export function getGeolocationErrorMessage(error: GeolocationPositionError): string {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			return 'Quyền định vị đang bị từ chối. Hãy cho phép Dunvex truy cập vị trí trong cài đặt thiết bị.';
		case error.POSITION_UNAVAILABLE:
			return 'Thiết bị chưa xác định được vị trí. Hãy bật Dịch vụ vị trí và kết nối Wi-Fi hoặc mạng di động.';
		case error.TIMEOUT:
			return 'Lấy vị trí quá lâu. Hãy thử lại khi thiết bị đã bật Dịch vụ vị trí.';
		default:
			return error.message || 'Không thể lấy vị trí thiết bị.';
	}
}
