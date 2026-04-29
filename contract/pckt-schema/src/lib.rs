#![no_std]

extern crate alloc;

#[allow(clippy::all, dead_code, unused_imports)]
mod generated {
    include!(concat!(env!("OUT_DIR"), "/schema.rs"));
}

pub use generated::*;
