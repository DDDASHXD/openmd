use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

pub const DEV_SERVER_PORT: u16 = 8787;

pub struct ServerProcess {
    child: Option<ManagedChild>,
    pub port: u16,
    pub workspace: String,
}

enum ManagedChild {
    Process(Child),
    Sidecar(CommandChild),
}

pub struct RuntimePaths {
    pub server_script: PathBuf,
    pub working_dir: PathBuf,
}

static SERVER: Mutex<Option<ServerProcess>> = Mutex::new(None);
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn init_app_handle(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

pub fn shell_workspace() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    let shell_dir = PathBuf::from(home).join(".foliage").join("shell");

    if let Err(error) = std::fs::create_dir_all(&shell_dir) {
        eprintln!("Unable to create shell workspace: {error}");
    }

    shell_dir
}

pub fn resolve_paths() -> Result<RuntimePaths, String> {
    if cfg!(debug_assertions) {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let repo = manifest_dir
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf())
            .unwrap_or(manifest_dir);

        return Ok(RuntimePaths {
            server_script: repo.join("packages/foliage-server/bin/foliage-server.mjs"),
            working_dir: repo,
        });
    }

    let handle = APP_HANDLE
        .get()
        .ok_or_else(|| "App handle is not initialized.".to_string())?;

    let resource_dir = handle
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;

    let server_dir = resource_dir.join("resources/foliage-server");

    Ok(RuntimePaths {
        server_script: server_dir.join("bin/foliage-server.mjs"),
        working_dir: server_dir,
    })
}

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind ephemeral port")
        .local_addr()
        .expect("failed to read local addr")
        .port()
}

pub fn is_healthy(port: u16) -> bool {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };

    let url = format!("http://127.0.0.1:{port}/api/health");
    client
        .get(&url)
        .send()
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn apply_windows_no_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x08000000);
}

#[cfg(not(windows))]
fn apply_windows_no_window(_command: &mut Command) {}

fn wait_for_health(port: u16) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .map_err(|error| error.to_string())?;

    let url = format!("http://127.0.0.1:{port}/api/health");
    let deadline = Instant::now() + Duration::from_secs(60);

    while Instant::now() < deadline {
        if let Ok(response) = client.get(&url).send() {
            if response.status().is_success() {
                return Ok(());
            }
        }

        std::thread::sleep(Duration::from_millis(200));
    }

    Err("Timed out waiting for foliage-server.".to_string())
}

fn kill_managed_child(child: ManagedChild) {
    match child {
        ManagedChild::Process(mut process) => {
            let _ = process.kill();
            let _ = process.wait();
        }
        ManagedChild::Sidecar(sidecar) => {
            let _ = sidecar.kill();
        }
    }
}

pub fn stop_server() -> Result<(), String> {
    let mut guard = SERVER
        .lock()
        .map_err(|_| "Server lock poisoned.".to_string())?;

    if let Some(mut process) = guard.take() {
        if let Some(child) = process.child.take() {
            kill_managed_child(child);
        }
    }

    Ok(())
}

pub fn adopt_running_server(port: u16, workspace_path: &str) -> Result<(), String> {
    if !is_healthy(port) {
        return Err(format!("No healthy server found on port {port}."));
    }

    let mut guard = SERVER
        .lock()
        .map_err(|_| "Server lock poisoned.".to_string())?;

    *guard = Some(ServerProcess {
        child: None,
        port,
        workspace: workspace_path.to_string(),
    });

    Ok(())
}

pub fn switch_workspace_on_port(port: u16, workspace_path: &str) -> Result<u16, String> {
    if !is_healthy(port) {
        return Err(format!("No healthy server found on port {port}."));
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?;

    let url = format!("http://127.0.0.1:{port}/api/workspace/session");
    let response = client
        .patch(&url)
        .json(&serde_json::json!({ "workspacePath": workspace_path }))
        .send()
        .map_err(|error| format!("Failed to switch workspace: {error}"))?;

    if !response.status().is_success() {
        let message = response
            .text()
            .unwrap_or_else(|_| "Unable to switch workspace.".to_string());
        return Err(message);
    }

    let mut guard = SERVER
        .lock()
        .map_err(|_| "Server lock poisoned.".to_string())?;

    if let Some(process) = guard.as_mut() {
        process.port = port;
        process.workspace = workspace_path.to_string();
    } else {
        *guard = Some(ServerProcess {
            child: None,
            port,
            workspace: workspace_path.to_string(),
        });
    }

    Ok(port)
}

fn spawn_server(paths: &RuntimePaths, workspace_path: &str, port: u16) -> Result<ManagedChild, String> {
    if !paths.server_script.exists() {
        return Err(format!(
            "Server script not found: {}",
            paths.server_script.display()
        ));
    }

    let server_script = paths.server_script.display().to_string();
    let workspace = workspace_path.to_string();
    let port_arg = port.to_string();
    let working_dir = paths.working_dir.display().to_string();

    if cfg!(debug_assertions) {
        let mut command = Command::new("node");
        command
            .arg(&server_script)
            .arg("--headless")
            .arg("--workspace")
            .arg(&workspace)
            .arg("--port")
            .arg(&port_arg)
            .arg("--hostname")
            .arg("127.0.0.1")
            .current_dir(&paths.working_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        apply_windows_no_window(&mut command);

        let child = command
            .spawn()
            .map_err(|error| format!("Failed to start foliage-server: {error}"))?;

        return Ok(ManagedChild::Process(child));
    }

    let handle = APP_HANDLE
        .get()
        .ok_or_else(|| "App handle is not initialized.".to_string())?;

    let sidecar = handle
        .shell()
        .sidecar("node")
        .map_err(|error| format!("Failed to resolve node sidecar: {error}"))?
        .args([
            server_script.as_str(),
            "--headless",
            "--workspace",
            workspace.as_str(),
            "--port",
            port_arg.as_str(),
            "--hostname",
            "127.0.0.1",
        ])
        .current_dir(working_dir)
        .spawn()
        .map_err(|error| format!("Failed to start foliage-server sidecar: {error}"))?;

    Ok(ManagedChild::Sidecar(sidecar.1))
}

pub fn stop_live_share() -> Result<(), String> {
    let port = current_port().ok_or_else(|| "Local server is not running.".to_string())?;

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?;

    let url = format!("http://127.0.0.1:{port}/api/live-share/stop");
    let _ = client.post(&url).send();

    Ok(())
}

pub fn start_server(workspace_path: &str) -> Result<u16, String> {
    let existing_port = SERVER
        .lock()
        .ok()
        .and_then(|guard| {
            guard.as_ref().and_then(|process| {
                if is_healthy(process.port) {
                    Some(process.port)
                } else {
                    None
                }
            })
        });

    if let Some(port) = existing_port {
        return switch_workspace_on_port(port, workspace_path);
    }

    if cfg!(debug_assertions) && is_healthy(DEV_SERVER_PORT) {
        return switch_workspace_on_port(DEV_SERVER_PORT, workspace_path);
    }

    let paths = resolve_paths()?;
    let port = find_free_port();
    let child = spawn_server(&paths, workspace_path, port)?;

    if let Err(error) = wait_for_health(port) {
        kill_managed_child(child);

        return Err(error);
    }

    let mut guard = SERVER
        .lock()
        .map_err(|_| "Server lock poisoned.".to_string())?;

    *guard = Some(ServerProcess {
        child: Some(child),
        port,
        workspace: workspace_path.to_string(),
    });

    Ok(port)
}

pub fn current_port() -> Option<u16> {
    SERVER
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|process| process.port))
}
