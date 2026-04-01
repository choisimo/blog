use std::env;
use std::error::Error;
use std::process::{Command, Stdio};

#[derive(Debug, Clone)]
struct Config {
    host: String,
    repo_dir: String,
    backend_dir: String,
    branch: String,
    services: Vec<String>,
    health_url: String,
    dry_run: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "blog".to_string(),
            repo_dir: "/home/nodove/workspace/blog".to_string(),
            backend_dir: "/home/nodove/workspace/blog/backend".to_string(),
            branch: "main".to_string(),
            services: vec![
                "api".to_string(),
                "terminal-server".to_string(),
                "redis".to_string(),
            ],
            health_url: "http://127.0.0.1:5080/api/v1/healthz".to_string(),
            dry_run: false,
        }
    }
}

impl Config {
    fn from_args() -> Result<Self, Box<dyn Error>> {
        let mut cfg = Self::default();
        let mut args = env::args().skip(1);

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--host" => cfg.host = next_arg(&mut args, "--host")?,
                "--repo-dir" => cfg.repo_dir = next_arg(&mut args, "--repo-dir")?,
                "--backend-dir" => cfg.backend_dir = next_arg(&mut args, "--backend-dir")?,
                "--branch" => cfg.branch = next_arg(&mut args, "--branch")?,
                "--services" => {
                    cfg.services = next_arg(&mut args, "--services")?
                        .split(',')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(ToString::to_string)
                        .collect();
                }
                "--health-url" => cfg.health_url = next_arg(&mut args, "--health-url")?,
                "--dry-run" => cfg.dry_run = true,
                "-h" | "--help" => {
                    print_help();
                    std::process::exit(0);
                }
                _ => return Err(format!("Unknown argument: {arg}").into()),
            }
        }

        if cfg.services.is_empty() {
            return Err("services list must not be empty".into());
        }

        Ok(cfg)
    }
}

fn next_arg(args: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, Box<dyn Error>> {
    args.next()
        .ok_or_else(|| format!("{flag} requires a value").into())
}

fn shell_quote(input: &str) -> String {
    format!("'{}'", input.replace('\'', "'\"'\"'"))
}

fn run_ssh(host: &str, script: &str) -> Result<String, Box<dyn Error>> {
    let remote_command = format!("bash -lc {}", shell_quote(script));
    let output = Command::new("ssh")
        .arg(host)
        .arg(remote_command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let mut msg = format!(
            "remote command failed (host={host}, exit={})",
            output.status.code().unwrap_or(-1)
        );
        if !stdout.trim().is_empty() {
            msg.push_str(&format!("\nstdout:\n{stdout}"));
        }
        if !stderr.trim().is_empty() {
            msg.push_str(&format!("\nstderr:\n{stderr}"));
        }
        return Err(msg.into());
    }

    if !stderr.trim().is_empty() {
        eprintln!("[ssh:{host}] {stderr}");
    }

    Ok(stdout)
}

fn print_help() {
    println!(
        r#"Backend deploy script (ssh blog)

Usage:
  rustc --edition=2021 scripts/deploy-backend.rs -o deploy-backend
  ./deploy-backend [options]

Options:
  --host <ssh-host>        SSH host alias (default: blog)
  --repo-dir <path>        Remote repository path (default: /home/nodove/workspace/blog)
  --backend-dir <path>     Remote backend path (default: /home/nodove/workspace/blog/backend)
  --branch <name>          Branch to pull (default: main)
  --services <csv>         docker-compose services (default: api,terminal-server,redis)
  --health-url <url>       Health URL (default: http://127.0.0.1:5080/api/v1/healthz)
  --dry-run                Print remote commands only
  -h, --help               Show help
"#
    );
}

fn main() -> Result<(), Box<dyn Error>> {
    let cfg = Config::from_args()?;
    let service_args = cfg.services.join(" ");

    let git_script = format!(
        r#"set -euo pipefail
cd {}
git pull --ff-only origin {}
git rev-parse --short HEAD
"#,
        shell_quote(&cfg.repo_dir),
        shell_quote(&cfg.branch),
    );

    let deploy_script = format!(
        r#"set -euo pipefail
cd {}
docker-compose up -d {}
docker-compose ps {}
"#,
        shell_quote(&cfg.backend_dir),
        service_args,
        service_args,
    );

    let health_script = format!(
        r#"set -euo pipefail
if command -v curl >/dev/null 2>&1; then
  curl -fsSL {}
else
  wget -qO- {}
fi
"#,
        shell_quote(&cfg.health_url),
        shell_quote(&cfg.health_url),
    );

    println!("== Remote Backend Deploy ==");
    println!("host        : {}", cfg.host);
    println!("repo_dir    : {}", cfg.repo_dir);
    println!("backend_dir : {}", cfg.backend_dir);
    println!("branch      : {}", cfg.branch);
    println!("services    : {}", cfg.services.join(","));
    println!("health_url  : {}", cfg.health_url);
    println!("dry_run     : {}", cfg.dry_run);

    if cfg.dry_run {
        println!("\n[dry-run] git script:\n{git_script}");
        println!("\n[dry-run] deploy script:\n{deploy_script}");
        println!("\n[dry-run] health script:\n{health_script}");
        return Ok(());
    }

    println!("\n1) Pull latest code");
    let commit = run_ssh(&cfg.host, &git_script)?;
    println!("   deployed commit: {}", commit.trim());

    println!("2) Restart backend containers");
    let deploy_out = run_ssh(&cfg.host, &deploy_script)?;
    if !deploy_out.trim().is_empty() {
        println!("{deploy_out}");
    }

    println!("3) Health check");
    let health_out = run_ssh(&cfg.host, &health_script)?;
    println!("   {}", health_out.trim());

    println!("\nDeployment finished.");
    Ok(())
}
