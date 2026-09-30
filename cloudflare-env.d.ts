declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITE_OWNER_EMAIL?: string;
  }
}
