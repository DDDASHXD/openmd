mod menu;
mod server;

use tauri::{Manager, RunEvent};

#[tauri::command]
fn get_local_server_url() -> Option<String> {
    server::current_port()
        .map(|port| format!("http://127.0.0.1:{port}"))
}

#[tauri::command]
async fn start_local_server(workspace_path: String) -> Result<serde_json::Value, String> {
    let log_path = workspace_path.clone();
    let port = tauri::async_runtime::spawn_blocking(move || server::start_server(&workspace_path))
        .await
        .map_err(|error| error.to_string())??;

    eprintln!("[foliage] workspace switched: {log_path} (port {port})");
    Ok(serde_json::json!({ "port": port }))
}

#[tauri::command]
async fn stop_local_server() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(server::stop_server)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn open_editor_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 1400.0,
            height: 900.0,
        }))
        .map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn return_to_launcher(window: tauri::WebviewWindow) -> Result<(), String> {
    let shell_workspace = server::shell_workspace();
    let shell = shell_workspace.to_string_lossy().to_string();

    tauri::async_runtime::spawn_blocking(move || {
        let _ = server::stop_live_share();
        let _ = server::start_server(&shell);
    })
    .await
    .map_err(|error| error.to_string())?;

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 900.0,
            height: 600.0,
        }))
        .map_err(|error| error.to_string())?;

    window.center().map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_local_server_url,
            start_local_server,
            stop_local_server,
            open_editor_window,
            return_to_launcher,
        ])
        .setup(|app| {
            server::init_app_handle(app.handle().clone());
            menu::setup_menu(app.handle())?;

            let shell_workspace = server::shell_workspace();
            let shell = shell_workspace.to_string_lossy().to_string();

            if cfg!(debug_assertions) && server::is_healthy(server::DEV_SERVER_PORT) {
                eprintln!(
                    "[foliage] adopting dev server on port {}",
                    server::DEV_SERVER_PORT
                );
                let _ = server::adopt_running_server(server::DEV_SERVER_PORT, &shell);
            } else if let Err(start_error) = server::start_server(&shell) {
                eprintln!("foliage-server failed to start: {start_error}");
            }

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .build(tauri::generate_context!());

    let app = match app {
        Ok(app) => app,
        Err(error) => {
            eprintln!("error while building tauri application: {error}");
            std::process::exit(1);
        }
    };

    app.run(|_app_handle, event| {
        if let RunEvent::Exit = event {
            let _ = server::stop_server();
        }
    });
}
