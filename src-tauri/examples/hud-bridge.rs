use std::{env, io::{self, Read, Write}};

use claude_hud_one_lib::hud_bridge::{
    native_event::render_native_bridge_event_json,
    runtime::{run_bridge_once, BridgeMode},
};
use serde_json::Value;

fn main() {
    if let Err(error) = run() {
        eprintln!("hud-bridge: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let emit_json = args.iter().any(|arg| arg == "--emit-json");
    let mode = if args.iter().any(|arg| arg == "--hook") {
        BridgeMode::Hook
    } else {
        BridgeMode::StatusLine
    };

    let raw_stdin = read_stdin_string()?;
    if emit_json {
        let input = parse_stdin_json(&raw_stdin)?;
        let event = render_native_bridge_event_json(
            &input,
            if mode == BridgeMode::Hook { "hook" } else { "statusLine" },
        );
        println!("{}", serde_json::to_string(&event).map_err(|error| error.to_string())?);
        return Ok(());
    }

    let output = run_bridge_once(&raw_stdin, mode);
    if !output.stdout.is_empty() {
        io::stdout()
            .write_all(output.stdout.as_bytes())
            .map_err(|error| format!("failed to write bridge output: {error}"))?;
    }
    Ok(())
}

fn read_stdin_string() -> Result<String, String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| format!("failed to read stdin: {error}"))?;
    Ok(input)
}

fn parse_stdin_json(input: &str) -> Result<Value, String> {
    if input.trim().is_empty() {
        return Ok(Value::Object(Default::default()));
    }
    serde_json::from_str(input).map_err(|error| format!("failed to parse stdin JSON: {error}"))
}
