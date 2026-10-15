// Prevents additional console window on Windows.
// We always set windows_subsystem = "windows" so the dev build also has no
// terminal popup. Comment out the `cfg_attr` line if you need to see Rust
// println! output during debugging — but you'll get a CMD window.

#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    promptpad_lib::run()
}
