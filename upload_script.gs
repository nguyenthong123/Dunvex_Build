function doPost(e) {
  // CORS Headers for response
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    var data = JSON.parse(e.postData.contents);

    var result;
    // Check for specific actions
    if (data.action === 'invite_user') {
      result = handleInviteUser(data);
    } else if (data.action === 'payment_request') {
      result = handlePaymentRequest(data);
    } else if (data.action === 'sync_to_sheets') {
      result = handleSyncToSheet(data);
    } else if (data.action === 'affiliate_registration') {
      result = handleAffiliateRegistration(data);
    } else if (data.action === 'affiliate_status_notify') {
      result = handleAffiliateStatusNotify(data);
    } else if (data.action === 'affiliate_payout_notify') {
      result = handleAffiliatePayoutNotify(data);
    } else if (data.action === 'training_verification') {
      result = handleTrainingVerification(data);
    } else if (data.action === 'loan_reminder') {
      result = handleLoanReminder(data);
    } else {
      // Default: File Upload Logic
      result = handleFileUpload(data);
    }

    return result;
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleAffiliateRegistration(data) {
  var adminEmail = "dunvex.green@gmail.com";
  var partnerName = data.name;
  var partnerEmail = data.email;
  var partnerPhone = data.phone;
  var partnerNote = data.note || 'Không có';
  var referralCode = data.referralCode;
  var userId = data.userId; 

  var baseUrl = "https://dunvex-build.vercel.app/affiliate";
  var approveUrl = baseUrl + "?action=APPROVE&uid=" + userId;
  var rejectUrl = baseUrl + "?action=REJECT&uid=" + userId;

  var subject = "AFFILIATE: Đăng ký đối tác mới - " + partnerName;
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='background: #1A237E; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;'>" +
    "<h2 style='margin: 0;'>DUNVEX AFFILIATE</h2>" +
    "<p style='margin: 0; font-size: 12px; opacity: 0.8;'>Yêu cầu đăng ký đối tác mới</p>" +
    "</div>" +
    "<div style='padding: 30px; border: 1px solid #1A237E; border-top: none; border-radius: 0 0 8px 8px;'>" +
    "<p>Bạn vừa nhận được một đơn đăng ký tham gia mạng lưới Affiliate:</p>" +
    "<div style='background: #f8f9fb; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e0e0e0;'>" +
    "<p style='margin: 8px 0;'><strong>Tên đối tác:</strong> " + partnerName + "</p>" +
    "<p style='margin: 8px 0;'><strong>Email:</strong> " + partnerEmail + "</p>" +
    "<p style='margin: 8px 0;'><strong>Số điện thoại:</strong> " + partnerPhone + "</p>" +
    "<p style='margin: 8px 0;'><strong>Mã ưu đãi dự kiến:</strong> <span style='color: #1A237E; font-weight: bold;'>" + referralCode + "</span></p>" +
    "<div style='margin: 15px 0; padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #d1d5db;'>" +
    "<p style='margin: 0 0 8px; font-size: 11px; color: #666; font-weight: bold; text-transform: uppercase;'>Thông tin ngân hàng:</p>" +
    "<p style='margin: 3px 0;'>NH: <b>" + (data.bankName || 'N/A') + "</b></p>" +
    "<p style='margin: 3px 0;'>STK: <b>" + (data.bankNumber || 'N/A') + "</b></p>" +
    "<p style='margin: 3px 0;'>CTK: <b>" + (data.bankAccountName || 'N/A') + "</b></p>" +
    "</div>" +
    "<p style='margin: 8px 0;'><strong>Lời nhắn:</strong> " + partnerNote + "</p>" +
    "</div>" +
    
    "<p style='text-align: center; font-weight: bold; color: #666; margin-bottom: 20px;'>XỬ LÝ NHANH QUA EMAIL:</p>" +
    "<div style='text-align: center; margin-bottom: 30px;'>" +
    "<a href='" + approveUrl + "' style='display: inline-block; background: #22c55e; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;'>Duyệt & Kích hoạt</a>" +
    "<a href='" + rejectUrl + "' style='display: inline-block; background: #ef4444; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;'>Từ chối</a>" +
    "</div>" +
    
    "<p style='font-size: 12px; color: #999;'>Lưu ý: Bạn cần đăng nhập tài khoản quản trị để thực hiện các thao tác trên.</p>" +
    "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    htmlBody: body
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Admin notified"
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleAffiliateStatusNotify(data) {
  var partnerEmail = data.email;
  var partnerName = data.name;
  var status = data.status; 
  var referralCode = data.referralCode;
  
  var subject = status === 'active' 
    ? "CHÚC MỪNG: Tài khoản đối tác của bạn đã được kích hoạt!" 
    : "THÔNG BÁO: Kết quả đăng ký đối tác Dunvex";
    
  var primaryColor = status === 'active' ? '#22c55e' : '#ef4444';
  
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='background: " + primaryColor + "; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;'>" +
    "<h2 style='margin: 0; text-transform: uppercase;'>DUNVEX PARTNER</h2>" +
    "<p style='margin: 10px 0 0; font-size: 14px; opacity: 0.9;'>Kết quả xét duyệt hồ sơ</p>" +
    "</div>" +
    "<div style='padding: 30px; border: 1px solid " + primaryColor + "; border-top: none; border-radius: 0 0 8px 8px;'>" +
    "<p>Xin chào <b>" + partnerName + "</b>,</p>";
    
  if (status === 'active') {
    body += 
      "<p>Chúng tôi rất vui mừng thông báo rằng hồ sơ đăng ký đối tác của bạn đã được <b>CHẤP THUẬN</b>. Hiện tại, bạn đã có thể bắt đầu giới thiệu khách hàng và nhận hoa hồng.</p>" +
      "<div style='background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px dashed #22c55e; text-align: center;'>" +
      "<p style='margin: 0; color: #15803d; font-size: 12px; font-weight: bold; text-transform: uppercase;'>Mã ưu đãi độc quyền của bạn</p>" +
      "<p style='margin: 10px 0; color: #166534; font-size: 32px; font-weight: 900; letter-spacing: 2px;'>" + referralCode + "</p>" +
      "</div>" +
      "<p><b>Hướng dẫn sử dụng:</b> Hãy gửi mã này cho khách hàng của bạn. Khi họ nhập mã tại phần thanh toán, họ sẽ được giảm giá theo chính sách và hệ thống sẽ tự động ghi nhận hoa hồng cho bạn.</p>" +
      "<div style='text-align: center; margin-top: 30px;'>" +
      "<a href='https://dunvex-build.vercel.app/affiliate' style='display: inline-block; background: #1A237E; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;'>Mở Hub Đối Tác</a>" +
      "</div>";
  } else {
    body += 
      "<p>Cảm ơn bạn đã quan tâm đến chương trình đối tác của Dunvex. Tuy nhiên, sau khi xem xét hồ sơ, chúng tôi rất tiếc phải thông báo rằng yêu cầu của bạn hiện <b>CHƯA ĐƯỢC CHẤP THUẬN</b> vào thời điểm này.</p>" +
      "<p>Mọi thắc mắc vui lòng liên hệ trực tiếp với bộ phận chăm sóc khách hàng của chúng tôi để được hỗ trợ thêm.</p>";
  }
  
  body += 
    "<p style='margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; text-align: center;'>Đây là email tự động, vui lòng không trả lời trực tiếp email này. © 2026 Dunvex Build Management System.</p>" +
    "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: partnerEmail,
    subject: subject,
    htmlBody: body
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Partner notified"
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleAffiliatePayoutNotify(data) {
  var email = data.email;
  var name = data.name;
  var amount = data.amount;
  var date = data.date || new Date().toLocaleDateString();
  var proofUrl = data.proofUrl;

  var subject = "THANH TOÁN: Hoa hồng Affiliate của bạn đã được chi trả";
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='background: #1A237E; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;'>" +
    "<h2 style='margin: 0; text-transform: uppercase;'>THANH TOÁN HOA HỒNG</h2>" +
    "</div>" +
    "<div style='padding: 30px; border: 1px solid #1A237E; border-top: none; border-radius: 0 0 8px 8px;'>" +
    "<p>Xin chào <b>" + name + "</b>,</p>" +
    "<p>Hệ thống Dunvex vừa thực hiện chi trả hoa hồng tích lũy cho tài khoản của bạn.</p>" +
    "<div style='background: #f8f9fb; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #e0e0e0;'>" +
    "<p style='margin: 5px 0;'><strong>Số tiền thanh toán:</strong> <span style='color: #22c55e; font-weight: 900; font-size: 20px;'>" + amount.toLocaleString() + " đ</span></p>" +
    "<p style='margin: 5px 0;'><strong>Ngày thực hiện:</strong> " + date + "</p>" +
    "<p style='margin: 5px 0;'><strong>Trạng thái:</strong> <span style='color: #22c55e; font-weight: bold;'>Đã hoàn thành</span></p>" +
    "</div>" +
    (proofUrl ? "<p>Bạn có thể xem chứng từ thanh toán tại đây: <a href='" + proofUrl + "'>Hình ảnh lệnh chi</a></p>" : "") +
    "<p>Cảm ơn bạn đã luôn đồng hành cùng Dunvex!</p>" +
    "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: body
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success"
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleFileUpload(data) {
    var filename = data.filename;
    var mimeType = data.mimeType;
    var base64Data = data.base64Data;
    var folderId = data.folderId || "1-j-AY6BjHfi2Rckbb572X8xLzOvbs-es"; 

    var folder = DriveApp.getFolderById(folderId);
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileUrl: "https://drive.google.com/uc?export=view&id=" + file.getId()
    })).setMimeType(ContentService.MimeType.JSON);
}

function handleInviteUser(data) {
  var email = data.email;
  var role = data.role;
  var inviterName = data.inviterName || 'Quản trị viên';
  var appUrl = "https://dunvex-build.vercel.app";

  var subject = "INVITATION: Lời mời tham gia hệ thống Dunvex Build";
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='text-align: center; margin-bottom: 20px;'>" +
    "<h2 style='color: #1A237E; margin: 0;'>DUNVEX BUILD</h2>" +
    "<p style='font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 2px;'>Management System</p>" +
    "</div>" +
    "<p>Xin chào,</p>" +
    "<p>Bạn vừa nhận được lời mời tham gia vào hệ thống quản trị doanh nghiệp <b>Dunvex Build</b>.</p>" +
    "<div style='background: #f8f9fb; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e0e0e0;'>" +
    "<p style='margin: 5px 0;'><strong>Người mời:</strong> " + inviterName + "</p>" +
    "<p style='margin: 5px 0;'><strong>Vai trò được cấp:</strong> <span style='color: #FF6D00; font-weight: bold; text-transform: uppercase; background: #fff3e0; padding: 2px 8px; border-radius: 4px;'>" + role + "</span></p>" +
    "</div>" +
    "<p>Vui lòng nhấn vào nút bên dưới để truy cập hệ thống và bắt đầu làm việc:</p>" +
    "<div style='text-align: center; margin: 30px 0;'>" +
    "<a href='" + appUrl + "' style='display: inline-block; background: #1A237E; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px rgba(26, 35, 126, 0.2);'>Truy cập ngay</a>" +
    "</div>" +
    "<p style='margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px;'>Email này được gửi tự động từ hệ thống Dunvex Build. Vui lòng không trả lời email này.</p>" +
    "</div>";

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: body
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success"
  })).setMimeType(ContentService.MimeType.JSON);
}

