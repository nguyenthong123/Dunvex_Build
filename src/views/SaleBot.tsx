import React, { useState, useRef, useEffect } from 'react';
import { parseSaleMessage, analyzeImage } from '../services/geminiService';
import { BotMessageSquare, Send, Sparkles, User, AlertCircle, CheckCircle2, Package, Camera, Mic, MicOff, X, ImagePlus, Lock, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, Timestamp, increment, setDoc, getDoc } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { purchaseOrderService } from '../services/dataAccess';

// 🔍 Chuẩn hóa tiếng Việt để tìm kiếm chính xác (bỏ dấu, lowercase, NFC)
function normalizeVN(text: string): string {
    return text
        .normalize('NFC')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // bỏ dấu
        .replace(/đ/g, 'd')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\s]+/g, '') // bỏ dấu câu + khoảng trắng
        .trim();
}

// 🔍 Tìm sản phẩm khớp trong danh sách (8 tầng ưu tiên)
function findMatchingProduct(name: string, allProducts: any[], category?: string): any | null {
    const searchName = (name || '').toLowerCase().trim();
    const searchNameVN = normalizeVN(name || '');
    
    // Ưu tiên 1: Khớp chính xác tên (case-insensitive)
    let found = allProducts.find(p => (p.name || '').toLowerCase() === searchName);
    if (found) return found;
    
    // Ưu tiên 2: Khớp tên + category nếu có
    if (category) {
        const searchCat = normalizeVN(category);
        found = allProducts.find(p => 
            (p.name || '').toLowerCase() === searchName && 
            normalizeVN(p.category || '') === searchCat
        );
        if (found) return found;
    }
    
    // Ưu tiên 3: DB name contains search name
    found = allProducts.find(p => (p.name || '').toLowerCase().includes(searchName));
    if (found) return found;
    
    // Ưu tiên 4: Search name contains DB name (VD: "Keo A2.75" chứa "A2.75")
    found = allProducts.find(p => searchName.includes((p.name || '').toLowerCase()));
    if (found) return found;
    
    // Ưu tiên 5: Fuzzy Vietnamese match (bỏ dấu + bỏ space/punctuation)
    if (searchNameVN.length >= 2) {
        found = allProducts.find(p => normalizeVN(p.name || '').includes(searchNameVN));
        if (found) return found;
        
        // Ưu tiên 6: Ngược lại - search bao hàm DB
        found = allProducts.find(p => {
            const dbVN = normalizeVN(p.name || '');
            return dbVN.length >= 2 && searchNameVN.includes(dbVN);
        });
        if (found) return found;
        
        // Ưu tiên 7: Fuzzy + category
        if (category) {
            found = allProducts.find(p => 
                normalizeVN(p.name || '').includes(searchNameVN) &&
                normalizeVN(p.category || '').includes(normalizeVN(category))
            );
            if (found) return found;
        }
    }
    
    return null;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'bot';
    content: string;
    parsedData?: any;
}

