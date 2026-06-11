use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition};

use super::{
    overlay::{self, HitRegion},
    settings::OverlayPosition,
};

const OVERLAY_HORIZONTAL_PADDING_CSS: f64 = 24.0;
const OVERLAY_BOTTOM_PADDING_CSS: f64 = 24.0;
const OVERLAY_PEEK_SLOT_WIDTH_CSS: f64 = 596.0;
const OVERLAY_EXPANDED_SLOT_WIDTH_CSS: f64 = 808.0;
const OVERLAY_MIN_HEIGHT_CSS: f64 = 80.0;
const OVERLAY_REGION_PADDING_CSS: f64 = 2.0;
const OVERLAY_RECT_EPSILON_PX: i32 = 1;

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

pub fn fit_overlay_to_content(
    app: &AppHandle,
    content_bounds: &HitRegion,
    regions: Vec<HitRegion>,
) -> Result<Vec<HitRegion>, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    if !is_valid_region(content_bounds) {
        return Ok(regions.into_iter().filter(is_valid_region).collect());
    }

    let scale_factor = window
        .scale_factor()
        .map_err(|error| error.to_string())?
        .max(0.1);
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let current_size = window.outer_size().map_err(|error| error.to_string())?;

    let desired_slot_width_css = if content_bounds.width > OVERLAY_PEEK_SLOT_WIDTH_CSS {
        OVERLAY_EXPANDED_SLOT_WIDTH_CSS
    } else {
        OVERLAY_PEEK_SLOT_WIDTH_CSS
    };
    let desired_width_css = desired_slot_width_css + (OVERLAY_HORIZONTAL_PADDING_CSS * 2.0);
    let desired_height_css = (content_bounds.y + content_bounds.height + OVERLAY_BOTTOM_PADDING_CSS)
        .max(OVERLAY_MIN_HEIGHT_CSS);
    let desired_content_left_css = ((desired_width_css - content_bounds.width) / 2.0).max(0.0);

    let desired_width = (desired_width_css * scale_factor).round().max(1.0) as u32;
    let desired_height = (desired_height_css * scale_factor).round().max(1.0) as u32;
    let content_center_x = position.x as f64
        + ((content_bounds.x + (content_bounds.width / 2.0)) * scale_factor);
    let content_top_y = position.y as f64 + (content_bounds.y * scale_factor);
    let desired_x = (content_center_x - (desired_width as f64 / 2.0)).round() as i32;
    let desired_y = (content_top_y - (content_bounds.y * scale_factor)).round() as i32;

    let position_changed = (position.x - desired_x).abs() > OVERLAY_RECT_EPSILON_PX
        || (position.y - desired_y).abs() > OVERLAY_RECT_EPSILON_PX;
    let size_changed = physical_delta(current_size.width, desired_width) > OVERLAY_RECT_EPSILON_PX
        || physical_delta(current_size.height, desired_height) > OVERLAY_RECT_EPSILON_PX;

    if position_changed || size_changed {
        overlay::set_window_rect_no_activate(
            &window,
            desired_x,
            desired_y,
            desired_width,
            desired_height,
        )
        .map_err(|error| error.to_string())?;
    }

    let fitted_content_bounds = HitRegion {
        x: (desired_content_left_css - OVERLAY_REGION_PADDING_CSS).max(0.0),
        y: (content_bounds.y - OVERLAY_REGION_PADDING_CSS).max(0.0),
        width: content_bounds.width + (OVERLAY_REGION_PADDING_CSS * 2.0),
        height: content_bounds.height + (OVERLAY_REGION_PADDING_CSS * 2.0),
    };
    overlay::set_window_input_region(&window, Some(fitted_content_bounds), scale_factor)
        .map_err(|error| error.to_string())?;

    Ok(regions
        .into_iter()
        .filter(is_valid_region)
        .map(|region| HitRegion {
            x: desired_content_left_css + (region.x - content_bounds.x),
            y: region.y,
            width: region.width,
            height: region.height,
        })
        .filter(is_valid_region)
        .collect())
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

fn is_valid_region(region: &HitRegion) -> bool {
    region.x.is_finite()
        && region.y.is_finite()
        && region.width.is_finite()
        && region.height.is_finite()
        && region.width > 0.0
        && region.height > 0.0
}

fn physical_delta(left: u32, right: u32) -> i32 {
    left.abs_diff(right) as i32
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