function handlePaymentRequest(data) {
  var adminEmail = "dunvex.green@gmail.com"; 
  var userEmail = data.email;
  var planName = data.planName;
  var amount = data.amount;
  var transferCode = data.transferCode || 'N/A';
  var appUrl = "https://dunvex-build.vercel.app/nexus-control";

  var subject = "PAYMENT: Yêu cầu kích hoạt gói " + planName + " - " + userEmail;
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='background: #1A237E; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;'>" +
    "<h2 style='margin: 0;'>NEXUS CONTROL</h2>" +
    "<p style='margin: 0; font-size: 12px; opacity: 0.8;'>Yêu cầu thanh toán mới</p>" +
    "</div>" +
    "<div style='padding: 30px; border: 1px solid #1A237E; border-top: none; border-radius: 0 0 8px 8px;'>" +
    "<p>Bạn vừa nhận được một yêu cầu kích hoạt dịch vụ từ khách hàng:</p>" +
    "<div style='background: #f8f9fb; padding: 20px; border-radius: 12px; margin-bottom: 30px;'>" +
    "<p><strong>Email:</strong> " + userEmail + "</p>" +
    "<p><strong>Gói dịch vụ:</strong> <span style='color: #indigo; font-weight: bold;'>" + planName + "</span></p>" +
    "<p><strong>Nội dung chuyển:</strong> <span style='color: #FF6D00; font-weight: bold; font-size: 16px;'>" + transferCode + "</span></p>" +
    "<p><strong>Số tiền cần nhận:</strong> <span style='color: #1A237E; font-weight: bold; font-size: 18px;'>" + amount.toLocaleString() + "đ</span></p>" +
    "</div>" +
    "<div style='text-align: center; margin-top: 30px;'>" +
    "<a href='" + appUrl + "' style='display: inline-block; background: #1A237E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;'>Mở Nexus Control</a>" +
    "</div>" +
    "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    htmlBody: body
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput("Service is running");
}

