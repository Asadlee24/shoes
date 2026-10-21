export function commerceSchema(prefix = "", bytes = "BLOB") {
  return `
CREATE TABLE IF NOT EXISTS ${prefix}customer_email_verifications(user_id TEXT PRIMARY KEY,verified TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ${prefix}customer_email_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,credential_hash TEXT NOT NULL,expires BIGINT NOT NULL,created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ${prefix}email_tokens_user ON ${prefix}customer_email_tokens(user_id,kind);
CREATE TABLE IF NOT EXISTS ${prefix}reviews(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,product_id TEXT NOT NULL,user_id TEXT NOT NULL,rating INTEGER NOT NULL,body TEXT NOT NULL,display_name TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(request_id,product_id,user_id));
CREATE INDEX IF NOT EXISTS ${prefix}reviews_product ON ${prefix}reviews(product_id,status);
CREATE TABLE IF NOT EXISTS ${prefix}review_photos(id TEXT PRIMARY KEY,review_id TEXT NOT NULL,type TEXT NOT NULL,data ${bytes} NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ${prefix}stock_alert_state(id TEXT PRIMARY KEY,low INTEGER NOT NULL,revision INTEGER NOT NULL);`;
}
