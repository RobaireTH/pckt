use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};

#[derive(Clone)]
pub struct RateLimit {
    inner: Arc<Mutex<HashMap<IpAddr, Bucket>>>,
    rate: f64,
    burst: f64,
}

struct Bucket {
    tokens: f64,
    last: Instant,
}

impl RateLimit {
    pub fn new(rate_per_sec: f64, burst: f64) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            rate: rate_per_sec.max(0.1),
            burst: burst.max(1.0),
        }
    }

    pub fn check(&self, ip: IpAddr) -> bool {
        let mut map = self.inner.lock().expect("rate-limit poisoned");
        let now = Instant::now();
        let bucket = map.entry(ip).or_insert(Bucket {
            tokens: self.burst,
            last: now,
        });
        let elapsed = now.duration_since(bucket.last).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * self.rate).min(self.burst);
        bucket.last = now;
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

pub async fn middleware(
    State(rl): State<RateLimit>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = client_ip(req.headers());
    if rl.check(ip) {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::TOO_MANY_REQUESTS)
    }
}

fn client_ip(headers: &HeaderMap) -> IpAddr {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED))
}