function handleSyncToSheet(data) {
  var ownerEmail = data.ownerEmail;
  var spreadsheetId = data.spreadsheetId;
  var collections = data.data; 

  var ss;
  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      ss = SpreadsheetApp.create("Dunvex Build Hub - " + ownerEmail);
    }
  } else {
    ss = SpreadsheetApp.create("Dunvex Build Hub - " + ownerEmail);
  }

  var file = DriveApp.getFileById(ss.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  for (var key in collections) {
    var items = collections[key];
    if (!items || items.length === 0) continue;

    var sheetName = key.charAt(0).toUpperCase() + key.slice(1);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();

    var headers = Object.keys(items[0]);
    var matrix = [headers];

    items.forEach(function(item) {
      var row = headers.map(function(h) {
        var val = item[h];
        if (val && typeof val === 'object') {
          if (val.seconds) return new Date(val.seconds * 1000).toLocaleString();
          return JSON.stringify(val);
        }
        return val;
      });
      matrix.push(row);
    });

    sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl()
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleTrainingVerification(data) {
  var targetEmail = data.targetEmail || "dunvex.green@gmail.com";
  var subject = data.subject || "MÃ XÁC MINH";
  var message = data.message;
  
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='background: #1A237E; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;'>" +
    "<h2 style='margin: 0;'>XÁC MINH HỆ THỐNG</h2>" +
    "</div>" +
    "<div style='padding: 30px; border: 1px solid #1A237E; border-top: none; border-radius: 0 0 8px 8px; font-size: 16px; line-height: 1.6;'>" +
    "<p>Xin chào quản trị viên,</p>" +
    "<p>" + message + "</p>" +
    "<p style='margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px;'>Yêu cầu được thực hiện bởi: " + (data.email || 'N/A') + "</p>" +
    "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: targetEmail,
    subject: subject,
    htmlBody: body
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success"
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleLoanReminder(data) {
  var adminEmail = "dunvex.green@gmail.com";
  var clientEmail = data.clientEmail;
  var bankName = data.bankName || "Ngân hàng";
  var amount = data.amount || 0;
  var interestRate = data.interestRate || 0;
  var loanTerm = data.loanTerm || "N/A";
  var date = data.date || "N/A";
  var note = data.note || "";
  var category = data.category || "Vay ngân hàng";
  var isAuto = data.isAutoGenerated || false;

  var typeText = category.includes("Lãi") ? "LÃI SUẤT" : (category.includes("Nợ gốc") || category.includes("Đáo hạn") ? "NỢ GỐC/ĐÁO HẠN" : "KHOẢN VAY");
  var subject = "🔔 [" + typeText + "] " + bankName + " - " + (note.includes('[Tự động]') ? note.replace('[Tự động] ', '') : note);
  
  var body = 
    "<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 15px; max-width: 600px; margin: 0 auto;'>" +
    "<div style='background: #1A237E; color: white; padding: 25px; border-radius: 12px 12px 0 0; text-align: center;'>" +
    "<h2 style='margin: 0; text-transform: uppercase; letter-spacing: 1px;'>Thông Báo Tài Chính</h2>" +
    "<p style='margin: 5px 0 0; font-size: 13px; opacity: 0.8;'>Hệ thống quản trị Dunvex Build</p>" +
    "</div>" +
    "<div style='padding: 30px; border: 1px solid #1A237E; border-top: none; border-radius: 0 0 12px 12px;'>" +
    "<p>Xin chào,</p>" +
    "<p>Hệ thống ghi nhận thông tin về nghiệp vụ ngân hàng sau đây:</p>" +
    
    "<div style='background: #f8f9fb; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;'>" +
    "<p style='margin: 5px 0;'><strong>Nghiệp vụ:</strong> <span style='color: #1A237E; font-weight: bold;'>" + category + "</span></p>" +
    "<p style='margin: 5px 0;'><strong>Nội dung:</strong> " + note + "</p>" +
    "<p style='margin: 5px 0;'><strong>Số tiền:</strong> <span style='color: #ef4444; font-weight: bold; font-size: 18px;'>" + amount.toLocaleString() + " VND</span></p>" +
    "<p style='margin: 5px 0;'><strong>Ngày chứng từ:</strong> " + date + "</p>" +
    "<p style='margin: 15px 0 5px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 12px; color: #666;'>Thông tin khoản vay gốc:</p>" +
    "<p style='margin: 3px 0; font-size: 12px;'>Ngân hàng: " + bankName + "</p>" +
    "<p style='margin: 3px 0; font-size: 12px;'>Lãi suất: " + interestRate + "%/năm | Kỳ hạn: " + loanTerm + "</p>" +
    "</div>" +
    
    "<p style='font-weight: bold; color: #15803d;'>Lưu ý từ hệ thống:</p>" +
    "<ul>" +
    "<li>Vui lòng kiểm tra và cân đối dòng tiền để thực hiện chi trả đúng hạn.</li>" +
    "<li>Chứng từ này được đồng bộ tự động từ kế hoạch vay của bạn.</li>" +
    "</ul>" +
    
    "<p style='margin-top: 30px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px;'>Đây là thông báo tự động từ hệ thống Dunvex Build. Vui lòng liên hệ quản trị nếu có sai sót.</p>" +
    "</div>" +
    "</div>";

  // Send to Admin
  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    htmlBody: body
  });

  // Send to Client if email provided
  if (clientEmail && clientEmail.includes('@')) {
    MailApp.sendEmail({
      to: clientEmail,
      subject: subject,
      htmlBody: body
    });
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Reminders sent"
  })).setMimeType(ContentService.MimeType.JSON);
}
