use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub const DEV_SERVER_PORT: u16 = 3000;

pub struct ServerProcess {
    child: Option<Child>,
    pub port: u16,
    pub workspace: String,
}

static SERVER: Mutex<Option<ServerProcess>> = Mutex::new(None);

pub fn repo_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| manifest_dir)
}

pub fn shell_workspace() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let shell_dir = PathBuf::from(home).join(".openmd").join("shell");

    if let Err(error) = std::fs::create_dir_all(&shell_dir) {
        eprintln!("Unable to create shell workspace: {error}");
    }

    shell_dir
}

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind ephemeral port")
        .local_addr()
        .expect("failed to read local addr")
        .port()
}

fn server_script_path(repo: &Path) -> PathBuf {
    repo.join("packages/openmd-server/bin/openmd-server.mjs")
}

fn app_dir_path(repo: &Path) -> PathBuf {
    repo.join("apps/web")
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

fn kill_listener_on_port(port: u16) {
    #[cfg(unix)]
    {
        let _ = Command::new("sh")
            .arg("-c")
            .arg(format!("lsof -ti tcp:{port} | xargs kill -9 2>/dev/null || true"))
            .status();
    }
}

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

    Err("Timed out waiting for openmd-server.".to_string())
}

pub fn stop_server() -> Result<(), String> {
    let mut guard = SERVER
        .lock()
        .map_err(|_| "Server lock poisoned.".to_string())?;

    if let Some(mut process) = guard.take() {
        if let Some(mut child) = process.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        } else if should_kill_adopted_server(process.port) {
            kill_listener_on_port(process.port);
        }
    }

    Ok(())
}

fn should_kill_adopted_server(port: u16) -> bool {
    if cfg!(debug_assertions) && port == DEV_SERVER_PORT {
        return false;
    }

    true
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

    *guard = Some(ServerProcess {
        child: None,
        port,
        workspace: workspace_path.to_string(),
    });

    Ok(port)
}

pub fn start_server(workspace_path: &str) -> Result<u16, String> {
    if cfg!(debug_assertions) && is_healthy(DEV_SERVER_PORT) {
        return switch_workspace_on_port(DEV_SERVER_PORT, workspace_path);
    }

    stop_server()?;

    if !cfg!(debug_assertions) {
        kill_listener_on_port(DEV_SERVER_PORT);
    }

    let repo = repo_root();
    let script = server_script_path(&repo);
    let app_dir = app_dir_path(&repo);
    let port = find_free_port();

    if !script.exists() {
        return Err(format!("Server script not found: {}", script.display()));
    }

    let child = Command::new("node")
        .arg(&script)
        .arg("--workspace")
        .arg(workspace_path)
        .arg("--port")
        .arg(port.to_string())
        .arg("--hostname")
        .arg("127.0.0.1")
        .arg("--app-dir")
        .arg(&app_dir)
        .current_dir(&repo)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start openmd-server: {error}"))?;

    wait_for_health(port)?;

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
