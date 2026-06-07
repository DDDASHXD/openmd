mod menu;
mod server;

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

static RELAY_CLIENT: Mutex<Option<Child>> = Mutex::new(None);

#[tauri::command]
fn create_project(path: String) -> Result<(), String> {
    let repo = server::repo_root();
    let script = repo.join("packages/openmd-server/src/lib/project-template.mjs");

    let status = std::process::Command::new("node")
        .arg("--input-type=module")
        .arg("-e")
        .arg(format!(
            "import {{ createProjectScaffold }} from '{}'; await createProjectScaffold(process.argv[1]);",
            script.display()
        ))
        .arg(&path)
        .current_dir(&repo)
        .status()
        .map_err(|error| format!("Failed to create project: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("Project scaffold command failed.".to_string())
    }
}

fn navigate_window(window: &tauri::WebviewWindow, url: &str) -> Result<(), String> {
    let parsed = tauri::Url::parse(url).map_err(|error| error.to_string())?;
    window.navigate(parsed).map_err(|error| error.to_string())
}

#[tauri::command]
fn start_local_server(workspace_path: String) -> Result<serde_json::Value, String> {
    let port = server::start_server(&workspace_path)?;
    Ok(serde_json::json!({ "port": port }))
}

#[tauri::command]
fn stop_local_server() -> Result<(), String> {
    server::stop_server()
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
fn start_live_share(relay_url: String, session_id: String) -> Result<(), String> {
    let mut guard = RELAY_CLIENT
        .lock()
        .map_err(|_| "Relay client lock poisoned.".to_string())?;

    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    let port = server::current_port().ok_or_else(|| "Local server is not running.".to_string())?;
    let repo = server::repo_root();
    let script = repo.join("packages/openmd-relay/bin/openmd-relay-client.mjs");

    let child = Command::new("node")
        .arg(&script)
        .arg("--relay-url")
        .arg(&relay_url)
        .arg("--session-id")
        .arg(&session_id)
        .arg("--local-port")
        .arg(port.to_string())
        .current_dir(&repo)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start relay client: {error}"))?;

    *guard = Some(child);
    Ok(())
}

#[tauri::command]
fn stop_live_share() -> Result<(), String> {
    let mut guard = RELAY_CLIENT
        .lock()
        .map_err(|_| "Relay client lock poisoned.".to_string())?;

    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    Ok(())
}

#[tauri::command]
fn return_to_launcher(window: tauri::WebviewWindow) -> Result<(), String> {
    let _ = stop_live_share();

    let shell_workspace = server::shell_workspace();
    let shell = shell_workspace.to_string_lossy().to_string();
    let _ = server::start_server(&shell)?;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            create_project,
            start_local_server,
            stop_local_server,
            open_editor_window,
            start_live_share,
            stop_live_share,
            return_to_launcher,
        ])
        .setup(|app| {
            menu::setup_menu(app.handle())?;

            let shell_workspace = server::shell_workspace();
            let shell = shell_workspace.to_string_lossy().to_string();

            if cfg!(debug_assertions) && server::is_healthy(server::DEV_SERVER_PORT) {
                server::adopt_running_server(server::DEV_SERVER_PORT, &shell)?;
                return Ok(());
            }

            let port = server::start_server(&shell)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = navigate_window(&window, &format!("http://127.0.0.1:{port}/launcher"));
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
