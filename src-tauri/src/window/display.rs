use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition};

use super::settings::OverlayPosition;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RectInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: String,
    pub name: String,
    pub bounds: RectInfo,
    pub work_area: RectInfo,
    pub scale_factor: f64,
    pub is_primary: bool,
}

pub fn list_displays(app: &AppHandle) -> tauri::Result<Vec<DisplayInfo>> {
    let primary_name = app
        .primary_monitor()?
        .and_then(|monitor| monitor.name().cloned());

    app.available_monitors().map(|monitors| {
        monitors
            .into_iter()
            .enumerate()
            .map(|(index, monitor)| {
                let name = monitor
                    .name()
                    .cloned()
                    .unwrap_or_else(|| format!("Display {}", index + 1));
                let position = monitor.position();
                let size = monitor.size();
                let work_area = monitor.work_area();
                let is_primary = primary_name.as_ref().is_some_and(|primary| primary == &name);

                DisplayInfo {
                    id: name.clone(),
                    name,
                    bounds: RectInfo {
                        x: position.x,
                        y: position.y,
                        width: size.width,
                        height: size.height,
                    },
                    work_area: RectInfo {
                        x: work_area.position.x,
                        y: work_area.position.y,
                        width: work_area.size.width,
                        height: work_area.size.height,
                    },
                    scale_factor: monitor.scale_factor(),
                    is_primary,
                }
            })
            .collect()
    })
}

pub fn set_overlay_position(
    app: &AppHandle,
    position: &OverlayPosition,
) -> Result<OverlayPosition, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .set_position(PhysicalPosition::new(position.x, position.y))
        .map_err(|error| error.to_string())?;

    Ok(position.clone())
}

pub fn center_overlay_on_display(
    app: &AppHandle,
    display_id: Option<String>,
    top_offset_px: Option<i32>,
) -> Result<DisplayInfo, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let displays = list_displays(app).map_err(|error| error.to_string())?;
    let display = select_display(&displays, display_id.as_deref())
        .cloned()
        .ok_or_else(|| "no display available".to_string())?;

    let width = window
        .outer_size()
        .map(|size| size.width as i32)
        .unwrap_or(900_i32);
    let top_offset = top_offset_px.unwrap_or(10).max(0);
    let x = display.work_area.x + ((display.work_area.width as i32 - width) / 2).max(0);
    let y = display.work_area.y + top_offset;

    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;

    Ok(display)
}

fn select_display<'a>(displays: &'a [DisplayInfo], display_id: Option<&str>) -> Option<&'a DisplayInfo> {
    match display_id {
        Some("primary") => displays.iter().find(|display| display.is_primary).or_else(|| displays.first()),
        Some("auto") | None => displays.iter().find(|display| display.is_primary).or_else(|| displays.first()),
        Some(id) => displays
            .iter()
            .find(|display| display.id == id || display.name == id)
            .or_else(|| displays.iter().find(|display| display.is_primary))
            .or_else(|| displays.first()),
    }
}
