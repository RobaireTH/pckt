use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};

const MAX_BUCKETS: usize = 10_000;
const BUCKET_TTL: Duration = Duration::from_secs(600);

#[derive(Clone)]
pub struct RateLimit {
    inner: Arc<Mutex<HashMap<IpAddr, Bucket>>>,
    rate: f64,
    burst: f64,
    trust_forwarded_for: bool,
}

struct Bucket {
    tokens: f64,
    last: Instant,
}

impl RateLimit {
    pub fn new(rate_per_sec: f64, burst: f64, trust_forwarded_for: bool) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            rate: rate_per_sec.max(0.1),
            burst: burst.max(1.0),
            trust_forwarded_for,
        }
    }

    pub fn check(&self, ip: IpAddr) -> bool {
        let mut map = self.inner.lock().expect("rate-limit poisoned");
        let now = Instant::now();

        if map.len() >= MAX_BUCKETS {
            map.retain(|_, b| now.duration_since(b.last) < BUCKET_TTL);
            if map.len() >= MAX_BUCKETS {
                let drop_n = map.len() - (MAX_BUCKETS / 2);
                let victims: Vec<IpAddr> = map.keys().take(drop_n).copied().collect();
                for k in victims {
                    map.remove(&k);
                }
            }
        }

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
    let ip = client_ip(&rl, &req);
    if rl.check(ip) {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::TOO_MANY_REQUESTS)
    }
}

fn client_ip(rl: &RateLimit, req: &Request) -> IpAddr {
    let peer = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| addr.ip());
    if rl.trust_forwarded_for {
        if let Some(forwarded) = forwarded_for(req.headers()) {
            return forwarded;
        }
    }
    peer.unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED))
}

fn forwarded_for(headers: &HeaderMap) -> Option<IpAddr> {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .and_then(|s| s.trim().parse().ok())
}
