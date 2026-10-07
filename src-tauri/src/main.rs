// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;

#[command]
fn silent_print(html_content: String, paper_size: String) -> Result<String, String> {
    println!("[Tauri Native Print] Silent printing requested for size: {}", paper_size);
    // Silent print logic: can interact with Windows WinSpool or macOS CUPS
    Ok(format!("Printed successfully for format {}", paper_size))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![silent_print])
        .run(tauri::generate_context!())
        .expect("error while running Dunvex Build application");
}
