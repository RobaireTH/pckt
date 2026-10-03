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
        if let Some(forwarded) = proxied_client_ip(req.headers()) {
            return forwarded;
        }
    }
    peer.unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED))
}

pub fn proxied_client_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let fly = headers
        .get("fly-client-ip")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse().ok());
    fly.or_else(|| {
        headers
            .get_all("x-forwarded-for")
            .iter()
            .filter_map(|v| v.to_str().ok())
            .flat_map(|s| s.split(','))
            .last()
            .and_then(|s| s.trim().parse().ok())
    })
}

#[cfg(test)]
mod tests {
    use super::proxied_client_ip;
    use axum::http::{HeaderMap, HeaderValue};
    use std::net::IpAddr;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn prefers_fly_client_ip() {
        let mut h = HeaderMap::new();
        h.insert("fly-client-ip", HeaderValue::from_static("203.0.113.7"));
        h.insert(
            "x-forwarded-for",
            HeaderValue::from_static("198.51.100.1, 203.0.113.9"),
        );
        assert_eq!(proxied_client_ip(&h), Some(ip("203.0.113.7")));
    }

    #[test]
    fn uses_last_forwarded_hop_not_the_client_supplied_first() {
        let mut h = HeaderMap::new();
        h.insert(
            "x-forwarded-for",
            HeaderValue::from_static("1.2.3.4, 203.0.113.9"),
        );
        assert_eq!(proxied_client_ip(&h), Some(ip("203.0.113.9")));
    }

    #[test]
    fn none_without_proxy_headers() {
        assert_eq!(proxied_client_ip(&HeaderMap::new()), None);
    }
}
