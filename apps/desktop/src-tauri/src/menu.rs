use tauri::menu::{AboutMetadata, MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

const MENU_OPEN_PROJECT: &str = "open_project";
const MENU_CLOSE_PROJECT: &str = "close_project";
const MENU_LEAFMARK: &str = "leafmark";
const MENU_EXPORT: &str = "export";
const MENU_LIVE_SHARE: &str = "live_share";
const MENU_ABOUT: &str = "about";
const MENU_REPORT_BUG: &str = "report_bug";

pub fn setup_menu(app: &AppHandle) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, "openmd")
        .about(Some(AboutMetadata {
            name: Some("openmd".into()),
            ..Default::default()
        }))
        .text(MENU_ABOUT, "About Openmd")
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .text(MENU_OPEN_PROJECT, "Open Project…")
        .separator()
        .text(MENU_CLOSE_PROJECT, "Close Project")
        .separator()
        .text(MENU_LEAFMARK, "Leafmark…")
        .text(MENU_EXPORT, "Export")
        .separator()
        .text(MENU_LIVE_SHARE, "Start Live Share…")
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .text(MENU_REPORT_BUG, "Report a Bug")
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("menu-action", event_id);
    }
}
