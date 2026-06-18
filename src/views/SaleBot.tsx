import React, { useState, useRef, useEffect } from 'react';
import { parseSaleMessage, analyzeImage } from '../services/geminiService';
import { BotMessageSquare, Send, Sparkles, User, AlertCircle, CheckCircle2, Package, Camera, Mic, MicOff, X, ImagePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, Timestamp, increment, setDoc, getDoc } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';

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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🛡️ Confirmation step
    const [confirmAction, setConfirmAction] = useState<any>(null);
    // 🎙️ Voice recording
    const [isRecording, setIsRecording] = useState(false);
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
                        setMessages(data.messages);
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

        await processTextMessage(input);
        setInput('');
    };

    // 📸 Xử lý gửi ảnh
    const handleImageSend = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            const mimeType = file.type;

            const newMessages = [...messages, {
                id: Date.now().toString(),
                role: 'user' as const,
                content: `📸 [Ảnh: ${file.name}]${input ? ' - ' + input : ''}`
            }];
            setMessages(newMessages);
            setInput('');
            setIsLoading(true);

            try {
                const data = await analyzeImage(base64, mimeType, input || undefined, productsStr);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'bot',
                    content: data.message || 'Em đã phân tích xong ảnh!',
                    parsedData: data
                }]);
            } catch (err: any) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'bot',
                    content: `❌ ${err.message || 'Lỗi phân tích ảnh'}`
                }]);
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsDataURL(file);
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
        
        const newMessages = [...messages, { id: Date.now().toString(), role: 'user' as const, content: userMsg }];
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
                    const aiName = (aiProd.name || '').toLowerCase().trim();
                    let matchedProd = allProducts.find(p => (p.name || '').toLowerCase() === aiName);
                    if (!matchedProd) {
                        matchedProd = allProducts.find(p => (p.name || '').toLowerCase().includes(aiName));
                    }

                    if (matchedProd) {
                        matchedItems.push({
                            product: matchedProd,
                            quantity: Number(aiProd.quantity) || 0
                        });
                    }
                }

                if (matchedItems.length === 0) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'bot',
                        content: `❌ Không tìm thấy sản phẩm nào khớp trong kho. Vui lòng kiểm tra lại tên sản phẩm.`
                    }]);
                    setIsLoading(false);
                    return;
                }

                const type = data.inventory_action?.type === 'export' ? 'export' : 'import';
                const actionName = type === 'import' ? 'Nhập kho' : 'Xuất kho';
                
                const logData = {
                    action: actionName,
                    type: type,
                    items: matchedItems.map(i => ({
                        productId: i.product.id,
                        name: i.product.name,
                        sku: i.product.sku || '',
                        quantity: i.quantity,
                        previousStock: i.product.stock || 0,
                        newStock: type === 'import' ? (i.product.stock || 0) + i.quantity : (i.product.stock || 0) - i.quantity
                    })),
                    note: data.inventory_action?.note || 'Tạo tự động từ SaleBot',
                    createdAt: serverTimestamp(),
                    ownerId: owner.ownerId,
                    user: auth.currentUser?.displayName || 'Unknown'
                };
                await addDoc(collection(db, 'inventory_logs'), logData);

                for (const item of matchedItems) {
                    const newStock = type === 'import' ? (item.product.stock || 0) + item.quantity : (item.product.stock || 0) - item.quantity;
                    await updateDoc(doc(db, 'products', item.product.id), {
                        stock: newStock,
                        updatedAt: serverTimestamp()
                    });
                }

                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'bot',
                    content: `✅ Đã tạo thành công Phiếu ${actionName} cho ${matchedItems.length} mặt hàng.`
                }]);
            } catch (err) {
                console.error(err);
                alert("Lỗi khi tạo phiếu kho");
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
                            id: Date.now().toString() + '_loc',
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
                    id: Date.now().toString(),
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
                        id: Date.now().toString(),
                        role: 'bot',
                        content: `⚠️ **Thiếu danh mục** cho: ${names}\n\nAnh/chị vui lòng cho em biết danh mục của sản phẩm này (VD: Sơn, Nhựa và phụ kiện, Vật liệu xây dựng...).\n\n💡 Gõ: \"sửa danh mục ${missingCategory[0].name} thành [tên danh mục]\"`
                    }]);
                    setIsLoading(false);
                    return;
                }

                let successCount = 0;
                let firstProductName = "";

                for (let i = 0; i < productsToCreate.length; i++) {
                    const pInfo = productsToCreate[i];
                    if (!pInfo.name) continue;

                    // Tự động tạo mã SKU (Ví dụ: SP + 4 số ngẫu nhiên + 4 số cuối timestamp)
                    const generatedSku = 'SP' + Math.floor(1000 + Math.random() * 9000) + Date.now().toString().slice(-4) + i.toString();

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
                        id: Date.now().toString(),
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
                    alert(`Không tìm thấy dữ liệu khách hàng "${data.customer?.name || ''}" trong hệ thống để cập nhật.`);
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
                    id: Date.now().toString(),
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
                    alert(`Không tìm thấy dữ liệu khách hàng "${data.customer?.name || ''}" trong hệ thống.`);
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

    return (
        <div className="absolute inset-0 pt-14 lg:pt-0 pb-20 lg:pb-0 z-40 bg-white dark:bg-slate-900 flex flex-col">
            <div className="w-full flex flex-col h-full overflow-hidden relative">
                
                {/* Header */}
                <div className="flex items-center gap-4 p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-[#1A237E] to-[#0D1240] text-white shrink-0">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center relative shadow-lg">
                        <BotMessageSquare size={24} className="text-[#ffcc00]" />
                        <Sparkles size={12} className="absolute -top-1 -right-1 text-[#ffcc00] animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                            Trợ lý AI <span className="text-[10px] bg-[#ffcc00] text-slate-900 px-2 py-0.5 rounded-full font-bold">PRO</span>
                        </h2>
                        <p className="text-xs text-white/70 font-bold uppercase tracking-widest mt-0.5">Powered by Gemini 2.5 Flash</p>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
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
                                                 msg.parsedData.intent === 'CREATE_PRODUCT' ? 'Thông tin Sản Phẩm' : 
                                                 msg.parsedData.intent === 'CREATE_PAYMENT' ? 'Thông tin Thu Công Nợ' :
                                                 msg.parsedData.intent === 'INVENTORY_ACTION' ? 'Thông tin Phiếu Kho' :
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

                                        {msg.parsedData.intent === 'INVENTORY_ACTION' && msg.parsedData.products && (
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

                                        {['CREATE_ORDER', 'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'CREATE_PRODUCT', 'CREATE_PAYMENT', 'INVENTORY_ACTION'].includes(msg.parsedData.intent) && 
                                        (!msg.parsedData.missing_info || msg.parsedData.missing_info.length === 0) && (
                                            <button 
                                                onClick={() => handleAction(msg.parsedData)}
                                                className="w-full mt-2 bg-gradient-to-r from-[#1A237E] to-[#283593] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-[0.98]"
                                            >
                                                {msg.parsedData.intent === 'CREATE_CUSTOMER' ? 'Lưu Khách Hàng Mới' : 
                                                 msg.parsedData.intent === 'UPDATE_CUSTOMER' ? 'Xác Nhận Cập Nhật' : 
                                                 msg.parsedData.intent === 'CREATE_PRODUCT' ? `Tạo ${msg.parsedData.products_to_create?.length || ''} Sản Phẩm Mới` :
                                                 msg.parsedData.intent === 'CREATE_PAYMENT' ? 'Đi tới Form Phiếu Thu' :
                                                 msg.parsedData.intent === 'INVENTORY_ACTION' ? 'Xác Nhận & Tạo Phiếu Kho' :
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

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <form onSubmit={handleSend} className="relative flex items-center gap-2">
                        {/* 📸 Camera button */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={() => handleSend()}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-400 transition-colors shrink-0"
                            title="Gửi ảnh"
                        >
                            <Camera size={18} />
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
                                     confirmAction.intent === 'CREATE_PRODUCT' ? '📦 Tạo sản phẩm mới' :
                                     confirmAction.intent === 'CREATE_PAYMENT' ? '💰 Thu công nợ' :
                                     confirmAction.intent === 'INVENTORY_ACTION' ? '📊 Phiếu kho' :
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
