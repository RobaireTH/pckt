use std::path::PathBuf;

fn main() {
    let out_dir: PathBuf = std::env::var_os("OUT_DIR").unwrap().into();
    codegen::Compiler::new()
        .input_schema_file("schema.mol")
        .generate_code(codegen::Language::Rust)
        .output_dir(out_dir)
        .run()
        .expect("molecule codegen");
    println!("cargo:rerun-if-changed=schema.mol");
}