const SaleBot = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: '1',
        role: 'bot',
        content: 'Xin chào! Tôi là SaleBot sử dụng sức mạnh của Gemini 2.5 Flash. Bạn muốn tạo đơn hàng hay khách hàng hôm nay? (Ví dụ: "Tạo đơn cho anh Nam ở Q1, lấy 5 keo chà ron")'
    }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [productsStr, setProductsStr] = useState<string>("");
    const [showProductsModal, setShowProductsModal] = useState(false);
    const [chatVisible, setChatVisible] = useState(true); // 🔘 Toggle FAB
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🛡️ Confirmation step
    const [confirmAction, setConfirmAction] = useState<any>(null);
    // 🎙️ Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [imagePreviews, setImagePreviews] = useState<{name: string; url: string}[]>([]);
    const imageUrlsRef = useRef<string[]>([]);
    const recognitionRef = useRef<any>(null);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                // simulate form submission
                const formEvent = { preventDefault: () => {} } as React.FormEvent;
                handleSend(formEvent);
            }
        }
    };
    const navigate = useNavigate();
    const owner = useOwner();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getChatDocId = () => {
        if (!owner.ownerId || !auth.currentUser?.uid) return null;
        return `${owner.ownerId}_${auth.currentUser.uid}`;
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Reset textarea height when input is cleared
    useEffect(() => {
        if (input === '' && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [input]);

    const isInitialLoad = useRef(true);

    useEffect(() => {
        const loadChat = async () => {
            const docId = getChatDocId();
            if (!docId) return;
            try {
                const docSnap = await getDoc(doc(db, 'bot_chats', docId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.messages && data.messages.length > 0) {
                        // 🔧 Fix: Deduplicate keys từ dữ liệu cũ (Date.now() có thể trùng)
                        const seen = new Set<string>();
                        const deduped = data.messages.map((m: any, i: number) => ({
                            ...m,
                            id: m.id && !seen.has(String(m.id)) ? (seen.add(String(m.id)), m.id) : crypto.randomUUID()
                        }));
                        setMessages(deduped);
                    }
                }
            } catch (err) {
                console.error("Lỗi tải chat:", err);
            } finally {
                setTimeout(() => { isInitialLoad.current = false; }, 100);
            }
        };
        loadChat();
    }, [owner.ownerId, auth.currentUser?.uid]);

    const saveMessagesToDb = async (msgs: ChatMessage[]) => {
        const docId = getChatDocId();
        if (!docId) return;
        try {
            const recentMsgs = msgs.slice(-30).map(m => {
                const newM = { ...m };
                if (newM.parsedData) {
                    newM.parsedData = { ...newM.parsedData };
                    delete newM.parsedData.searchResults; // Remove huge array to save space
                }
                return newM;
            });
            await setDoc(doc(db, 'bot_chats', docId), {
                ownerId: owner.ownerId,
                userId: auth.currentUser?.uid,
                messages: recentMsgs,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (err) {
            console.error("Lỗi lưu chat:", err);
        }
    };

    useEffect(() => {
        if (isInitialLoad.current) return;
        saveMessagesToDb(messages);
    }, [messages]);

    useEffect(() => {
        // 🔘 Lắng nghe sự kiện toggle chat từ FAB
        const handler = () => setChatVisible(v => !v);
        window.addEventListener('toggle-salebot', handler);
        return () => window.removeEventListener('toggle-salebot', handler);
    }, []);

    useEffect(() => {
        if (!owner.ownerId) return; // Đợi load xong ownerId mới query
        const fetchContextData = async () => {
            try {
                // Lấy sản phẩm
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snapProd = await getDocs(qProd);
                const prods = snapProd.docs.map(d => {
                    const data = d.data();
                    if (!data.name) return null;
                    return `- Danh mục: ${data.category || 'Không có'} | Tên: ${data.name} | Quy cách: ${data.specification || 'Không có'} | Giá bán: ${data.priceSell ? data.priceSell.toLocaleString('vi-VN') + 'đ' : 'Chưa có'}`;
                }).filter(Boolean);
                
                // Lấy khách hàng
                const qCust = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                const snapCust = await getDocs(qCust);
                const custs = snapCust.docs.map(d => {
                    const data = d.data();
                    const displayName = data.businessName ? `${data.businessName} (Đại diện: ${data.name})` : (data.name || 'Khách vãng lai');
                    return `- Tên: ${displayName} | SĐT: ${data.phone || 'Không có'} | Nợ: ${data.debt || 0}đ | Nhóm: ${data.type || 'Không có'}`;
                }).filter(Boolean);

                let contextData = "";
                if (prods.length > 0) contextData += "Danh sách Sản phẩm hiện có:\n" + prods.join("\n") + "\n\n";
                if (custs.length > 0) contextData += "Danh sách Khách hàng hiện có:\n" + custs.join("\n");
                
                if (contextData) {
                    setProductsStr(contextData); // Dùng lại state cũ nhưng chứa cả 2
                }
            } catch(e) {
                console.error("Lỗi lấy context:", e);
            }
        };
        fetchContextData();
    }, [owner.ownerId]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() && !fileInputRef.current?.files?.length) return;

        // 📸 Nếu có ảnh được chọn
        if (fileInputRef.current?.files?.length) {
            await handleImageSend();
            return;
        }

        const msg = input;
        setInput(''); // 🔧 Xoá ngay khi gửi, không đợi response
        await processTextMessage(msg);
    };

    // 🖼️ Resize ảnh trước khi gửi (tránh vượt Vercel body limit 4.5MB)
    const resizeImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                    resolve(base64);
                };
                img.onerror = () => {
                    // Fallback: gửi nguyên gốc nếu resize thất bại
                    resolve((e.target?.result as string).split(',')[1]);
                };
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // 📸 Xử lý gửi ảnh (hỗ trợ nhiều ảnh)
    const handleImageSend = async (files?: FileList | null) => {
        const fileList = files || fileInputRef.current?.files;
        if (!fileList || fileList.length === 0) return;

        const imageFiles = Array.from(fileList);
        const imageData: { base64: string; mimeType: string }[] = [];
        const fileNames: string[] = [];

        for (const file of imageFiles) {
            fileNames.push(file.name);
            // 🔧 Resize ảnh trước khi gửi (max 600px, quality 0.4) để tránh timeout
            const base64 = await resizeImage(file, 600, 0.4);
            imageData.push({ base64, mimeType: 'image/jpeg' });
        }

        const previewText = imageFiles.length > 1 
            ? `📸 [${imageFiles.length} ảnh: ${fileNames.join(', ')}]`
            : `📸 [Ảnh: ${fileNames[0]}]`;

        const newMessages = [...messages, {
            id: crypto.randomUUID(),
            role: 'user' as const,
            content: `${previewText}${input ? ' - ' + input : ''}`
        }];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);
        // 🧹 Cleanup old blob URLs
        imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        imageUrlsRef.current = [];
        setImagePreviews([]);

        try {
            const data = await analyzeImage(imageData, input || undefined, productsStr);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'bot',
                content: data.message || (imageFiles.length > 1 ? 'Em đã gộp các ảnh thành 1 đơn!' : 'Em đã phân tích xong ảnh!'),
                parsedData: data
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'bot',
                content: `❌ ${err.message || 'Lỗi phân tích ảnh'}`
            }]);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // 🎙️ Voice input (Web Speech API)
    const toggleVoiceInput = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Trình duyệt của anh không hỗ trợ nhập giọng nói. Vui lòng dùng Chrome hoặc Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + ' ' + transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Voice error:', event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        setIsRecording(true);
        recognition.start();
    };

    // 🛡️ Confirm & execute
    const confirmAndExecute = async () => {
        const data = confirmAction;
        setConfirmAction(null);
        await executeAction(data);
    };

    const processTextMessage = async (userMsg: string) => {
        
        const newMessages = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content: userMsg }];
        setMessages(newMessages);
        setIsLoading(true);

        const formattedHistory = messages.map(m => {
            let extraContext = '';
            if (m.parsedData) {
                const { message, searchResults, ...draftData } = m.parsedData;
                if (Object.keys(draftData).length > 0) {
                    extraContext += ` [Bản nháp đang có: ${JSON.stringify(draftData)}]`;
                }
                if (searchResults) {
                    extraContext += ` [Kết quả tìm kiếm: ${JSON.stringify(searchResults.map((r:any) => ({id: r.id, name: r.name, phone: r.phone})))}]`;
                }
            }
            return {
                role: m.role,
                content: m.content + extraContext
            };
        });

        try {
            // 📊 Pre-check: nếu có link Google Sheet
            let sheetMatch = userMsg.match(/https?:\/\/docs\.google\.com\/spreadsheets\/[^\s]+/);
            let isFromHistory = false;

            // Chuẩn hóa text để detect intent (bỏ dấu xuống dòng, gộp khoảng trắng)
            const flatMsg = userMsg.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
            const isOrder = /(lên|tạo|chốt|đặt|order|tao)\s*.?(đơn|don|order|hàng|hang)/.test(flatMsg) ||
                /đơn\s*hàng|order\s*from|từ\s*sheet.*đơn/.test(flatMsg);
            const isInventory = /(nhập|import|cập\s*nhật|update|nạp|thêm)\s*.?(kho|tồn|ton|inventory|stock)/.test(flatMsg) ||
                /tồn\s*kho|nhập\s*hàng|import\s*stock/.test(flatMsg);
            const isSupplier = /nhà\s*cung\s*cấp|ncc|nhập\s*hàng|mua\s*hàng|đơn\s*mua|purchase|supplier/.test(flatMsg);
            const isCreateProducts = /tạo\s*.?(danh\s*sách)?\s*.?(sản\s*phẩm|sp)|create\s*.?(product|sp)/.test(flatMsg) ||
                /sản\s*phẩm\s*mới|danh\s*sách\s*(sản\s*phẩm|sp)|thêm\s*(sản\s*phẩm|sp)/.test(flatMsg);

            if (!sheetMatch && (isOrder || isInventory || isSupplier || isCreateProducts)) {
                // Tìm link sheet trong 5 tin nhắn gần nhất nếu người dùng có nói từ khoá
                const recentMsgs = [...formattedHistory].reverse().slice(0, 5);
                for (const msg of recentMsgs) {
                    if (msg.role === 'user') {
                        const match = msg.content.match(/https?:\/\/docs\.google\.com\/spreadsheets\/[^\s]+/);
                        if (match) {
                            sheetMatch = match;
                            isFromHistory = true;
                            break;
                        }
                    }
                }
            }

            if (sheetMatch) {
                if (isCreateProducts && !isOrder && !isInventory && !isSupplier) {
                    // 📦 Tạo danh sách sản phẩm mới từ sheet
                    const data = {
                        intent: 'IMPORT_CREATE_PRODUCTS',
                        import_url: sheetMatch[0],
                        message: '📦 Dạ, em sẽ đọc Google Sheet và tạo danh sách sản phẩm mới. Đang xử lý...'
                    };
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: data.message, parsedData: data }]);
                    setIsLoading(false);
                    await executeAction(data);
                    return;
                }

                if (isOrder && isSupplier && !isInventory) {
                    // 📦 Tạo đơn MUA hàng (purchase order) từ sheet
                    const data = {
                        intent: 'IMPORT_PURCHASE_ORDER_FROM_SHEET',
                        import_url: sheetMatch[0],
                        message: '📦 Dạ, em sẽ đọc Google Sheet và tạo đơn mua hàng cho nhà cung cấp. Đang xử lý...'
                    };
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: data.message, parsedData: data }]);
                    setIsLoading(false);
                    await executeAction(data);
                    return;
                }

                if (isOrder && !isInventory && !isSupplier) {
                    // Tạo đơn hàng từ sheet
                    const data = {
                        intent: 'IMPORT_ORDER_FROM_SHEET',
                        import_url: sheetMatch[0],
                        message: '📋 Dạ, em sẽ đọc Google Sheet và tạo đơn hàng. Đang xử lý...'
                    };
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: data.message, parsedData: data }]);
                    setIsLoading(false);
                    await executeAction(data);
                    return;
                }

                if (isInventory && !isOrder) {
                    // Import tồn kho từ sheet
                    const data = {
                        intent: 'IMPORT_INVENTORY',
                        import_url: sheetMatch[0],
                        message: 'Dạ, em đã nhận được link Google Sheet của anh/chị và sẽ tiến hành cập nhật tồn kho ạ.'
                    };
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: data.message, parsedData: data }]);
                    setIsLoading(false);
                    await executeAction(data);
                    return;
                }

                // Không rõ ý định → hỏi lại (chỉ hỏi khi link được gửi TRỰC TIẾP trong tin nhắn này)
                if (!isFromHistory) {
                    setMessages(prev => [...prev, {
                        id: crypto.randomUUID(), role: 'bot',
                        content: '📊 Em thấy anh/chị gửi link Google Sheet. Anh/chị muốn:\n\n1️⃣ **Nhập tồn kho** — cập nhật số lượng tồn\n2️⃣ **Lên đơn hàng** — tạo đơn từ danh sách\n3️⃣ **Tạo sản phẩm mới** — tạo danh sách SP từ sheet\n4️⃣ **Tạo đơn mua hàng** — nhập hàng từ NCC\n\nVui lòng nhập "nhập kho", "lên đơn", "tạo sản phẩm", hoặc "mua hàng" để em xử lý ạ!'
                    }]);
                    setIsLoading(false);
                    return;
                }
            }

            const data = await parseSaleMessage(userMsg, productsStr, formattedHistory);
            
            // Nếu AI muốn SEARCH, ta làm ngay ngầm phía dưới!
            if (data.intent === 'SEARCH_CUSTOMER' && data.search_query && owner.ownerId) {
                const queryText = data.search_query.toLowerCase();
                const q = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(q);
                
                const results = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter((c: any) => 
                        (c.name && c.name.toLowerCase().includes(queryText)) || 
                        (c.phone && c.phone.includes(queryText))
                    )
                    .slice(0, 3); // Lấy top 3 kết quả
                
                data.searchResults = results;
                if (results.length > 0) {
                    data.message = `Đã tìm thấy ${results.length} khách hàng khớp với yêu cầu. Bạn muốn thao tác với hồ sơ nào?`;
                } else {
                    data.message = `Không tìm thấy khách hàng nào khớp với "${data.search_query}".`;
                }
            } else if (data.intent === 'UPDATE_CUSTOMER') {
                // Sửa lỗi Gemini gán nhầm tên khách hàng vào biến ID
                if (data.customer?.id && data.customer.id.length < 15 && !data.customer?.name) {
                    data.customer.name = data.customer.id;
                    data.customer.id = undefined;
                }

                // KIỂM TRA TRƯỚC (Bộ nhớ đệm): Tìm kiếm khách hàng ngay lập tức trước khi xuất nút bấm
                if ((!data.customer?.id || data.customer.id.length < 15) && data.customer?.name) {
                    const q = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                    const snap = await getDocs(q);
                    const queryRaw = data.customer.name.toLowerCase();
                    const queryName = queryRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    
                    // 🔍 Tìm theo tên HOẶC số điện thoại
                    const matches = snap.docs.filter(d => {
                        const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const dbPhone = (d.data().phone || '').replace(/[^0-9]/g, '');
                        const queryDigits = queryRaw.replace(/[^0-9]/g, '');
                        // Ưu tiên khớp tên, sau đó khớp SĐT
                        return dbName.includes(queryName) || queryName.includes(dbName) ||
                               (queryDigits.length >= 3 && dbPhone.includes(queryDigits));
                    });
                    
                    let found = null;
                    if (matches.length === 1) {
                        found = matches[0];
                    } else if (matches.length > 1) {
                        found = matches.find(d => {
                            const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            return dbName === queryName;
                        });
                    }
                    
                    if (found) {
                        data.customer.id = found.id;
                        data.customer.name = found.data().name; // Đồng bộ lại tên chuẩn
                    } else {
                        // Nếu không thấy chính xác hoặc có nhiều kết quả, tìm các kết quả gần giống để gợi ý
                        let suggestions = matches.map(d => ({ id: d.id, ...d.data() })).slice(0, 3);
                        if (suggestions.length === 0) {
                            const words = queryName.split(' ').filter(Boolean);
                            suggestions = snap.docs
                                .map(d => ({ id: d.id, ...d.data() }))
                                .filter((c: any) => {
                                    const cName = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                    return words.some((w: string) => cName.includes(w));
                                })
                                .slice(0, 3);
                        }
                            
                        const originalName = data.customer.name;
                        
                        data.intent = 'UNKNOWN';
                        data.customer = undefined; // Tuớc quyền render khung hành động
                        
                        if (suggestions.length > 0) {
                            data.message = `Em không tìm thấy chính xác khách hàng "${originalName}" (Hoặc có nhiều khách hàng trùng tên). Anh/chị có phải đang tìm một trong các khách hàng dưới đây không?`;
                            data.searchResults = suggestions;
                        } else {
                            data.message = `Em không tìm thấy hồ sơ khách hàng "${originalName}" trong hệ thống để cập nhật. Anh/chị vui lòng kiểm tra lại tên!`;
                        }
                    }
                } else if (!data.customer?.id && !data.customer?.name) {
                    data.intent = 'UNKNOWN';
                    data.message = `Dạ, anh/chị muốn cập nhật cho khách hàng nào ạ? Em chưa nhận diện được tên khách hàng.`;
                    data.customer = undefined;
                }
            } else if (data.intent === 'CREATE_PAYMENT' && data.customer?.name && owner.ownerId) {
                // Pre-check: Tìm khách hàng trước khi xác nhận thu công nợ
                const qP = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                const snapP = await getDocs(qP);
                const queryRawP = data.customer.name.toLowerCase();
                const queryNameP = queryRawP.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                const matchesP = snapP.docs.filter(d => {
                    const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const dbBiz = (d.data().businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const matchName = dbName && (dbName.includes(queryNameP) || queryNameP.includes(dbName));
                    const matchBiz = dbBiz && (dbBiz.includes(queryNameP) || queryNameP.includes(dbBiz));
                    return matchName || matchBiz;
                });

                let foundP = null;
                if (matchesP.length === 1) {
                    foundP = matchesP[0];
                } else if (matchesP.length > 1) {
                    foundP = matchesP.find(d => {
                        const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const dbBiz = (d.data().businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        return dbName === queryNameP || dbBiz === queryNameP;
                    });
                }

                if (foundP) {
                    data.customer.id = foundP.id;
                    data.customer.name = foundP.data().businessName || foundP.data().name;
                    const debt = foundP.data().debt || foundP.data().totalDebt || 0;
                    const debtInfo = debt > 0 ? ` (còn nợ ${debt.toLocaleString('vi-VN')}đ)` : ' (không còn nợ)';
                    data.message = `👤 Đã tìm thấy: **${data.customer.name}**${debtInfo}\n${data.message || 'Anh/chị muốn thu bao nhiêu ạ?'}`;
                } else {
                    const originalNameP = data.customer.name;
                    let suggestionsP = matchesP.map(d => ({ id: d.id, ...d.data() })).slice(0, 3);
                    if (suggestionsP.length === 0) {
                        const wordsP = queryNameP.split(' ').filter(Boolean);
                        suggestionsP = snapP.docs
                            .map(d => ({ id: d.id, ...d.data() }))
                            .filter((c: any) => {
                                const cName = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                const cBiz = (c.businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                return wordsP.some((w: string) => cName.includes(w) || cBiz.includes(w));
                            })
                            .slice(0, 3);
                    }

                    data.intent = 'UNKNOWN';
                    data.customer = undefined;
                    if (suggestionsP.length > 0) {
                        data.message = `Em không tìm thấy khách hàng "${originalNameP}". Có phải anh/chị muốn thu tiền của một trong những khách hàng dưới đây không ạ?`;
                        data.searchResults = suggestionsP;
                    } else {
                        data.message = `Em không tìm thấy khách hàng "${originalNameP}" trong hệ thống. Anh/chị kiểm tra lại tên hoặc tạo mới khách hàng trước nhé!`;
                    }
                }
            } else if (data.intent === 'CREATE_ORDER' && data.customer?.name && owner.ownerId) {
                // Pre-check: Tìm khách hàng để fill vào form lên đơn chính xác
                const qO = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                const snapO = await getDocs(qO);
                const queryRawO = data.customer.name.toLowerCase();
                const queryNameO = queryRawO.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                const matchesO = snapO.docs.filter(d => {
                    const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const dbBiz = (d.data().businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const dbPhone = (d.data().phone || '').replace(/[^0-9]/g, '');
                    const queryDigits = queryRawO.replace(/[^0-9]/g, '');
                    const matchName = dbName && (dbName.includes(queryNameO) || queryNameO.includes(dbName));
                    const matchBiz = dbBiz && (dbBiz.includes(queryNameO) || queryNameO.includes(dbBiz));
                    return matchName || matchBiz || (queryDigits.length >= 3 && dbPhone.includes(queryDigits));
                });

                let foundO = null;
                if (matchesO.length === 1) {
                    foundO = matchesO[0];
                } else if (matchesO.length > 1) {
                    foundO = matchesO.find(d => {
                        const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const dbBiz = (d.data().businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        return dbName === queryNameO || dbBiz === queryNameO;
                    });
                }

                if (foundO) {
                    data.customer.id = foundO.id;
                    data.customer.name = foundO.data().businessName || foundO.data().name;
                    data.customer.phone = foundO.data().phone || '';
                    data.customer.address = foundO.data().address || '';
                    data.customer.type = foundO.data().type || 'Chủ nhà';
                }
            }

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: data.message || "Đã phân tích xong dữ liệu.",
                parsedData: data
            }]);
        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: `Lỗi xử lý: ${error?.message || "Lỗi không xác định"}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // 🛡️ Show confirmation before executing
    const handleAction = (data: any) => {
        setConfirmAction(data);
    };

    // ⚡ Execute the actual action (after confirmation)
    const executeAction = async (data: any) => {
        if (data.intent === 'CREATE_ORDER') {
            navigate('/quick-order', { state: { prefill: data } });
        } else if (data.intent === 'UPDATE_ORDER') {
            // 🔄 Thêm sản phẩm vào đơn hàng cũ theo ID
            try {
                if (!owner.ownerId) {
                    alert("Không thể xác thực quyền truy cập.");
                    return;
                }
                if (!data.order_id) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Vui lòng cung cấp ID đơn hàng cần sửa.' }]);
                    return;
                }
                if (!data.products || data.products.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Vui lòng cho biết sản phẩm cần thêm vào đơn.' }]);
                    return;
                }
                setIsLoading(true);

                // 1. Tìm đơn hàng theo ID (hỗ trợ cả ID đầy đủ và ID rút gọn 8 ký tự)
                const searchId = data.order_id.trim().toUpperCase();
                const qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
                const ordersSnap = await getDocs(qOrders);
                
                // Tìm khớp chính xác hoặc prefix (ID rút gọn từ phiếu giao hàng)
                let matchedOrder: any = null;
                let matchedOrderId = '';
                
                // Try exact match first
                const exactMatch = ordersSnap.docs.find(d => d.id === searchId || d.id.toUpperCase() === searchId);
                if (exactMatch) {
                    matchedOrder = exactMatch.data();
                    matchedOrderId = exactMatch.id;
                } else {
                    // Try prefix match (VD: user gõ ED3A2B1C, doc ID là ed3a2b1cxxxxxxxx)
                    const prefixMatches = ordersSnap.docs.filter(d => d.id.toUpperCase().startsWith(searchId));
                    if (prefixMatches.length === 1) {
                        matchedOrder = prefixMatches[0].data();
                        matchedOrderId = prefixMatches[0].id;
                    } else if (prefixMatches.length > 1) {
                        const ids = prefixMatches.map(d => d.id.slice(0, 8).toUpperCase()).join(', ');
                        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `⚠️ Tìm thấy **${prefixMatches.length}** đơn hàng trùng prefix **${searchId}**: ${ids}. Anh/chị vui lòng nhập đầy đủ ID chính xác nhé!` }]);
                        setIsLoading(false);
                        return;
                    }
                }

                if (!matchedOrder) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `❌ Không tìm thấy đơn hàng với ID **${searchId}**.\n\n💡 Lưu ý: ID trên phiếu giao hàng là 8 ký tự đầu của mã đơn. Nếu không tìm thấy, anh/chị kiểm tra lại hoặc dùng ID đầy đủ nhé!` }]);
                    setIsLoading(false);
                    return;
                }
                const existingOrder = matchedOrder;

                // 2. Tìm sản phẩm khớp trong kho
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const prodSnap = await getDocs(qProd);
                const allProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

                const existingItems: any[] = existingOrder.items || [];
                const newItems: any[] = [];
                const notFound: string[] = [];

                for (const aiProd of data.products) {
                    const aiName = (aiProd.name || '').toLowerCase().trim();
                    const aiCategory = (aiProd.category || '').trim();
                    const matched = findMatchingProduct(aiProd.name, allProducts, aiCategory);
                    
                    if (matched) {
                        const qty = Number(aiProd.quantity) || 1;
                        const price = Number(matched.price || matched.retail_price || matched.priceSell || 0);
                        const cost = Number(matched.cost || matched.import_price || 0);
                        const weight = Number(matched.weight || 0);
                        newItems.push({
                            productId: matched.id,
                            name: matched.name,
                            sku: matched.sku || '',
                            unit: matched.unit || 'cái',
                            quantity: qty,
                            price: price,
                            cost: cost,
                            weight: weight,
                            stockBatch: matched.stockBatch || null
                        });
                    } else {
                        notFound.push(aiProd.name);
                    }
                }

                if (newItems.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `❌ Không tìm thấy sản phẩm nào trong kho khớp với yêu cầu.` }]);
                    setIsLoading(false);
                    return;
                }

                // 3. Merge items (cộng dồn nếu trùng productId)
                const mergedItems = [...existingItems];
                for (const ni of newItems) {
                    const existingIdx = mergedItems.findIndex((ei: any) => ei.productId === ni.productId);
                    if (existingIdx >= 0) {
                        mergedItems[existingIdx].quantity += ni.quantity;
                    } else {
                        mergedItems.push(ni);
                    }
                }

                // 4. Tính lại totals (chống NaN)
                const newSubTotal = mergedItems.reduce((sum: number, i: any) => sum + ((Number(i.quantity) || 0) * (Number(i.price) || 0)), 0);
                const newTotalWeight = mergedItems.reduce((sum: number, i: any) => sum + ((Number(i.quantity) || 0) * (Number(i.weight) || 0)), 0);
                const newTotalCost = mergedItems.reduce((sum: number, i: any) => sum + ((Number(i.quantity) || 0) * (Number(i.cost) || 0)), 0);
                const newTotal = newSubTotal + (Number(existingOrder.adjustmentValue) || 0) - (Number(existingOrder.discountValue) || 0);

                // 5. Update Firestore (dùng full document ID đã match)
                await updateDoc(doc(db, 'orders', matchedOrderId), {
                    items: mergedItems,
                    subTotal: newSubTotal,
                    totalAmount: newTotal,
                    totalWeight: newTotalWeight,
                    totalCost: newTotalCost,
                    updatedAt: serverTimestamp()
                });

                // 6. Thông báo thành công
                const itemsList = newItems.map((i: any) => `${i.name} x${i.quantity}`).join(', ');
                let msg = `✅ Đã thêm **${itemsList}** vào đơn **#${matchedOrderId.slice(0, 8).toUpperCase()}** (${existingOrder.customerName || 'Khách'}).\n\n📊 Tổng mới: **${(newTotal || 0).toLocaleString('vi-VN')}đ** (${mergedItems.length} mặt hàng)\n\n💡 Gõ "check đơn ${matchedOrderId.slice(0, 8).toUpperCase()}" để xem lại đơn hàng.`;
                if (notFound.length > 0) {
                    msg += `\n\n⚠️ Không tìm thấy: ${notFound.join(', ')}`;
                }
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: msg }]);

            } catch (err) {
                console.error('UPDATE_ORDER error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Lỗi khi cập nhật đơn hàng. Vui lòng thử lại.' }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'REVIEW_ORDER') {
            // 🔍 Xem chi tiết đơn hàng theo ID
            try {
                if (!owner.ownerId || !data.order_id) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Vui lòng cung cấp ID đơn hàng cần xem.' }]);
                    return;
                }
                setIsLoading(true);
                
                const searchId = data.order_id.trim().toUpperCase();
                const qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
                const ordersSnap = await getDocs(qOrders);
                
                // Match exact hoặc prefix
                let matched: any = null;
                const exactMatch = ordersSnap.docs.find(d => d.id === searchId || d.id.toUpperCase() === searchId);
                if (exactMatch) {
                    matched = { id: exactMatch.id, ...exactMatch.data() };
                } else {
                    const prefixMatches = ordersSnap.docs.filter(d => d.id.toUpperCase().startsWith(searchId));
                    if (prefixMatches.length === 1) {
                        matched = { id: prefixMatches[0].id, ...prefixMatches[0].data() };
                    } else if (prefixMatches.length > 1) {
                        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `⚠️ Tìm thấy **${prefixMatches.length}** đơn trùng prefix **${searchId}**. Nhập ID đầy đủ nhé!` }]);
                        setIsLoading(false);
                        return;
                    }
                }
                
                if (!matched) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `❌ Không tìm thấy đơn hàng với ID **${searchId}**.` }]);
                    setIsLoading(false);
                    return;
                }
                
                // Format hiển thị + phát hiện mặt hàng lỗi
                const items = matched.items || [];
                const brokenItems: any[] = [];
                
                const itemsList = items.map((i: any, idx: number) => {
                    const price = Number(i.price) || 0;
                    const qty = Number(i.quantity) || 0;
                    const total = price * qty;
                    const isBroken = qty === 0 || price === 0 || !i.productId;
                    if (isBroken) brokenItems.push({ ...i, index: idx + 1 });
                    const flag = isBroken ? ' ⚠️' : '';
                    return `${idx + 1}. ${i.name || 'SP'}: ${qty} x ${price.toLocaleString('vi-VN')}đ = **${total.toLocaleString('vi-VN')}đ**${flag}`;
                }).join('\n');
                
                const subTotal = Number(matched.subTotal) || 0;
                const totalAmount = Number(matched.totalAmount) || 0;
                
                let msg = `📋 **Đơn hàng #${matched.id.slice(0, 8).toUpperCase()}**\n` +
                    `👤 KH: **${matched.customerName || 'N/A'}** | 📞 ${matched.customerPhone || 'N/A'}\n` +
                    `📅 ${matched.orderDate || 'N/A'} | 📌 ${matched.status || 'N/A'}\n` +
                    `\n📦 **${items.length} mặt hàng:**\n${itemsList}\n` +
                    `\n💰 Tạm tính: **${subTotal.toLocaleString('vi-VN')}đ**` +
                    (matched.adjustmentValue ? ` + VC: ${Number(matched.adjustmentValue).toLocaleString('vi-VN')}đ` : '') +
                    (matched.discountValue ? ` - CK: ${Number(matched.discountValue).toLocaleString('vi-VN')}đ` : '') +
                    `\n🟰 **Tổng: ${totalAmount.toLocaleString('vi-VN')}đ**`;
                
                // 🔧 Phát hiện mặt hàng lỗi và đề xuất sửa
                if (brokenItems.length > 0) {
                    msg += `\n\n⚠️ **Phát hiện ${brokenItems.length} mặt hàng lỗi:**`;
                    brokenItems.forEach(bi => {
                        msg += `\n• ${bi.name || 'SP'}: ${bi.quantity === 0 ? 'số lượng = 0' : ''}${bi.price === 0 ? ' chưa có giá' : ''}${!bi.productId ? ' chưa khớp sản phẩm' : ''}`;
                    });
                    msg += `\n\n🔧 Gõ **"sửa đơn ${matched.id.slice(0, 8).toUpperCase()}"** để em tự động tìm và sửa các mặt hàng lỗi nhé!`;
                }
                
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: msg }]);
            } catch (err) {
                console.error('REVIEW_ORDER error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Lỗi khi xem đơn hàng.' }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'FIX_ORDER') {
            // 🔧 Tự động sửa các mặt hàng lỗi trong đơn
            try {
                if (!owner.ownerId || !data.order_id) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Vui lòng cung cấp ID đơn hàng cần sửa.' }]);
                    return;
                }
                setIsLoading(true);

                const searchId = data.order_id.trim().toUpperCase();
                const qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
                const ordersSnap = await getDocs(qOrders);
                
                let matched: any = null;
                let matchedId = '';
                const exactMatch = ordersSnap.docs.find(d => d.id === searchId || d.id.toUpperCase() === searchId);
                if (exactMatch) {
                    matched = { ...exactMatch.data() };
                    matchedId = exactMatch.id;
                } else {
                    const prefixMatches = ordersSnap.docs.filter(d => d.id.toUpperCase().startsWith(searchId));
                    if (prefixMatches.length === 1) {
                        matched = { ...prefixMatches[0].data() };
                        matchedId = prefixMatches[0].id;
                    } else {
                        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `❌ Không tìm thấy đơn **${searchId}**.` }]);
                        setIsLoading(false);
                        return;
                    }
                }
                
                // Tìm mặt hàng lỗi
                const items = matched.items || [];
                const brokenIndices: number[] = [];
                items.forEach((i: any, idx: number) => {
                    if (!i.productId || Number(i.quantity) === 0 || Number(i.price) === 0) {
                        brokenIndices.push(idx);
                    }
                });
                
                if (brokenIndices.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `✅ Đơn **#${matchedId.slice(0, 8).toUpperCase()}** không có mặt hàng lỗi nào! Tất cả đều có giá và số lượng hợp lệ.` }]);
                    setIsLoading(false);
                    return;
                }
                
                // Lấy danh sách sản phẩm trong kho
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const prodSnap = await getDocs(qProd);
                const allProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
                
                let fixCount = 0;
                const fixDetails: string[] = [];
                const updatedItems = [...items];
                
                for (const idx of brokenIndices) {
                    const item = updatedItems[idx];
                    const itemName = (item.name || '').toLowerCase().trim();
                    
                    // Tìm sản phẩm khớp
                    const found = findMatchingProduct(itemName, allProducts);
                    
                    if (found) {
                        const newPrice = Number(found.price || found.retail_price || found.priceSell || 0);
                        const newCost = Number(found.cost || found.import_price || 0);
                        const newWeight = Number(found.weight || 0);
                        const newQty = Number(item.quantity) || 1;
                        
                        updatedItems[idx] = {
                            ...item,
                            productId: found.id,
                            name: found.name,
                            sku: found.sku || item.sku || '',
                            unit: found.unit || item.unit || 'cái',
                            quantity: newQty,
                            price: newPrice,
                            cost: newCost,
                            weight: newWeight,
                        };
                        fixCount++;
                        fixDetails.push(`✅ ${item.name} → **${found.name}**: ${newQty} x ${newPrice.toLocaleString('vi-VN')}đ`);
                    } else {
                        fixDetails.push(`❌ ${item.name}: không tìm thấy sản phẩm khớp trong kho`);
                    }
                }
                
                if (fixCount === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: `⚠️ Không tìm thấy sản phẩm nào trong kho khớp với các mặt hàng lỗi. Hãy tạo sản phẩm trước rồi sửa lại đơn.` }]);
                    setIsLoading(false);
                    return;
                }
                
                // Tính lại tổng
                const newSubTotal = updatedItems.reduce((sum: number, i: any) => sum + ((Number(i.quantity) || 0) * (Number(i.price) || 0)), 0);
                const newTotal = newSubTotal + (Number(matched.adjustmentValue) || 0) - (Number(matched.discountValue) || 0);
                const newTotalWeight = updatedItems.reduce((sum: number, i: any) => sum + ((Number(i.quantity) || 0) * (Number(i.weight) || 0)), 0);
                const newTotalCost = updatedItems.reduce((sum: number, i: any) => sum + ((Number(i.quantity) || 0) * (Number(i.cost) || 0)), 0);
                
                // Update Firestore
                await updateDoc(doc(db, 'orders', matchedId), {
                    items: updatedItems,
                    subTotal: newSubTotal,
                    totalAmount: newTotal,
                    totalWeight: newTotalWeight,
                    totalCost: newTotalCost,
                    updatedAt: serverTimestamp()
                });
                
                let msg = `🔧 **Đã sửa ${fixCount}/${brokenIndices.length} mặt hàng lỗi** trong đơn **#${matchedId.slice(0, 8).toUpperCase()}**:\n\n` +
                    fixDetails.join('\n') +
                    `\n\n📊 Tổng mới: **${(newTotal || 0).toLocaleString('vi-VN')}đ**\n\n💡 Gõ "check đơn ${matchedId.slice(0, 8).toUpperCase()}" để xem lại.`;
                
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: msg }]);
                
            } catch (err) {
                console.error('FIX_ORDER error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: '❌ Lỗi khi sửa đơn hàng.' }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'INVENTORY_ACTION') {
            try {
                if (!owner.ownerId) {
                    alert("Không thể xác thực quyền truy cập. Vui lòng thử lại sau.");
                    return;
                }
                if (!data.products || data.products.length === 0) {
                    alert("Không tìm thấy sản phẩm nào để tạo phiếu kho.");
                    return;
                }
                setIsLoading(true);

                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(qProd);
                const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

                const matchedItems = [];
                for (const aiProd of data.products) {
                    const matchedProd = findMatchingProduct(aiProd.name, allProducts, aiProd.category);

                    if (matchedProd) {
                        matchedItems.push({
                            product: matchedProd,
                            quantity: Number(aiProd.quantity) || 0
                        });
                    }
                }

                if (matchedItems.length === 0) {
                    const notFoundNames = data.products?.map((p: any) => p.name).join(', ') || 'không xác định';
                    setMessages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        role: 'bot',
                        content: `❌ Không tìm thấy sản phẩm nào trong kho:\n\n**${notFoundNames}**\n\n💡 Sản phẩm có thể chưa được tạo. Hãy tạo sản phẩm trước bằng cách gõ:\n\`tạo sản phẩm: [tên sản phẩm]\``
                    }]);
                    setIsLoading(false);
                    return;
                }

                const type = data.inventory_action?.type === 'export' ? 'export' : 'import';
                const actionName = type === 'import' ? 'Nhập kho' : 'Xuất kho';

                // Write ONE inventory_log per product (flat structure — matches stats calculator)
                for (const item of matchedItems) {
                    const newStock = type === 'import'
                        ? (Number(item.product.stock) || 0) + Number(item.quantity)
                        : (Number(item.product.stock) || 0) - Number(item.quantity);

                    const logEntry = {
                        productId: item.product.id,
                        productName: item.product.name,
                        sku: item.product.sku || '',
                        unit: item.product.unit || '',
                        qty: Number(item.quantity),
                        type: type,
                        action: actionName,
                        previousStock: Number(item.product.stock) || 0,
                        newStock: newStock,
                        note: data.inventory_action?.note || 'Tạo tự động từ SaleBot',
                        createdAt: serverTimestamp(),
                        ownerId: owner.ownerId,
                        user: auth.currentUser?.displayName || 'Unknown'
                    };
                    await addDoc(collection(db, 'inventory_logs'), logEntry);

                    // Update product stock
                    await updateDoc(doc(db, 'products', item.product.id), {
                        stock: newStock,
                        updatedAt: serverTimestamp()
                    });
                }

                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'bot',
                    content: `✅ Đã tạo thành công Phiếu ${actionName} cho ${matchedItems.length} mặt hàng.`
                }]);
            } catch (err) {
                console.error(err);
                alert("Lỗi khi tạo phiếu kho");
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'IMPORT_INVENTORY') {
            // 📊 Import tồn kho từ Google Sheet
            try {
                if (!data.import_url) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không tìm thấy link Google Sheet. Anh/chị vui lòng gửi lại link đầy đủ.' }]);
                    return;
                }
                setIsLoading(true);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: '⏳ Đang đọc dữ liệu từ Google Sheet...' }]);

                // Chuyển Google Sheet URL → CSV export
                let csvUrl = data.import_url;
                const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (!match) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Link Google Sheet không đúng định dạng. Cần link dạng: https://docs.google.com/spreadsheets/d/...' }]);
                    setIsLoading(false);
                    return;
                }
                const sheetId = match[1];
                const gidMatch = csvUrl.match(/gid=(\d+)/);
                const gid = gidMatch ? gidMatch[1] : '0';
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

                const res = await fetch(csvUrl);
                if (!res.ok) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không đọc được Google Sheet. Sheet cần được chia sẻ công khai (Anyone with link).' }]);
                    setIsLoading(false);
                    return;
                }

                const csvText = await res.text();
                const lines = csvText.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Sheet trống hoặc không có dữ liệu.' }]);
                    setIsLoading(false);
                    return;
                }

                // Parse header để tìm cột
                const parseCSVLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (const ch of line) {
                        if (ch === '"') { inQuotes = !inQuotes; continue; }
                        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
                        current += ch;
                    }
                    result.push(current.trim());
                    return result;
                };

                const headers = parseCSVLine(lines[0]).map(h => normalizeVN(h));
                const nameColIdx = headers.findIndex((h: string) => 
                    h.includes('ten') || h.includes('sanpham') || h.includes('product') || h.includes('name') || h.includes('hanghoa'));
                const priceImportColIdx = headers.findIndex((h: string) =>
                    h.includes('gianhap') || h.includes('giavon') || h.includes('cost') || h.includes('nhap'));
                const priceSellColIdx = headers.findIndex((h: string) =>
                    h.includes('giaban') || h.includes('ban') || h.includes('retail') || h.includes('le') || (!priceImportColIdx && h.includes('gia')));
                const stockColIdx = headers.findIndex((h: string) =>
                    h.includes('ton') || h.includes('stock') || h.includes('soluong') || h.includes('kho') || h.includes('conlai'));
                const catColIdx = headers.findIndex((h: string) =>
                    h.includes('danhmuc') || h.includes('loai') || h.includes('category') || h.includes('nhom'));
                const unitColIdx = headers.findIndex((h: string) =>
                    h.includes('donvi') || h.includes('unit') || h.includes('dvt') || h.includes('tinh'));
                const weightColIdx = headers.findIndex((h: string) =>
                    h.includes('trongluong') || h.includes('weight') || h.includes('density') || h.includes('matdo') || h.includes('khoiluong') || h.includes('kg'));
                const specColIdx = headers.findIndex((h: string) =>
                    h.includes('quycach') || h.includes('spec') || h.includes('kichthuoc') || h.includes('size') || h.includes('dacdiem'));

                if (nameColIdx < 0) {
                    const cols = headers.join(', ');
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy cột "Tên sản phẩm". Các cột hiện có: ${cols}. Vui lòng đặt tên cột có chữ "tên" hoặc "sản phẩm".` }]);
                    setIsLoading(false);
                    return;
                }

                // Lấy tất cả sản phẩm từ database
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(qProd);
                const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

                // Parse từng dòng
                const matchedItems: any[] = [];
                const notFoundItems: { name: string; stock: number; priceImport: number; priceSell: number; category: string; unit: string; weight: string; spec: string }[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);
                    const rowName = cols[nameColIdx] || '';
                    const rowPriceImport = priceImportColIdx >= 0 ? cols[priceImportColIdx] : '';
                    const rowPriceSell = priceSellColIdx >= 0 ? cols[priceSellColIdx] : (priceImportColIdx >= 0 ? cols[priceImportColIdx] : '');
                    const rowStock = stockColIdx >= 0 ? Number(cols[stockColIdx]?.replace(/[^\d.-]/g, '')) : 0;
                    const rowCat = catColIdx >= 0 ? (cols[catColIdx] || '').trim() : '';
                    const rowUnit = unitColIdx >= 0 ? (cols[unitColIdx] || '').trim() : '';
                    const rowWeight = weightColIdx >= 0 ? (cols[weightColIdx] || '').trim() : '';
                    const rowSpec = specColIdx >= 0 ? (cols[specColIdx] || '').trim() : '';

                    if (!rowName || isNaN(rowStock)) continue;

                    const matched = findMatchingProduct(rowName, allProducts);
                    if (matched) {
                        matchedItems.push({ product: matched, newStock: rowStock });
                    } else {
                        const parsePrice = (s: string) => Number((s || '').replace(/[^\d.-]/g, '')) || 0;
                        notFoundItems.push({
                            name: rowName,
                            stock: rowStock,
                            priceImport: parsePrice(rowPriceImport),
                            priceSell: parsePrice(rowPriceSell) || parsePrice(rowPriceImport),
                            category: rowCat,
                            unit: rowUnit,
                            weight: rowWeight,
                            spec: rowSpec
                        });
                    }
                }

                if (matchedItems.length === 0 && notFoundItems.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy sản phẩm nào khớp trong ${lines.length - 1} dòng.\nDanh sách từ sheet: ${notFoundItems.map(i => i.name).join(', ')}` }]);
                    setIsLoading(false);
                    return;
                }

                // Build confirmation message
                const parts: string[] = [];
                if (matchedItems.length > 0) {
                    parts.push(`📦 **${matchedItems.length}** sản phẩm sẽ được cập nhật tồn kho`);
                }
                if (notFoundItems.length > 0) {
                    parts.push(`🆕 **${notFoundItems.length}** sản phẩm mới sẽ được tạo: ${notFoundItems.map(i => i.name).join(', ')}`);
                }
                const confirmMsg = parts.join('\n') + '\n\nXác nhận thực hiện?';

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: confirmMsg,
                    parsedData: {
                        intent: 'CONFIRM_IMPORT',
                        import_items: matchedItems,
                        not_found: notFoundItems,
                        new_products: notFoundItems.map(nf => ({
                            name: nf.name,
                            stock: nf.stock,
                            priceImport: nf.priceImport || 0,
                            priceSell: nf.priceSell || 0,
                            category: nf.category || '',
                            unit: nf.unit || '',
                            weight: nf.weight || '',
                            spec: nf.spec || ''
                        }))
                    } }]);
            } catch (err: any) {
                console.error('IMPORT_INVENTORY error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi khi đọc Google Sheet: ${err.message || 'Sheet có thể chưa được chia sẻ công khai.'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CONFIRM_IMPORT') {
            // 📊 Xác nhận cập nhật tồn kho + tạo sản phẩm mới từ import
            try {
                if (!data.import_items?.length && !data.new_products?.length) return;
                setIsLoading(true);

                let updatedCount = 0;
                let createdCount = 0;

                // 1. Update stock for matched products
                for (const item of (data.import_items || [])) {
                    const newStock = Number(item.newStock) || 0;
                    await updateDoc(doc(db, 'products', item.product.id), {
                        stock: newStock,
                        updatedAt: serverTimestamp()
                    });
                    // Write individual log
                    await addDoc(collection(db, 'inventory_logs'), {
                        productId: item.product.id,
                        productName: item.product.name,
                        sku: item.product.sku || '',
                        qty: newStock,
                        type: 'import',
                        action: 'Import Google Sheet',
                        previousStock: Number(item.product.stock) || 0,
                        newStock: newStock,
                        note: 'Import từ Google Sheet qua SaleBot',
                        createdAt: serverTimestamp(),
                        ownerId: owner.ownerId,
                        user: auth.currentUser?.displayName || 'Unknown'
                    });
                    updatedCount++;
                }

                // 2. Create new products from unmatched items
                for (const np of (data.new_products || [])) {
                    const stock = Number(np.stock) || 0;
                    const priceImport = Number(np.priceImport) || 0;
                    const priceSell = Number(np.priceSell) || priceImport || 0;
                    const sku = `DV-${Math.floor(100000 + Math.random() * 900000)}`;

                    const newProdRef = await addDoc(collection(db, 'products'), {
                        name: np.name,
                        sku: sku,
                        stock: stock,
                        priceImport: priceImport,
                        priceSell: priceSell,
                        category: np.category || 'Tôn lợp',
                        unit: np.unit || 'm2',
                        density: np.weight || '',
                        specification: np.spec || '',
                        status: 'Kinh doanh',
                        createdAt: serverTimestamp(),
                        ownerId: owner.ownerId,
                        ownerEmail: owner.ownerEmail,
                        createdBy: auth.currentUser?.uid,
                        createdByEmail: auth.currentUser?.email
                    });

                    // Write inventory log for initial stock
                    if (stock > 0) {
                        await addDoc(collection(db, 'inventory_logs'), {
                            productId: newProdRef.id,
                            productName: np.name,
                            sku: sku,
                            qty: stock,
                            type: 'init',
                            action: 'Khởi tạo',
                            previousStock: 0,
                            newStock: stock,
                            note: 'Tạo mới từ Google Sheet qua SaleBot',
                            createdAt: serverTimestamp(),
                            ownerId: owner.ownerId,
                            user: auth.currentUser?.displayName || 'Unknown'
                        });
                    }
                    createdCount++;
                }

                const resultParts: string[] = [];
                if (updatedCount > 0) resultParts.push(`📦 Cập nhật tồn: **${updatedCount}** SP`);
                if (createdCount > 0) resultParts.push(`🆕 Tạo mới: **${createdCount}** SP`);

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `✅ Hoàn tất! ${resultParts.join(' | ')}` }]);
            } catch (err: any) {
                console.error('CONFIRM_IMPORT error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'IMPORT_CREATE_PRODUCTS') {
            // 📦 Tạo danh sách sản phẩm mới từ Google Sheet
            try {
                if (!data.import_url) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không tìm thấy link Google Sheet. Anh/chị vui lòng gửi lại link đầy đủ.' }]);
                    return;
                }
                setIsLoading(true);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: '⏳ Đang đọc dữ liệu từ Google Sheet...' }]);

                // Chuyển Google Sheet URL → CSV export
                let csvUrl = data.import_url;
                const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (!match) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Link Google Sheet không đúng định dạng. Cần link dạng: https://docs.google.com/spreadsheets/d/...' }]);
                    setIsLoading(false);
                    return;
                }
                const sheetId = match[1];
                const gidMatch = csvUrl.match(/gid=(\d+)/);
                const gid = gidMatch ? gidMatch[1] : '0';
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

                const res = await fetch(csvUrl);
                if (!res.ok) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không đọc được Google Sheet. Sheet cần được chia sẻ công khai (Anyone with link).' }]);
                    setIsLoading(false);
                    return;
                }

                const csvText = await res.text();
                const lines = csvText.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Sheet trống hoặc không có dữ liệu.' }]);
                    setIsLoading(false);
                    return;
                }

                // Parse header để tìm cột (KHÔNG có cột tồn kho)
                const parseCSVLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (const ch of line) {
                        if (ch === '"') { inQuotes = !inQuotes; continue; }
                        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
                        current += ch;
                    }
                    result.push(current.trim());
                    return result;
                };

                const headers = parseCSVLine(lines[0]).map(h => normalizeVN(h));
                const nameColIdx = headers.findIndex((h: string) => 
                    h.includes('ten') || h.includes('sanpham') || h.includes('product') || h.includes('name') || h.includes('hanghoa'));
                const specColIdx = headers.findIndex((h: string) =>
                    h.includes('quycach') || h.includes('spec') || h.includes('kichthuoc') || h.includes('size') || h.includes('dacdiem'));
                const weightColIdx = headers.findIndex((h: string) =>
                    h.includes('trongluong') || h.includes('weight') || h.includes('density') || h.includes('matdo') || h.includes('khoiluong') || h.includes('kg'));
                const priceSellColIdx = headers.findIndex((h: string) =>
                    h.includes('giaban') || h.includes('ban') || h.includes('retail') || h.includes('le') || h.includes('gia'));
                const catColIdx = headers.findIndex((h: string) =>
                    h.includes('danhmuc') || h.includes('loai') || h.includes('category') || h.includes('nhom'));
                const unitColIdx = headers.findIndex((h: string) =>
                    h.includes('donvi') || h.includes('unit') || h.includes('dvt') || h.includes('tinh'));
                const priceImportColIdx = headers.findIndex((h: string) =>
                    h.includes('gianhap') || h.includes('giavon') || h.includes('cost') || h.includes('nhap'));

                if (nameColIdx < 0) {
                    const cols = headers.join(', ');
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy cột "Tên sản phẩm". Các cột hiện có: ${cols}. Vui lòng đặt tên cột có chữ "tên" hoặc "sản phẩm".` }]);
                    setIsLoading(false);
                    return;
                }

                // Parse từng dòng — tất cả đều là sản phẩm mới
                const newProducts: { name: string; spec: string; weight: string; priceSell: number; priceImport: number; category: string; unit: string }[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);
                    const rowName = (cols[nameColIdx] || '').trim();
                    if (!rowName) continue;

                    const rowSpec = specColIdx >= 0 ? (cols[specColIdx] || '').trim() : '';
                    const rowWeight = weightColIdx >= 0 ? (cols[weightColIdx] || '').trim() : '';
                    const parsePrice = (s: string) => Number((s || '').replace(/[^\d.-]/g, '')) || 0;
                    const rowPriceSell = priceSellColIdx >= 0 ? parsePrice(cols[priceSellColIdx]) : 0;
                    const rowPriceImport = priceImportColIdx >= 0 ? parsePrice(cols[priceImportColIdx]) : 0;
                    const rowCat = catColIdx >= 0 ? (cols[catColIdx] || '').trim() : '';
                    const rowUnit = unitColIdx >= 0 ? (cols[unitColIdx] || '').trim() : '';

                    newProducts.push({
                        name: rowName,
                        spec: rowSpec,
                        weight: rowWeight,
                        priceSell: rowPriceSell,
                        priceImport: rowPriceImport,
                        category: rowCat,
                        unit: rowUnit
                    });
                }

                if (newProducts.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không tìm thấy sản phẩm nào trong sheet.' }]);
                    setIsLoading(false);
                    return;
                }

                // Check trùng tên với sản phẩm hiện có
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(qProd);
                const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

                const duplicateNames: string[] = [];
                const missingPriceProducts: string[] = [];
                for (const np of newProducts) {
                    const found = findMatchingProduct(np.name, allProducts);
                    if (found) duplicateNames.push(np.name);
                    if (np.priceSell <= 0) missingPriceProducts.push(np.name);
                }

                const confirmMsg = `📦 **${newProducts.length}** sản phẩm mới sẽ được tạo:\n\n` + 
                    newProducts.slice(0, 20).map(p => 
                        `• ${p.name}${p.spec ? ` — ${p.spec}` : ''}${p.weight ? ` — ${p.weight}` : ''}${p.priceSell > 0 ? ` — ${p.priceSell.toLocaleString('vi-VN')}đ` : ' ⚠️ Chưa có giá bán'}${p.category ? ` [${p.category}]` : ''}${p.unit ? ` /${p.unit}` : ''}`
                    ).join('\n') +
                    (newProducts.length > 20 ? `\n...và ${newProducts.length - 20} sản phẩm khác` : '') +
                    (duplicateNames.length > 0 ? `\n\n⚠️ **${duplicateNames.length}** sản phẩm trùng tên với sản phẩm hiện có: ${duplicateNames.join(', ')}. Các sản phẩm này sẽ được tạo với SKU mới.` : '') +
                    (missingPriceProducts.length > 0 ? `\n\n⚠️ **${missingPriceProducts.length}** sản phẩm chưa có giá bán: ${missingPriceProducts.join(', ')}.` : '') +
                    '\n\nXác nhận tạo danh sách sản phẩm?';

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: confirmMsg,
                    parsedData: {
                        intent: 'CONFIRM_CREATE_PRODUCTS',
                        new_products: newProducts.map(np => ({
                            name: np.name,
                            spec: np.spec,
                            weight: np.weight,
                            priceSell: np.priceSell,
                            priceImport: np.priceImport,
                            category: np.category,
                            unit: np.unit
                        }))
                    } }]);
            } catch (err: any) {
                console.error('IMPORT_CREATE_PRODUCTS error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi khi đọc Google Sheet: ${err.message || 'Sheet có thể chưa được chia sẻ công khai.'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CONFIRM_CREATE_PRODUCTS') {
            // 📦 Xác nhận tạo danh sách sản phẩm mới từ Google Sheet
            try {
                if (!data.new_products?.length) return;
                setIsLoading(true);

                // Lấy tất cả SKU hiện có để sinh SKU không trùng
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(qProd);
                const existingProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
                const existingSkus = new Set(existingProducts.map((p: any) => (p.sku || '').toUpperCase()));
                
                // 🏷️ Sinh SKU không trùng
                function generateUniqueSku(): string {
                    let sku: string;
                    let attempts = 0;
                    do {
                        const num = Math.floor(100000 + Math.random() * 900000);
                        sku = `DV-${num}`;
                        attempts++;
                    } while (existingSkus.has(sku) && attempts < 100);
                    if (existingSkus.has(sku)) {
                        // fallback với timestamp nếu random 100 lần vẫn trùng
                        const ts = Date.now().toString(36).toUpperCase().slice(-4);
                        sku = `DV-${ts}${Math.floor(1000 + Math.random() * 9000)}`;
                    }
                    existingSkus.add(sku);
                    return sku;
                }

                let createdCount = 0;
                const skippedNames: string[] = [];

                for (const np of data.new_products) {
                    const priceImport = Number(np.priceImport) || 0;
                    const priceSell = Number(np.priceSell) || 0;
                    const sku = generateUniqueSku();

                    try {
                        const newProdRef = await addDoc(collection(db, 'products'), {
                            name: np.name,
                            sku: sku,
                            stock: 0,
                            priceImport: priceImport,
                            priceSell: priceSell,
                            category: np.category || 'Vật liệu khác',
                            unit: np.unit || 'cái',
                            density: np.weight || '',
                            specification: np.spec || '',
                            status: 'Kinh doanh',
                            createdAt: serverTimestamp(),
                            ownerId: owner.ownerId,
                            ownerEmail: owner.ownerEmail,
                            createdBy: auth.currentUser?.uid,
                            createdByEmail: auth.currentUser?.email
                        });

                        // Ghi inventory_logs cho sản phẩm mới được tạo
                        await addDoc(collection(db, 'inventory_logs'), {
                            productId: newProdRef.id,
                            productName: np.name,
                            sku: sku,
                            qty: 0,
                            type: 'import',
                            action: 'Tạo sản phẩm mới từ Sheet',
                            previousStock: 0,
                            newStock: 0,
                            note: `Tạo mới từ Google Sheet qua SaleBot — Giá bán: ${priceSell.toLocaleString('vi-VN')}đ`,
                            createdAt: serverTimestamp(),
                            ownerId: owner.ownerId,
                            user: auth.currentUser?.displayName || 'Unknown'
                        });
                        createdCount++;
                    } catch (e: any) {
                        console.error('Create product error:', e);
                        skippedNames.push(np.name);
                    }
                }

                const parts: string[] = [];
                if (createdCount > 0) parts.push(`🆕 Đã tạo: **${createdCount}** sản phẩm`);
                if (skippedNames.length > 0) parts.push(`⚠️ Lỗi: ${skippedNames.join(', ')}`);

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `✅ Hoàn tất! ${parts.join(' | ')}\n\n💡 Mẹo: Dùng "nhập kho" + link Sheet để cập nhật số lượng tồn sau khi tạo sản phẩm.` }]);
            } catch (err: any) {
                console.error('CONFIRM_CREATE_PRODUCTS error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'IMPORT_ORDER_FROM_SHEET') {
            // 📋 Tạo đơn hàng từ Google Sheet
            try {
                if (!data.import_url) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không tìm thấy link Google Sheet.' }]);
                    return;
                }
                setIsLoading(true);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: '⏳ Đang đọc danh sách sản phẩm từ Google Sheet...' }]);

                // Parse Sheet URL → CSV
                let csvUrl = data.import_url;
                const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (!match) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Link Google Sheet không đúng định dạng.' }]);
                    setIsLoading(false); return;
                }
                const sheetId = match[1];
                const gidMatch = csvUrl.match(/gid=(\d+)/);
                const gid = gidMatch ? gidMatch[1] : '0';
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

                const res = await fetch(csvUrl);
                if (!res.ok) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không đọc được Sheet. Sheet cần được chia sẻ công khai (Anyone with link).' }]);
                    setIsLoading(false); return;
                }

                const csvText = await res.text();
                const lines = csvText.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Sheet trống hoặc không có dữ liệu.' }]);
                    setIsLoading(false); return;
                }

                // Parse CSV
                const parseCSVLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = ''; let inQuotes = false;
                    for (const ch of line) {
                        if (ch === '"') { inQuotes = !inQuotes; continue; }
                        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
                        current += ch;
                    }
                    result.push(current.trim());
                    return result;
                };

                const headers = parseCSVLine(lines[0]).map(h => normalizeVN(h));
                const nameColIdx = headers.findIndex((h: string) =>
                    h.includes('ten') || h.includes('sanpham') || h.includes('product') || h.includes('name'));
                const qtyColIdx = headers.findIndex((h: string) =>
                    h.includes('soluong') || h.includes('qty') || h.includes('quantity') || h.includes('so') || h.includes('sl'));
                const catColIdx = headers.findIndex((h: string) =>
                    h.includes('danhmuc') || h.includes('loai') || h.includes('category') || h.includes('nhom'));
                const noteColIdx = headers.findIndex((h: string) =>
                    h.includes('ghichu') || h.includes('note') || h.includes('mota'));

                if (nameColIdx < 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy cột "Tên sản phẩm". Các cột: ${headers.join(', ')}` }]);
                    setIsLoading(false); return;
                }

                // Lấy tất cả sản phẩm
                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(qProd);
                const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

                // Parse từng dòng
                const orderItems: any[] = [];
                const notFound: string[] = [];
                let orderNote = '';

                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);
                    const rowName = (cols[nameColIdx] || '').trim();
                    if (!rowName) continue;

                    const rowQty = qtyColIdx >= 0 ? parseInt(cols[qtyColIdx], 10) || 1 : 1;
                    const rowCat = catColIdx >= 0 ? (cols[catColIdx] || '').trim() : '';
                    if (noteColIdx >= 0 && cols[noteColIdx]) orderNote = cols[noteColIdx].trim();

                    const matched = findMatchingProduct(rowName, allProducts, rowCat);
                    if (matched) {
                        orderItems.push({
                            product: matched,
                            quantity: rowQty,
                            price: Number(matched.priceSell) || Number(matched.priceImport) || 0
                        });
                    } else {
                        notFound.push(rowName);
                    }
                }

                if (orderItems.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy sản phẩm nào khớp.\nDanh sách: ${notFound.join(', ')}` }]);
                    setIsLoading(false); return;
                }

                const totalAmount = orderItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
                const itemsSummary = orderItems.map(it =>
                    `• ${it.product.name} x${it.quantity} = ${(it.price * it.quantity).toLocaleString('vi-VN')}đ`
                ).join('\n');

                const confirmMsg = `📋 **Đơn hàng từ Sheet**\n\n${itemsSummary}\n\n💰 Tổng: **${totalAmount.toLocaleString('vi-VN')}đ**${orderNote ? '\n📝 Ghi chú: ' + orderNote : ''}${notFound.length > 0 ? '\n\n⚠️ Không tìm thấy: ' + notFound.join(', ') : ''}\n\n👤 Nhập **tên khách hàng** → mở form lên đơn với danh sách đã fill sẵn.`;

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: confirmMsg,
                    parsedData: {
                        intent: 'CONFIRM_ORDER_FROM_SHEET',
                        order_items: orderItems,
                        total: totalAmount,
                        note: orderNote,
                        not_found: notFound
                    } }]);
            } catch (err: any) {
                console.error('IMPORT_ORDER error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CONFIRM_ORDER_FROM_SHEET') {
            // 📋 Xác nhận tạo đơn từ sheet → mở form QuickOrder với dữ liệu prefill
            try {
                const customerName = data.customer_name?.trim() || input.trim();
                if (!customerName) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '👤 Vui lòng nhập tên khách hàng để tiếp tục.',
                        parsedData: { ...data, intent: 'CONFIRM_ORDER_FROM_SHEET' } }]);
                    return;
                }
                if (!data.order_items?.length) return;

                // Chuyển sang form QuickOrder với dữ liệu prefill
                const prefillData = {
                    customer: { name: customerName },
                    products: data.order_items.map((it: any) => ({
                        name: it.product.name,
                        productId: it.product.id,
                        sku: it.product.sku || '',
                        quantity: it.quantity,
                        price: it.price,
                        unit: it.product.unit || 'm2'
                    })),
                    note: data.note || ''
                };
                navigate('/quick-order', { state: { prefill: prefillData } });
            } catch (err: any) {
                console.error('CONFIRM_ORDER_FROM_SHEET error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
            }
        } else if (data.intent === 'IMPORT_PURCHASE_ORDER_FROM_SHEET') {
            // 📦 Tạo đơn MUA hàng (Purchase Order) từ Google Sheet
            try {
                if (!data.import_url) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không tìm thấy link Google Sheet.' }]);
                    return;
                }
                setIsLoading(true);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: '⏳ Đang đọc danh sách sản phẩm từ Google Sheet...' }]);

                let csvUrl = data.import_url;
                const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (!match) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Link Google Sheet không đúng định dạng.' }]);
                    setIsLoading(false); return;
                }
                const sheetId = match[1];
                const gidMatch = csvUrl.match(/gid=(\d+)/);
                const gid = gidMatch ? gidMatch[1] : '0';
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

                const res = await fetch(csvUrl);
                if (!res.ok) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Không đọc được Sheet. Sheet cần được chia sẻ công khai (Anyone with link).' }]);
                    setIsLoading(false); return;
                }

                const csvText = await res.text();
                const lines = csvText.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '❌ Sheet trống hoặc không có dữ liệu.' }]);
                    setIsLoading(false); return;
                }

                const parseCSVLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = ''; let inQuotes = false;
                    for (const ch of line) {
                        if (ch === '"') { inQuotes = !inQuotes; continue; }
                        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
                        current += ch;
                    }
                    result.push(current.trim());
                    return result;
                };

                const headers = parseCSVLine(lines[0]).map(h => normalizeVN(h));
                const nameColIdx = headers.findIndex((h: string) =>
                    h.includes('ten') || h.includes('sanpham') || h.includes('product') || h.includes('name'));
                const qtyColIdx = headers.findIndex((h: string) =>
                    h.includes('soluong') || h.includes('qty') || h.includes('quantity') || h.includes('so') || h.includes('sl'));
                const priceColIdx = headers.findIndex((h: string) =>
                    h.includes('gia') || h.includes('price') || h.includes('dongia') || h.includes('don'));
                const noteColIdx = headers.findIndex((h: string) =>
                    h.includes('ghichu') || h.includes('note') || h.includes('mota'));

                if (nameColIdx < 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy cột "Tên sản phẩm". Các cột: ${headers.join(', ')}` }]);
                    setIsLoading(false); return;
                }

                const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
                const snap = await getDocs(qProd);
                const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

                const orderItems: any[] = [];
                const notFound: string[] = [];
                let orderNote = '';

                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);
                    const rowName = (cols[nameColIdx] || '').trim();
                    if (!rowName) continue;

                    const rowQty = qtyColIdx >= 0 ? parseInt(cols[qtyColIdx], 10) || 1 : 1;
                    const rowPrice = priceColIdx >= 0 ? parseFloat(cols[priceColIdx].replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : 0;
                    if (noteColIdx >= 0 && cols[noteColIdx]) orderNote = cols[noteColIdx].trim();

                    const matched = findMatchingProduct(rowName, allProducts);
                    if (matched) {
                        orderItems.push({
                            product: matched,
                            quantity: rowQty,
                            price: rowPrice || Number(matched.priceImport) || Number(matched.priceSell) || 0
                        });
                    } else {
                        notFound.push(rowName);
                    }
                }

                if (orderItems.length === 0) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: `❌ Không tìm thấy sản phẩm nào khớp.\nDanh sách: ${notFound.join(', ')}` }]);
                    setIsLoading(false); return;
                }

                const totalAmount = orderItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
                const itemsSummary = orderItems.map(it =>
                    `• ${it.product.name} x${it.quantity} = ${(it.price * it.quantity).toLocaleString('vi-VN')}đ`
                ).join('\n');

                const confirmMsg = `📦 **Đơn Mua Hàng từ Sheet**\n\n${itemsSummary}\n\n💰 Tổng tiền mua: **${totalAmount.toLocaleString('vi-VN')}đ**${orderNote ? '\n📝 Ghi chú: ' + orderNote : ''}${notFound.length > 0 ? '\n\n⚠️ Không tìm thấy: ' + notFound.join(', ') : ''}\n\n🏭 Nhập **tên nhà cung cấp** để em tạo đơn mua hàng.`;

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot', content: confirmMsg,
                    parsedData: {
                        intent: 'CONFIRM_PURCHASE_ORDER_FROM_SHEET',
                        order_items: orderItems,
                        total: totalAmount,
                        note: orderNote,
                        not_found: notFound
                    } }]);
            } catch (err: any) {
                console.error('IMPORT_PURCHASE_ORDER error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CONFIRM_PURCHASE_ORDER_FROM_SHEET') {
            // 📦 Xác nhận tạo đơn mua hàng → tạo purchase_order trong Firestore
            try {
                const supplierName = data.supplier_name?.trim() || input.trim();
                if (!supplierName) {
                    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                        content: '🏭 Vui lòng nhập tên nhà cung cấp để tiếp tục.',
                        parsedData: { ...data, intent: 'CONFIRM_PURCHASE_ORDER_FROM_SHEET' } }]);
                    return;
                }
                if (!data.order_items?.length) return;

                setIsLoading(true);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: '⏳ Đang tạo đơn mua hàng...' }]);

                const items = data.order_items.map((it: any) => ({
                    productId: it.product.id,
                    name: it.product.name,
                    qty: it.quantity,
                    price: it.price,
                    unit: it.product.unit || '',
                    total: it.price * it.quantity
                }));

                await purchaseOrderService.create({
                    ownerId: owner.ownerId,
                    supplierName: supplierName,
                    items: items,
                    totalAmount: data.total,
                    note: data.note || '',
                    status: 'Chờ nhập kho',
                    createdBy: auth.currentUser?.uid || '',
                    createdByEmail: auth.currentUser?.email || '',
                });

                const itemsSummary = items.map((it: any) =>
                    `• ${it.name} x${it.qty} = ${it.total.toLocaleString('vi-VN')}đ`
                ).join('\n');

                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `✅ Đã tạo đơn mua hàng thành công!\n\n🏭 Nhà cung cấp: **${supplierName}**\n${itemsSummary}\n💰 Tổng: **${data.total.toLocaleString('vi-VN')}đ**\n\n📦 Trạng thái: Chờ nhập kho` }]);

                navigate('/purchase-orders');
            } catch (err: any) {
                console.error('CONFIRM_PURCHASE_ORDER error:', err);
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bot',
                    content: `❌ Lỗi: ${err.message || 'Không xác định'}` }]);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CREATE_CUSTOMER') {
            try {
                if (!owner.ownerId) {
                    alert("Không thể xác thực quyền truy cập. Vui lòng thử lại sau.");
                    return;
                }
                setIsLoading(true);
                
                let finalLat = null;
                let finalLng = null;
                let finalAddress = data.customer?.address || '';

                if (data.customer?.use_current_location) {
                    try {
                        setMessages(prev => [...prev, {
                            id: crypto.randomUUID() + '_loc',
                            role: 'bot',
                            content: `📍 Đang lấy vị trí hiện tại của bạn...`
                        }]);

                        const position: any = await new Promise((resolve, reject) => {
                            if (!navigator.geolocation) reject("Geolocation not supported");
                            navigator.geolocation.getCurrentPosition(resolve, reject);
                        });
                        finalLat = position.coords.latitude;
                        finalLng = position.coords.longitude;
                        
                        // Lấy địa chỉ cụ thể qua Nominatim
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLat}&lon=${finalLng}&zoom=18&addressdetails=1`, {
                                headers: { 'Accept-Language': 'vi' }
                            });
                            const geoData = await res.json();
                            if (geoData.display_name) {
                                finalAddress = geoData.display_name;
                            }
                        } catch (e) {}

                    } catch (err) {
                        console.error("Lỗi lấy vị trí:", err);
                        alert("Không thể tự động lấy vị trí. Vui lòng cấp quyền GPS cho trình duyệt.");
                    }
                }
                
                const customerData = {
                    name: data.customer?.name || 'Khách vãng lai',
                    phone: data.customer?.phone || '',
                    address: finalAddress,
                    lat: finalLat,
                    lng: finalLng,
                    type: data.customer?.type || 'Chủ nhà',
                    status: 'Hoạt động',
                    creditLimit: 0,
                    ownerId: owner.ownerId,
                    ownerEmail: owner.ownerEmail,
                    createdBy: auth.currentUser?.uid,
                    createdByEmail: auth.currentUser?.email || '',
                    createdAt: serverTimestamp()
                };

                await addDoc(collection(db, 'customers'), customerData);
                
                await addDoc(collection(db, 'audit_logs'), {
                    action: 'Thêm khách hàng (Qua Bot)',
                    user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
                    userId: auth.currentUser?.uid || "",
                    ownerId: owner.ownerId,
                    details: `AI Bot đã tạo khách hàng: ${customerData.name}`,
                    createdAt: serverTimestamp()
                });

                // Cập nhật tin nhắn thành công
                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'bot',
                    content: `🎉 Tự động hóa thành công! Hồ sơ khách hàng **${customerData.name}** đã được lưu thẳng vào hệ thống mà không cần bạn điền form.`
                }]);
            } catch (error) {
                console.error("Lỗi tạo khách hàng:", error);
                alert("Lỗi khi tự động tạo khách hàng.");
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CREATE_PRODUCT') {
            try {
                if (!owner.ownerId) {
                    alert("Không thể xác thực quyền truy cập. Vui lòng thử lại sau.");
                    return;
                }
                setIsLoading(true);
                
                const productsToCreate = data.products_to_create || [];
                if (productsToCreate.length === 0) {
                    alert("Dữ liệu sản phẩm không hợp lệ.");
                    setIsLoading(false);
                    return;
                }

                // 🔴 BẮT BUỘC: Kiểm tra danh mục cho từng sản phẩm
                const missingCategory = productsToCreate.filter((p: any) => !p.category || p.category.trim() === '');
                if (missingCategory.length > 0) {
                    const names = missingCategory.map((p: any) => p.name).join(', ');
                    setMessages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        role: 'bot',
                        content: `⚠️ **Thiếu danh mục** cho: ${names}\n\nAnh/chị vui lòng cho em biết danh mục của sản phẩm này (VD: Sơn, Nhựa và phụ kiện, Vật liệu xây dựng...).\n\n💡 Gõ: \"sửa danh mục ${missingCategory[0].name} thành [tên danh mục]\"`
                    }]);
                    setIsLoading(false);
                    return;
                }

                let successCount = 0;
                let firstProductName = "";

                // 📋 Lấy tất cả SKU hiện có để tránh trùng
                const existingSnap = await getDocs(query(collection(db, 'products'), where('ownerId', '==', owner.ownerId)));
                const existingSkus = new Set(existingSnap.docs.map(d => d.data().sku).filter(Boolean));

                const generateUniqueSku = (idx: number): string => {
                    for (let attempt = 0; attempt < 10; attempt++) {
                        const sku = 'SP' + String(1000 + Math.floor(Math.random() * 9000)) + crypto.randomUUID().slice(-4) + String(idx);
                        if (!existingSkus.has(sku)) return sku;
                    }
                    // Fallback: timestamp-based
                    return 'SP' + Date.now().toString(36).toUpperCase() + String(idx);
                };

                for (let i = 0; i < productsToCreate.length; i++) {
                    const pInfo = productsToCreate[i];
                    if (!pInfo.name) continue;

                    const generatedSku = generateUniqueSku(i);
                    existingSkus.add(generatedSku); // Đánh dấu đã dùng trong batch này

                    const productData = {
                        name: pInfo.name,
                        sku: generatedSku,
                        category: pInfo.category,
                        priceImport: pInfo.import_price || 0,
                        priceSell: pInfo.retail_price || 0,
                        stock: 0,
                        unit: 'Cái', // Mặc định
                        specification: pInfo.specs || '',
                        packaging: pInfo.packaging || '',
                        density: pInfo.weight || '',
                        status: 'Kinh doanh',
                        createdAt: serverTimestamp(),
                        ownerId: owner.ownerId,
                        ownerEmail: owner.ownerEmail,
                        createdBy: auth.currentUser?.uid || "",
                        createdByEmail: auth.currentUser?.email || "",
                        linkedProductId: ''
                    };

                    await addDoc(collection(db, 'products'), productData);
                    
                    if (successCount === 0) firstProductName = productData.name;
                    successCount++;
                }

                if (successCount > 0) {
                    await addDoc(collection(db, 'audit_logs'), {
                        action: 'Thêm sản phẩm mới (Qua Bot)',
                        user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
                        userId: auth.currentUser?.uid || "",
                        ownerId: owner.ownerId,
                        details: `AI Bot đã tạo ${successCount} sản phẩm. (Bao gồm: ${firstProductName}${successCount > 1 ? '...' : ''})`,
                        createdAt: serverTimestamp()
                    });

                    // Cập nhật tin nhắn thành công
                    setMessages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        role: 'bot',
                        content: `🎉 Tự động hóa thành công! Đã lưu ${successCount} sản phẩm thẳng vào kho hàng.`
                    }]);
                } else {
                    alert("Không có sản phẩm nào hợp lệ để tạo.");
                }
            } catch (error) {
                console.error("Lỗi tạo sản phẩm:", error);
                alert("Lỗi khi tự động tạo sản phẩm.");
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'UPDATE_CUSTOMER') {
            try {
                setIsLoading(true);
                
                // Sửa lỗi Gemini gán nhầm tên khách hàng vào biến ID khi submit
                if (data.customer?.id && data.customer.id.length < 15 && !data.customer?.name) {
                    data.customer.name = data.customer.id;
                    data.customer.id = undefined;
                }
                
                let targetId = data.customer?.id;

                // KIỂM TRA TRƯỚC: Nếu AI tự bịa ID (độ dài < 15) hoặc không có ID, ta tự tìm bằng tên
                if ((!targetId || targetId.length < 15) && data.customer?.name && owner.ownerId) {
                    const q = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                    const snap = await getDocs(q);
                    const queryName = data.customer.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    
                    const matches = snap.docs.filter(d => {
                        const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        return dbName.includes(queryName) || queryName.includes(dbName);
                    });
                    
                    let found = null;
                    if (matches.length === 1) {
                        found = matches[0];
                    } else if (matches.length > 1) {
                        found = matches.find(d => {
                            const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            return dbName === queryName;
                        });
                    }
                    
                    if (found) {
                        targetId = found.id;
                    } else {
                        targetId = null; // Bắt buộc xoá ID bịa nếu không tìm thấy thật
                    }
                }

                if (!targetId) {
                    setIsLoading(false);
                    setMessages(prev => [...prev, {
                        id: crypto.randomUUID(), role: 'bot',
                        content: `Không tìm thấy khách hàng "${data.customer?.name || ''}" để cập nhật. Anh/chị kiểm tra lại tên hoặc tạo khách hàng mới trước nhé!`
                    }]);
                    return;
                }

                const updatePayload: any = {
                    updatedAt: serverTimestamp(),
                    ownerId: owner.ownerId // Quan trọng: Truyền ownerId để pass Firestore Rules v2
                };
                if (auth.currentUser?.uid) {
                    updatePayload.updatedBy = auth.currentUser.uid;
                }

                if (data.customer.name) updatePayload.name = data.customer.name;
                if (data.customer.phone) updatePayload.phone = data.customer.phone;
                if (data.customer.address) updatePayload.address = data.customer.address;
                if (data.customer.type) updatePayload.type = data.customer.type;

                try {
                    await updateDoc(doc(db, 'customers', targetId), updatePayload);
                } catch (updateErr: any) {
                    console.error("Lỗi updateDoc customers:", updateErr);
                    throw new Error("Lỗi cập nhật CSDL: " + updateErr.message);
                }

                try {
                    await addDoc(collection(db, 'audit_logs'), {
                        action: 'Cập nhật khách hàng (Qua Bot)',
                        user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
                        userId: auth.currentUser?.uid || "unknown",
                        ownerId: owner.ownerId,
                        details: `AI Bot đã cập nhật hồ sơ: ${data.customer.name || targetId}`,
                        createdAt: serverTimestamp()
                    });
                } catch (auditErr) {
                    console.error("Lỗi lưu audit_logs:", auditErr);
                }

                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'bot',
                    content: `✅ Đã cập nhật thành công hồ sơ khách hàng!`
                }]);
            } catch (error: any) {
                console.error("Lỗi cập nhật khách hàng chung:", error);
                alert(`Lỗi khi tự động cập nhật khách hàng: ${error?.message || JSON.stringify(error)}`);
            } finally {
                setIsLoading(false);
            }
        } else if (data.intent === 'CREATE_PAYMENT') {
            try {
                if (!owner.ownerId) {
                    alert("Không thể xác thực quyền truy cập. Vui lòng thử lại sau.");
                    return;
                }
                setIsLoading(true);

                let targetId = data.customer?.id;
                let targetName = data.customer?.name;

                // Tự tìm ID khách hàng bằng tên nếu chưa có
                if (!targetId && targetName) {
                    const q = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                    const snap = await getDocs(q);
                    const queryName = targetName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    
                    const matches = snap.docs.filter(d => {
                        const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const dbBusiness = (d.data().businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        
                        const matchName = dbName && (dbName.includes(queryName) || queryName.includes(dbName));
                        const matchBusiness = dbBusiness && (dbBusiness.includes(queryName) || queryName.includes(dbBusiness));
                        
                        return matchName || matchBusiness;
                    });
                    
                    let found = null;
                    if (matches.length === 1) {
                        found = matches[0];
                    } else if (matches.length > 1) {
                        found = matches.find(d => {
                            const dbName = (d.data().name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const dbBusiness = (d.data().businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            return dbName === queryName || dbBusiness === queryName;
                        });
                    }
                    
                    if (found) {
                        targetId = found.id;
                        targetName = found.data().businessName || found.data().name;
                    }
                }

                if (!targetId) {
                    setIsLoading(false);
                    // Gợi ý các khách hàng gần giống thay vì alert
                    const qS = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
                    const snapS = await getDocs(qS);
                    const searchName = (data.customer?.name || '').toLowerCase();
                    const queryNameS = searchName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const words = queryNameS.split(' ').filter(Boolean);
                    const suggestions = snapS.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter((c: any) => {
                            const cName = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const cBiz = (c.businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            return words.some((w: string) => cName.includes(w) || cBiz.includes(w));
                        })
                        .slice(0, 3);
                    
                    if (suggestions.length > 0) {
                        setMessages(prev => [...prev, {
                            id: crypto.randomUUID(), role: 'bot',
                            content: `Em không tìm thấy khách hàng "${data.customer?.name || ''}". Có phải anh/chị muốn thu tiền của một trong những khách hàng dưới đây không ạ?`,
                            parsedData: { intent: 'UNKNOWN', searchResults: suggestions }
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            id: crypto.randomUUID(), role: 'bot',
                            content: `Không tìm thấy dữ liệu khách hàng "${data.customer?.name || ''}" trong hệ thống. Anh/chị vui lòng kiểm tra lại hoặc tạo khách hàng mới trước nhé!`
                        }]);
                    }
                    return;
                }

                const amount = data.payment_info?.amount;
                if (!amount || amount <= 0) {
                    setIsLoading(false);
                    alert("Số tiền thu không hợp lệ.");
                    return;
                }

                // Chuyển hướng sang trang Công nợ kèm dữ liệu prefill
                navigate('/debts', {
                    state: {
                        payment: true,
                        prefillData: {
                            customerId: targetId,
                            customerName: targetName,
                            amount: amount,
                            note: data.payment_info?.note || 'Thu công nợ qua Bot',
                            date: new Date().toISOString().split('T')[0]
                        }
                    }
                });
                
            } catch (error: any) {
                console.error("Lỗi thu tiền:", error);
                alert(`Lỗi khi chuyển hướng thu tiền: ${error?.message || JSON.stringify(error)}`);
            } finally {
                setIsLoading(false);
            }
        } else {
            alert('Hành động chưa được hỗ trợ.');
        }
    };

    // 🔒 Check AI lock from Nexus
    if (owner.manualLockAi || (owner.settingsData && owner.settingsData.manualLockAi)) {
        return (
            <div className="absolute inset-0 pt-14 lg:pt-0 pb-24 lg:pb-0 z-40 bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-8">
                <div className="bg-rose-500/10 p-6 rounded-full text-rose-500 mb-6 border border-rose-500/20">
                    <Lock size={64} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-3">Trợ lý AI bị khoá</h2>
                <p className="text-slate-500 text-center max-w-sm mb-2">Quản trị viên đã tạm thời khoá Trợ lý AI cho tài khoản của bạn.</p>
                <p className="text-xs text-slate-400 text-center">Vui lòng liên hệ Admin để mở khoá.</p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 pt-14 lg:pt-0 pb-24 lg:pb-0 z-40 bg-white dark:bg-slate-900 flex flex-col">
            <div className="w-full flex flex-col h-full overflow-hidden relative">
                
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
                    {/* 💡 Gợi ý nhanh */}
                    {messages.length <= 1 && (
                        <div className="flex flex-wrap gap-2 px-1 animate-in fade-in duration-500">
                            <button onClick={() => { setInput('Tạo đơn cho '); textareaRef.current?.focus(); }}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#FF6D00] hover:text-[#FF6D00] transition-colors shadow-sm">
                                🛒 Lên đơn hàng
                            </button>
                            <button onClick={() => { fileInputRef.current?.click(); setInput('cập nhật tồn kho'); }}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#FF6D00] hover:text-[#FF6D00] transition-colors shadow-sm">
                                📸 Chụp kho
                            </button>
                            <button onClick={() => setInput('check đơn ')}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#FF6D00] hover:text-[#FF6D00] transition-colors shadow-sm">
                                🔍 Xem đơn hàng
                            </button>
                            <button onClick={() => setInput('ai đang nợ?')}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#FF6D00] hover:text-[#FF6D00] transition-colors shadow-sm">
                                💰 Công nợ
                            </button>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-[#FF6D00] text-white' : 'bg-indigo-100 dark:bg-indigo-900/40 text-[#1A237E] dark:text-indigo-400'}`}>
                                {msg.role === 'user' ? <User size={20} /> : <BotMessageSquare size={20} />}
                            </div>
                            
                            <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`px-5 py-3 rounded-2xl shadow-sm text-sm ${
                                    msg.role === 'user' 
                                        ? 'bg-[#1A237E] text-white rounded-tr-sm' 
                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                                }`}>
                                    {msg.content}
                                </div>
                                
                                {/* Preview Card if Bot returns parsed Data */}
                                {msg.parsedData && msg.parsedData.intent !== 'UNKNOWN' && (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md border border-indigo-100 dark:border-indigo-900/50 w-full animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                                            <CheckCircle2 size={18} className="text-green-500" />
                                            <span className="text-xs font-black uppercase text-slate-800 dark:text-white">
                                                {msg.parsedData.intent === 'CREATE_ORDER' ? 'Thông tin Lên Đơn' : 
                                                 msg.parsedData.intent === 'UPDATE_ORDER' ? '📝 Thêm vào Đơn Cũ' :
                                                 msg.parsedData.intent === 'REVIEW_ORDER' ? '📋 Xem Đơn Hàng' :
                                                 msg.parsedData.intent === 'FIX_ORDER' ? '🔧 Tự Sửa Lỗi Đơn' :
                                                 msg.parsedData.intent === 'CREATE_PRODUCT' ? 'Thông tin Sản Phẩm' : 
                                                 msg.parsedData.intent === 'CREATE_PAYMENT' ? 'Thông tin Thu Công Nợ' :
                                                 msg.parsedData.intent === 'INVENTORY_ACTION' ? 'Thông tin Phiếu Kho' :
                                                 msg.parsedData.intent === 'IMPORT_CREATE_PRODUCTS' ? '📦 Tạo Sản Phẩm từ Sheet' :
                                                 msg.parsedData.intent === 'CONFIRM_CREATE_PRODUCTS' ? '📦 Xác Nhận Tạo Sản Phẩm' :
                                                 msg.parsedData.intent === 'CONFIRM_IMPORT' ? '📊 Import Tồn Kho' :
                                                 msg.parsedData.intent === 'IMPORT_PURCHASE_ORDER_FROM_SHEET' ? '📦 Đơn Mua Hàng' :
                                                 msg.parsedData.intent === 'CONFIRM_PURCHASE_ORDER_FROM_SHEET' ? '📦 Xác Nhận Đơn Mua' :
                                                 'Thông tin Khách Hàng'}
                                            </span>
                                        </div>
                                        
                                        {msg.parsedData.customer && msg.parsedData.customer.name && (
                                            <div className="mb-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Khách hàng</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                    {msg.parsedData.customer.name}
                                                    {msg.parsedData.customer.type && (
                                                        <span className="ml-2 text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase">
                                                            {msg.parsedData.customer.type}
                                                        </span>
                                                    )}
                                                </p>
                                                {msg.parsedData.customer.phone && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{msg.parsedData.customer.phone}</p>}
                                                {msg.parsedData.customer.address && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{msg.parsedData.customer.address}</p>}
                                                {msg.parsedData.customer.use_current_location && (
                                                    <p className="text-xs text-blue-500 font-bold mt-1 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">my_location</span> Dùng vị trí hiện tại
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        
                                        {msg.parsedData.order_id && (msg.parsedData.intent === 'UPDATE_ORDER' || msg.parsedData.intent === 'REVIEW_ORDER' || msg.parsedData.intent === 'FIX_ORDER') && (
                                            <div className={`mb-3 p-2 px-3 rounded-lg border ${msg.parsedData.intent === 'REVIEW_ORDER' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900' : msg.parsedData.intent === 'FIX_ORDER' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'}`}>
                                                <p className={`text-[10px] font-bold uppercase ${msg.parsedData.intent === 'REVIEW_ORDER' ? 'text-blue-700 dark:text-blue-400' : msg.parsedData.intent === 'FIX_ORDER' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                                    {msg.parsedData.intent === 'REVIEW_ORDER' ? '📋 Xem đơn hàng' : msg.parsedData.intent === 'FIX_ORDER' ? '🔧 Tự sửa lỗi đơn' : '📝 Cập nhật đơn hàng'}
                                                </p>
                                                <p className={`text-xs mt-0.5 ${msg.parsedData.intent === 'REVIEW_ORDER' ? 'text-blue-600 dark:text-blue-300' : 'text-amber-600 dark:text-amber-300'}`}>ID: <span className="font-mono font-bold">{msg.parsedData.order_id}</span></p>
                                            </div>
                                        )}
                                        
                                        {msg.parsedData.products && msg.parsedData.products.length > 0 && (
                                            <div className="mb-3">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Mặt hàng ({msg.parsedData.products.length})</p>
                                                <div className="space-y-2">
                                                    {msg.parsedData.products.map((p: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                                                                {(p.category || msg.parsedData.order_category) && (
                                                                    <span className="text-[10px] text-slate-500 italic mt-0.5">Giá: {p.category || msg.parsedData.order_category}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-black text-[#FF6D00]">x{p.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {msg.parsedData.notes && (
                                            <div className="mb-3 flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                <span className="text-xs font-medium italic">Ghi chú: {msg.parsedData.notes}</span>
                                            </div>
                                        )}

                                        {msg.parsedData.shipping_fee && (
                                            <div className="mb-3 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 px-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                                <span className="text-xs font-bold text-blue-800 dark:text-blue-200">Phí vận chuyển</span>
                                                <span className="text-xs font-black text-blue-600 dark:text-blue-400">{msg.parsedData.shipping_fee.toLocaleString('vi-VN')} đ</span>
                                            </div>
                                        )}

                                        {msg.parsedData.searchResults && msg.parsedData.searchResults.length > 0 && (
                                            <div className="mb-3 space-y-2">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Kết quả tìm kiếm ({msg.parsedData.searchResults.length})</p>
                                                {msg.parsedData.searchResults.map((c: any) => (
                                                    <div key={c.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                                        <div className="flex justify-between">
                                                            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{c.name}</span>
                                                            <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase">{c.type || 'Chủ nhà'}</span>
                                                        </div>
                                                        {c.phone && <div className="text-xs text-slate-500 mt-1">{c.phone}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {msg.parsedData.missing_info && msg.parsedData.missing_info.length > 0 && (
                                            <div className="mb-3 flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50">
                                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                <span className="text-xs font-medium italic">Thiếu thông tin: {msg.parsedData.missing_info.join(', ')}</span>
                                            </div>
                                        )}

                                        {msg.parsedData.payment_info && msg.parsedData.intent === 'CREATE_PAYMENT' && (
                                            <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                                                <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400">
                                                    <span className="material-symbols-outlined text-[16px]">payments</span>
                                                    <span className="text-xs font-bold uppercase">CHI TIẾT THU NỢ</span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 text-xs">
                                                    <div className="text-slate-500">Số tiền thu: <span className="text-emerald-600 font-bold text-sm">{(msg.parsedData.payment_info.amount || 0).toLocaleString('vi-VN')} đ</span></div>
                                                    {msg.parsedData.payment_info.note && <div className="text-slate-500">Nội dung: <span className="text-slate-800 dark:text-slate-200">{msg.parsedData.payment_info.note}</span></div>}
                                                </div>
                                            </div>
                                        )}

                                        {msg.parsedData.products_to_create && msg.parsedData.products_to_create.length > 0 && msg.parsedData.intent === 'CREATE_PRODUCT' && (
                                            <div className="mb-3 space-y-2">
                                                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400">
                                                    <Package size={16} />
                                                    <span className="text-xs font-bold uppercase">THÔNG TIN SẢN PHẨM ({msg.parsedData.products_to_create.length})</span>
                                                </div>
                                                {msg.parsedData.products_to_create.map((pInfo: any, pIdx: number) => (
                                                    <div key={pIdx} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="text-slate-500 col-span-2">Tên SP: <span className="text-slate-800 dark:text-slate-200 font-bold">{pInfo.name || '---'}</span></div>
                                                            <div className="text-slate-500">Danh mục: <span className="text-slate-800 dark:text-slate-200 font-medium">{pInfo.category || '---'}</span></div>
                                                            <div className="text-slate-500">Quy cách: <span className="text-slate-800 dark:text-slate-200 font-medium">{pInfo.specs || '---'}</span></div>
                                                            <div className="text-slate-500">Trọng lượng: <span className="text-slate-800 dark:text-slate-200 font-medium">{pInfo.weight || '---'}</span></div>
                                                            <div className="text-slate-500">Đóng gói: <span className="text-slate-800 dark:text-slate-200 font-medium">{pInfo.packaging || '---'}</span></div>
                                                            <div className="text-slate-500">Giá nhập: <span className={pInfo.import_price ? "text-red-600 font-bold" : "text-slate-400"}>{pInfo.import_price ? pInfo.import_price.toLocaleString('vi-VN') + 'đ' : '---'}</span></div>
                                                            <div className="text-slate-500">Giá bán: <span className={pInfo.retail_price ? "text-green-600 font-bold" : "text-slate-400"}>{pInfo.retail_price ? pInfo.retail_price.toLocaleString('vi-VN') + 'đ' : '---'}</span></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {msg.parsedData.intent === 'CONFIRM_IMPORT' && msg.parsedData.import_items && (
                                            <div className="mb-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/50">
                                                <p className="text-[10px] text-green-600 dark:text-green-400 uppercase font-bold mb-2">
                                                    📋 Danh sách cập nhật ({msg.parsedData.import_items.length} SP)
                                                </p>
                                                <div className="max-h-40 overflow-y-auto space-y-1">
                                                    {msg.parsedData.import_items.slice(0, 10).map((item: any, idx: number) => (
                                                        <div key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                                                            <span className="truncate mr-2">{item.product.name}</span>
                                                            <span className="font-bold shrink-0">{item.product.stock || 0} → <span className="text-green-600">{item.newStock}</span></span>
                                                        </div>
                                                    ))}
                                                    {msg.parsedData.import_items.length > 10 && (
                                                        <p className="text-xs text-slate-400">...và {msg.parsedData.import_items.length - 10} sản phẩm khác</p>
                                                    )}
                                                </div>
                                                {msg.parsedData.not_found?.length > 0 && (
                                                    <p className="text-xs text-red-500 mt-2">⚠️ Không tìm thấy: {msg.parsedData.not_found.map((i: any) => i.name).join(', ')}</p>
                                                )}
                                            </div>
                                        )}

                                        {msg.parsedData.intent === 'CONFIRM_CREATE_PRODUCTS' && msg.parsedData.new_products && (
                                            <div className="mb-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold mb-2">
                                                    📦 Danh sách sản phẩm mới ({msg.parsedData.new_products.length} SP)
                                                </p>
                                                <div className="max-h-40 overflow-y-auto space-y-1">
                                                    {msg.parsedData.new_products.slice(0, 10).map((np: any, idx: number) => (
                                                        <div key={idx} className="text-xs text-slate-600 dark:text-slate-400">
                                                            <span className="font-medium">{np.name}</span>
                                                            {np.spec && <span className="ml-1 text-slate-400">— {np.spec}</span>}
                                                            {np.weight && <span className="ml-1 text-slate-400">— {np.weight}</span>}
                                                            {np.priceSell > 0 && <span className="ml-1 text-green-600 font-bold">{np.priceSell.toLocaleString('vi-VN')}đ</span>}
                                                            {!np.priceSell && <span className="ml-1 text-red-400">⚠️ Chưa có giá</span>}
                                                            {np.category && <span className="ml-1 text-indigo-500">[{np.category}]</span>}
                                                        </div>
                                                    ))}
                                                    {msg.parsedData.new_products.length > 10 && (
                                                        <p className="text-xs text-slate-400">...và {msg.parsedData.new_products.length - 10} sản phẩm khác</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {msg.parsedData.intent === 'INVENTORY_ACTION' && msg.parsedData.products && msg.parsedData.products.length > 0 && (
                                            <div className="mb-3">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">
                                                    Danh sách mặt hàng ({msg.parsedData.inventory_action?.type === 'export' ? 'Xuất kho' : 'Nhập kho'}):
                                                </p>
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                                                    {msg.parsedData.products.map((p: any, idx: number) => (
                                                        <div key={idx} className="p-3 flex items-center justify-between">
                                                            <div className="flex flex-col gap-0.5 max-w-[70%]">
                                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{p.name}</p>
                                                            </div>
                                                            <span className="text-sm font-black text-[#1A237E] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-lg">x{p.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {['CREATE_ORDER', 'UPDATE_ORDER', 'REVIEW_ORDER', 'FIX_ORDER', 'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'CREATE_PRODUCT', 'CREATE_PAYMENT', 'CONFIRM_IMPORT', 'CONFIRM_CREATE_PRODUCTS', 'IMPORT_ORDER_FROM_SHEET', 'CONFIRM_ORDER_FROM_SHEET'].includes(msg.parsedData.intent) && 
                                        (!msg.parsedData.missing_info || msg.parsedData.missing_info.length === 0) && (
                                            <button 
                                                onClick={() => handleAction(msg.parsedData)}
                                                className="w-full mt-2 bg-gradient-to-r from-[#1A237E] to-[#283593] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-[0.98]"
                                            >
                                                {msg.parsedData.intent === 'CREATE_CUSTOMER' ? 'Lưu Khách Hàng Mới' : 
                                                 msg.parsedData.intent === 'UPDATE_CUSTOMER' ? 'Xác Nhận Cập Nhật' : 
                                                 msg.parsedData.intent === 'UPDATE_ORDER' ? '🔄 Thêm vào Đơn' :
                                                 msg.parsedData.intent === 'REVIEW_ORDER' ? '📋 Xem Đơn Hàng' :
                                                 msg.parsedData.intent === 'FIX_ORDER' ? '🔧 Tự Sửa Lỗi' :
                                                 msg.parsedData.intent === 'CREATE_PRODUCT' ? `Tạo ${msg.parsedData.products_to_create?.length || ''} Sản Phẩm Mới` :
                                                 msg.parsedData.intent === 'CREATE_PAYMENT' ? 'Đi tới Form Phiếu Thu' :
                                                 msg.parsedData.intent === 'INVENTORY_ACTION' ? 'Xác Nhận & Tạo Phiếu Kho' :
                                                 msg.parsedData.intent === 'CONFIRM_IMPORT' ? '✅ Xác Nhận Cập Nhật Tồn Kho' :
                                                 msg.parsedData.intent === 'CONFIRM_CREATE_PRODUCTS' ? '✅ Xác Nhận Tạo Sản Phẩm' :
                                                 msg.parsedData.intent === 'IMPORT_ORDER_FROM_SHEET' ? '📋 Tạo Đơn Hàng' :
                                                 msg.parsedData.intent === 'CONFIRM_ORDER_FROM_SHEET' ? '📋 Xác Nhận Đơn Hàng' :
                                                 'Tiếp Tục Lên Đơn'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-indigo-100 dark:bg-indigo-900/40 text-[#1A237E] dark:text-indigo-400">
                                <BotMessageSquare size={20} className="animate-pulse" />
                            </div>
                            <div className="px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-sm flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-[#1A237E] animate-bounce"></div>
                                <div className="w-2 h-2 rounded-full bg-[#1A237E] animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-[#1A237E] animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area — ẩn/hiện bằng nút cam FAB */}
                {chatVisible && (
                <>
                {/* 🔍 Xem trước ảnh đã chọn */}
                {imagePreviews.length > 0 && (
                    <div className="px-4 pt-3 flex gap-2 overflow-x-auto shrink-0 bg-white dark:bg-slate-900">
                        {imagePreviews.map((preview, idx) => (
                            <div key={idx} className="relative shrink-0">
                                <img src={preview.url} alt={preview.name} className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                                <button 
                                    onClick={() => {
                                        if (imageUrlsRef.current[idx]) {
                                            URL.revokeObjectURL(imageUrlsRef.current[idx]);
                                            imageUrlsRef.current.splice(idx, 1);
                                        }
                                        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
                                >×</button>
                            </div>
                        ))}
                        <div className="text-[10px] text-slate-400 flex items-center ml-1 whitespace-nowrap">
                            {imagePreviews.length} ảnh — bot sẽ gộp thành 1 đơn
                        </div>
                    </div>
                )}

                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 z-10 relative mb-[72px]">
                    <form onSubmit={handleSend} className="relative flex items-center gap-2">
                        {/* 📸 Photo library button */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) {
                                    // 🧹 Revoke old blob URLs
                                    imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
                                    imageUrlsRef.current = [];
                                    const previews = Array.from(files).map(f => {
                                        const url = URL.createObjectURL(f);
                                        imageUrlsRef.current.push(url);
                                        return { name: f.name, url };
                                    });
                                    setImagePreviews(previews);
                                }
                            }}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-400 transition-colors shrink-0"
                            title="Chọn ảnh từ thư viện"
                        >
                            <Image size={18} />
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập yêu cầu tạo đơn/khách..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[24px] py-4 pl-6 pr-14 outline-none focus:border-[#FF6D00] dark:focus:border-[#FF6D00] transition-colors text-slate-800 dark:text-white resize-none overflow-hidden custom-scrollbar leading-relaxed"
                            style={{ minHeight: '56px', maxHeight: '120px' }}
                            rows={1}
                            disabled={isLoading}
                        />

                        {/* 🎙️ Voice button */}
                        <button
                            type="button"
                            onClick={toggleVoiceInput}
                            disabled={isLoading}
                            className={`size-10 rounded-full flex items-center justify-center transition-all shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/40 dark:hover:text-orange-400'}`}
                            title={isRecording ? 'Đang nghe...' : 'Nhập giọng nói'}
                        >
                            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>

                        <button 
                            type="submit" 
                            disabled={!input.trim() || isLoading}
                            className="size-10 bg-[#FF6D00] hover:bg-[#E66000] disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md shrink-0"
                        >
                            <Send size={18} className={input.trim() && !isLoading ? 'ml-1' : ''} />
                        </button>
                    </form>
                </div>
                </>
                )}

                {/* 🛡️ Confirmation Dialog */}
                {confirmAction && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-[#1A237E] dark:text-indigo-400 uppercase">Xác nhận thao tác</h3>
                                <button onClick={() => setConfirmAction(null)} className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 space-y-2">
                                <div className="text-xs font-black text-[#FF6D00] uppercase tracking-widest">
                                    {confirmAction.intent === 'CREATE_CUSTOMER' ? '🆕 Tạo khách hàng mới' :
                                     confirmAction.intent === 'CREATE_ORDER' ? '🛒 Lên đơn hàng' :
                                     confirmAction.intent === 'UPDATE_ORDER' ? '🔄 Cập nhật đơn hàng' :
                                     confirmAction.intent === 'REVIEW_ORDER' ? '📋 Xem đơn hàng' :
                                     confirmAction.intent === 'FIX_ORDER' ? '🔧 Tự động sửa lỗi đơn hàng' :
                                     confirmAction.intent === 'CREATE_PRODUCT' ? '📦 Tạo sản phẩm mới' :
                                     confirmAction.intent === 'CREATE_PAYMENT' ? '💰 Thu công nợ' :
                                     confirmAction.intent === 'INVENTORY_ACTION' ? '📊 Phiếu kho' :
                                     confirmAction.intent === 'CONFIRM_IMPORT' ? '📊 Import Tồn kho' :
                                     confirmAction.intent === 'CONFIRM_CREATE_PRODUCTS' ? '📦 Tạo danh sách sản phẩm' :
                                     confirmAction.intent === 'IMPORT_ORDER_FROM_SHEET' ? '📋 Tạo đơn từ Sheet' :
                                     confirmAction.intent === 'CONFIRM_ORDER_FROM_SHEET' ? '📋 Xác nhận đơn từ Sheet' :
                                     'Thao tác'}
                                </div>
                                {confirmAction.customer?.name && <p className="text-sm font-bold">👤 {confirmAction.customer.name}{confirmAction.customer.phone ? ` - ${confirmAction.customer.phone}` : ''}</p>}
                                {confirmAction.products?.length > 0 && (
                                    <div className="text-sm">
                                        <span className="font-bold">📋 Sản phẩm:</span>
                                        {confirmAction.products.map((p: any, i: number) => (
                                            <span key={i} className="ml-1 text-slate-600 dark:text-slate-400">{p.name} x{p.quantity}{i < confirmAction.products.length - 1 ? ', ' : ''}</span>
                                        ))}
                                    </div>
                                )}
                                {confirmAction.products_to_create?.length > 0 && (
                                    <div className="text-sm space-y-1">
                                        <span className="font-bold">📦 Sản phẩm mới:</span>
                                        {confirmAction.products_to_create.map((p: any, i: number) => (
                                            <div key={i} className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                                                • {p.name}{p.category ? ` — ${p.category}` : ' ⚠️ Thiếu danh mục!'} {p.retail_price ? `(${p.retail_price.toLocaleString('vi-VN')}đ)` : ''}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {confirmAction.payment_info?.amount > 0 && <p className="text-sm font-bold text-green-600">💵 {confirmAction.payment_info.amount.toLocaleString('vi-VN')} VND</p>}
                                {confirmAction.import_items?.length > 0 && (
                                    <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
                                        <span className="font-bold">📋 Cập nhật tồn kho ({confirmAction.import_items.length} SP):</span>
                                        {confirmAction.import_items.slice(0, 10).map((item: any, i: number) => (
                                            <div key={i} className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                                                • {item.product.name}: <strong>{item.product.stock || 0}</strong> → <strong className="text-green-600">{item.newStock}</strong>
                                            </div>
                                        ))}
                                        {confirmAction.import_items.length > 10 && (
                                            <p className="text-xs text-slate-400 ml-2">...và {confirmAction.import_items.length - 10} sản phẩm khác</p>
                                        )}
                                    </div>
                                )}
                                {confirmAction.new_products?.length > 0 && (
                                    <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
                                        <span className="font-bold">🆕 Tạo sản phẩm mới ({confirmAction.new_products.length} SP):</span>
                                        {confirmAction.new_products.slice(0, 10).map((np: any, i: number) => (
                                            <div key={i} className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                                                • {np.name}{np.stock !== undefined ? `: tồn ` : ''}{np.stock !== undefined && <strong className="text-green-600">{np.stock}</strong>}{np.priceImport > 0 ? ` — nhập ${np.priceImport.toLocaleString('vi-VN')}đ` : ''}{np.priceSell > 0 && np.priceSell !== np.priceImport ? ` / bán ${np.priceSell.toLocaleString('vi-VN')}đ` : ''}{np.priceSell > 0 && !np.priceImport ? ` — bán ${np.priceSell.toLocaleString('vi-VN')}đ` : ''}{np.category ? ` [${np.category}]` : ''}{np.unit ? ` /${np.unit}` : ''}{np.weight ? ` — ${np.weight}` : ''}{np.spec ? ` — ${np.spec}` : ''}
                                            </div>
                                        ))}
                                        {confirmAction.new_products.length > 10 && (
                                            <p className="text-xs text-slate-400 ml-2">...và {confirmAction.new_products.length - 10} sản phẩm khác</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Huỷ
                                </button>
                                <button
                                    onClick={confirmAndExecute}
                                    className="flex-1 py-3 rounded-2xl font-bold text-white bg-[#FF6D00] hover:bg-[#E66000] shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                                >
                                    ✅ Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default SaleBot;
