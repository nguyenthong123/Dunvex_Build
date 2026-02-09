function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var filename = data.filename;
    var mimeType = data.mimeType;
    var base64Data = data.base64Data;
    var folderId = "1-j-AY6BjHfi2Rckbb572X8xLzOvbs-es"; // ID thư mục bạn cung cấp

    var folder = DriveApp.getFolderById(folderId);
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    var file = folder.createFile(blob);
    
    // Set file to be publicly accessible so the app can view it
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    // Create direct view link
    var directLink = "https://drive.google.com/uc?export=view&id=" + fileId;
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileUrl: directLink,
      fileId: fileId,
      originalName: filename
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
    return ContentService.createTextOutput("Service is running");
}
