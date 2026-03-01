import { z } from 'zod';

/**
 * Customer validation schema
 */
export const CustomerSchema = z.object({
	name: z.string()
		.min(2, "Tên khách hàng phải có ít nhất 2 ký tự")
		.max(100, "Tên khách hàng quá dài")
		.trim(),
	businessName: z.string()
		.max(100, "Tên cơ sở quá dài")
		.optional()
		.transform(val => val?.trim() || ''),
	phone: z.string()
		.regex(/^[0-9+ \-.()]{8,15}$/, "Số điện thoại không hợp lệ")
		.trim(),
	email: z.string()
		.email("Email không đúng định dạng")
		.optional()
		.or(z.literal(''))
		.transform(val => val?.trim() || ''),
	address: z.string()
		.max(500, "Địa chỉ quá dài")
		.optional()
		.transform(val => val?.trim() || ''),
	type: z.string()
		.min(1, "Vui lòng chọn hoặc nhập phân loại")
		.trim(),
	route: z.string()
		.optional()
		.transform(val => val?.trim() || ''),
	note: z.string()
		.max(1000, "Ghi chú quá dài")
		.optional()
		.transform(val => val?.trim() || ''),
	status: z.enum(["Hoạt động", "Ngừng hoạt động"]).default("Hoạt động"),
	licenseUrls: z.array(z.string()).optional().default([]),
	additionalImages: z.array(z.string()).optional().default([]),
	lat: z.number().nullish(),
	lng: z.number().nullish(),
	ownerId: z.string(),
	createdByEmail: z.string(),
	createdAt: z.any().optional(),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;

/**
 * Generic sanitation function to clean strings
 */
export const sanitizeString = (str: string) => {
	if (!str) return '';
	// Basic XSS prevention and trimming
	return str
		.replace(/<[^>]*>/g, '') // Strip HTML tags
		.trim();
};

/**
 * Mask sensitive data like phone and email
 */
export const maskSensitiveData = (str: string, isAdmin: boolean = false) => {
	if (isAdmin || !str) return str;

	// Email masking: d...x@gmail.com
	if (str.includes('@')) {
		const [name, domain] = str.split('@');
		if (name.length <= 2) return `${name[0]}***@${domain}`;
		return `${name[0]}***${name[name.length - 1]}@${domain}`;
	}

	// Phone masking: 09...88
	if (/^[0-9+ \-.()]{8,15}$/.test(str)) {
		const clean = str.replace(/[^0-9]/g, '');
		if (clean.length < 5) return str;
		return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
	}

	// Generic masking for strings that look like they contain phone/email
	// (Simple regex for detection)
	const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
	const phoneRegex = /([0-9]{3}[0-9 \-.]{3,}[0-9]{2,})/gi;

	let masked = str;
	masked = masked.replace(emailRegex, (match) => maskSensitiveData(match, false));
	masked = masked.replace(phoneRegex, (match) => {
		const clean = match.replace(/[^0-9]/g, '');
		if (clean.length >= 8) return maskSensitiveData(match, false);
		return match;
	});

	return masked;
};

/**
 * Optimizes Cloudinary URLs by adding f_auto and q_auto parameters
 */
export const getOptimizedImageUrl = (url: string) => {
	if (!url) return '';

	// Cloudinary optimization
	if (url.includes('cloudinary.com')) {
		// Replace /upload/ with /upload/f_auto,q_auto/
		return url.replace('/upload/', '/upload/f_auto,q_auto/');
	}

	// Google Drive thumbnail optimization
	if (url.includes('drive.google.com')) {
		const match = url.match(/[-\w]{25,}/);
		if (match) {
			return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
		}
	}

	return url;
};
